import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(serverRoot, '..', '..');
const webRoot = resolve(workspaceRoot, 'apps', 'web');
const envFilePath = resolve(workspaceRoot, '.env');
const envLocalFilePath = resolve(workspaceRoot, '.env.local');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const serverBaseUrl = 'http://127.0.0.1:3000';
const webBaseUrl = 'http://127.0.0.1:5173';
const cdpBaseUrl = 'http://127.0.0.1:9222';
const summaryToken = 'APPROVAL_BROWSER_AUTHORITY_SUMMARY';
const defaultModel = 'llama-3.3-70b-versatile';
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const promptText =
	'Tool kullanarak package.json dosyasini oku ve yalnizca "name" alaninin degerini soyle.';

function printSummary(summary) {
	process.stdout.write(`${summaryToken} ${JSON.stringify(summary)}\n`);
}

function logStep(message) {
	process.stdout.write(`[approval-browser-authority] ${message}\n`);
}

function normalizeEnvValue(rawValue) {
	const trimmedValue = rawValue.trim();

	if (
		(trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
		(trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
	) {
		return trimmedValue.slice(1, -1);
	}

	return trimmedValue;
}

function readEnvironmentFile(filePath) {
	if (!existsSync(filePath)) {
		return {};
	}

	const contents = readFileSync(filePath, 'utf8');
	const parsed = {};

	for (const rawLine of contents.split(/\r?\n/u)) {
		const line = rawLine.trim();

		if (line.length === 0 || line.startsWith('#') || line.startsWith('//')) {
			continue;
		}

		const separatorIndex = line.indexOf('=');

		if (separatorIndex <= 0) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		const rawValue = line.slice(separatorIndex + 1);

		if (key.length === 0) {
			continue;
		}

		parsed[key] = normalizeEnvValue(rawValue);
	}

	return parsed;
}

function createLoadedEnvironment() {
	const shellGroqApiKey = process.env.GROQ_API_KEY?.trim() || undefined;
	const envValues = readEnvironmentFile(envFilePath);
	const envLocalValues = readEnvironmentFile(envLocalFilePath);
	const mergedFileValues = {
		...envValues,
		...envLocalValues,
	};
	const environment = {
		...process.env,
		...mergedFileValues,
		NODE_ENV: process.env.NODE_ENV ?? 'development',
		RUNA_DEV_AUTH_ENABLED: process.env.RUNA_DEV_AUTH_ENABLED ?? '1',
		RUNA_DEV_AUTH_SECRET: process.env.RUNA_DEV_AUTH_SECRET ?? randomUUID(),
		RUNA_DEV_AUTH_EMAIL: process.env.RUNA_DEV_AUTH_EMAIL ?? 'dev@runa.local',
	};
	const fileBackedGroqApiKey = mergedFileValues.GROQ_API_KEY?.trim() || undefined;

	return {
		environment,
		file_backed_groq_api_key_present: fileBackedGroqApiKey !== undefined,
		groq_api_key_source:
			shellGroqApiKey !== undefined
				? 'shell_env'
				: fileBackedGroqApiKey !== undefined
					? 'file_backed_env'
					: 'missing',
		shell_groq_api_key_present: shellGroqApiKey !== undefined,
	};
}

function createSpawnInvocation(command, args) {
	if (process.platform !== 'win32' || !command.endsWith('.cmd')) {
		return {
			args,
			command,
		};
	}

	const shellCommand = process.env.ComSpec ?? 'cmd.exe';

	return {
		args: ['/d', '/s', '/c', command, ...args],
		command: shellCommand,
	};
}

function spawnManagedProcess(input) {
	const invocation = createSpawnInvocation(input.command, input.args);
	const child = spawn(invocation.command, invocation.args, {
		cwd: input.cwd,
		env: input.env,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const state = {
		child,
		label: input.label,
		stderr: '',
		stdout: '',
	};

	child.stdout.on('data', (chunk) => {
		state.stdout += chunk.toString();
	});
	child.stderr.on('data', (chunk) => {
		state.stderr += chunk.toString();
	});

	return state;
}

async function stopManagedProcess(state) {
	if (state.child.exitCode !== null) {
		return;
	}

	await Promise.race([
		new Promise((resolvePromise) => {
			const exitHandler = () => resolvePromise();
			state.child.once('exit', exitHandler);
			state.child.kill();
			setTimeout(() => {
				if (state.child.exitCode !== null) {
					return;
				}

				const killer = spawn('taskkill', ['/PID', String(state.child.pid), '/T', '/F'], {
					stdio: 'ignore',
				});

				killer.once('exit', () => {
					if (state.child.exitCode === null) {
						state.child.removeListener('exit', exitHandler);
						resolvePromise();
					}
				});
			}, 3_000).unref();
		}),
		new Promise((resolvePromise) => setTimeout(resolvePromise, 6_000)),
	]);

	state.child.stdout.destroy();
	state.child.stderr.destroy();
}

async function waitForHttpOk(url, timeoutMs) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(url);

			if (response.ok) {
				return;
			}
		} catch {}

		await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
	}

	throw new Error(`Timed out waiting for ${url}.`);
}

async function waitForCondition(description, predicate, timeoutMs = 30_000) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		const value = await predicate();

		if (value) {
			return value;
		}

		await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
	}

	throw new Error(`Timed out while waiting for ${description}.`);
}

async function launchEdge(userDataDir) {
	if (!existsSync(edgePath)) {
		throw new Error(`Edge executable not found at ${edgePath}.`);
	}

	return spawnManagedProcess({
		args: [
			'--headless=new',
			'--disable-gpu',
			'--no-first-run',
			'--no-default-browser-check',
			'--remote-debugging-port=9222',
			`--user-data-dir=${userDataDir}`,
			'about:blank',
		],
		command: edgePath,
		cwd: workspaceRoot,
		env: process.env,
		label: 'edge',
	});
}

async function readJson(url) {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Request to ${url} failed with status ${response.status}.`);
	}

	return await response.json();
}

class CdpSession {
	constructor(webSocketUrl) {
		this.nextId = 1;
		this.pending = new Map();
		this.waiters = [];
		this.socket = new WebSocket(webSocketUrl);
		this.opened = new Promise((resolvePromise, rejectPromise) => {
			this.socket.addEventListener('open', () => resolvePromise(), { once: true });
			this.socket.addEventListener(
				'error',
				() => rejectPromise(new Error('CDP websocket connection failed.')),
				{ once: true },
			);
		});

		this.socket.addEventListener('message', (event) => {
			const message = JSON.parse(String(event.data));

			if (typeof message.id === 'number') {
				const pending = this.pending.get(message.id);

				if (!pending) {
					return;
				}

				this.pending.delete(message.id);

				if (message.error) {
					pending.reject(
						new Error(
							`CDP command failed: ${message.error.message ?? JSON.stringify(message.error)}`,
						),
					);
					return;
				}

				pending.resolve(message.result ?? {});
				return;
			}

			for (const waiter of [...this.waiters]) {
				if (waiter.method !== message.method) {
					continue;
				}

				if (waiter.predicate && waiter.predicate(message.params) !== true) {
					continue;
				}

				clearTimeout(waiter.timeoutId);
				this.waiters = this.waiters.filter((entry) => entry !== waiter);
				waiter.resolve(message.params ?? {});
			}
		});
	}

	async send(method, params = {}) {
		await this.opened;
		const id = this.nextId;
		this.nextId += 1;

		return await new Promise((resolvePromise, rejectPromise) => {
			this.pending.set(id, {
				reject: rejectPromise,
				resolve: resolvePromise,
			});
			this.socket.send(JSON.stringify({ id, method, params }));
		});
	}

	async waitForEvent(method, predicate, timeoutMs = 30_000) {
		await this.opened;

		return await new Promise((resolvePromise, rejectPromise) => {
			const timeoutId = setTimeout(() => {
				this.waiters = this.waiters.filter((entry) => entry !== waiter);
				rejectPromise(new Error(`Timed out waiting for CDP event ${method}.`));
			}, timeoutMs);
			const waiter = {
				method,
				predicate,
				resolve: resolvePromise,
				timeoutId,
			};
			this.waiters.push(waiter);
		});
	}

	async evaluate(expression) {
		const result = await this.send('Runtime.evaluate', {
			awaitPromise: true,
			expression,
			returnByValue: true,
		});

		if (result.exceptionDetails) {
			throw new Error('CDP evaluation failed.');
		}

		return result.result?.value;
	}

	async navigate(url) {
		const loadEvent = this.waitForEvent('Page.loadEventFired', undefined, 30_000);
		await this.send('Page.navigate', { url });
		await loadEvent;
	}

	close() {
		if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
			this.socket.close();
		}
	}
}

function buildWebSocketLogInjection() {
	return `
		(() => {
			if (window.__RUNA_WS_LOG__) {
				return;
			}
			const log = {
				parse_errors: [],
				received: [],
				sent: [],
				socket_urls: [],
			};
			const NativeWebSocket = window.WebSocket;
			function toLoggedPayload(rawValue) {
				try {
					return JSON.parse(rawValue);
				} catch (error) {
					return {
						parse_error: error instanceof Error ? error.message : String(error),
						raw: rawValue,
						type: 'parse.error',
					};
				}
			}
			function WrappedWebSocket(...args) {
				const socket = new NativeWebSocket(...args);
				const socketUrl = typeof args[0] === 'string' ? args[0] : String(args[0]);
				log.socket_urls.push(socketUrl);
				const nativeSend = socket.send.bind(socket);
				socket.send = function(data) {
					const rawValue = typeof data === 'string' ? data : String(data);
					log.sent.push(toLoggedPayload(rawValue));
					return nativeSend(data);
				};
				socket.addEventListener('message', (event) => {
					const rawValue = typeof event.data === 'string' ? event.data : String(event.data);
					log.received.push(toLoggedPayload(rawValue));
				});
				return socket;
			}
			Object.setPrototypeOf(WrappedWebSocket, NativeWebSocket);
			WrappedWebSocket.prototype = NativeWebSocket.prototype;
			Object.defineProperties(WrappedWebSocket, {
				CLOSED: { value: NativeWebSocket.CLOSED },
				CLOSING: { value: NativeWebSocket.CLOSING },
				CONNECTING: { value: NativeWebSocket.CONNECTING },
				OPEN: { value: NativeWebSocket.OPEN },
			});
			window.WebSocket = WrappedWebSocket;
			window.__RUNA_WS_LOG__ = log;
		})();
	`;
}

function escapeForEvaluate(value) {
	return JSON.stringify(value);
}

async function readBrowserState(session) {
	return await session.evaluate(`
		(() => ({
			body_text: document.body ? document.body.innerText.slice(0, 1200) : '',
			has_submit_button: Boolean(document.querySelector('button[type="submit"]')),
			has_textarea: Boolean(document.querySelector('textarea')),
			href: window.location.href,
			pathname: window.location.pathname,
			runtime_config: (() => {
				try {
					const raw = window.localStorage.getItem(${escapeForEvaluate(runtimeConfigStorageKey)});
					return raw ? JSON.parse(raw) : null;
				} catch {
					return null;
				}
			})(),
			ws_log: window.__RUNA_WS_LOG__ ?? null,
		}))()
	`);
}

function extractAuthorityOutcome(browserState) {
	const wsLog = browserState?.ws_log;
	const sentMessages = Array.isArray(wsLog?.sent) ? wsLog.sent : [];
	const receivedMessages = Array.isArray(wsLog?.received) ? wsLog.received : [];
	const runRequestMessage = sentMessages.find((message) => message?.type === 'run.request');
	const approvalMessage = receivedMessages.find(
		(message) =>
			message?.type === 'presentation.blocks' &&
			Array.isArray(message.payload?.blocks) &&
			message.payload.blocks.some(
				(block) => block?.type === 'approval_block' && block?.payload?.status === 'pending',
			),
	);
	const approvalBlock = approvalMessage?.payload?.blocks?.find((block) => block?.type === 'approval_block');
	const runFinishedMessage = receivedMessages.find((message) => message?.type === 'run.finished');

	return {
		approvalBlock,
		approvalMessage,
		receivedMessages,
		runFinishedMessage,
		runRequestMessage,
		sentMessages,
	};
}

function sanitizeSocketUrls(socketUrls) {
	if (!Array.isArray(socketUrls)) {
		return [];
	}

	return socketUrls.map((rawUrl) => {
		try {
			const parsedUrl = new URL(rawUrl);
			parsedUrl.searchParams.delete('access_token');
			parsedUrl.searchParams.delete('token');
			return parsedUrl.toString();
		} catch {
			return '[unparseable-socket-url]';
		}
	});
}

function classifyFailure(input) {
	if (!input.runRequestMessage) {
		return 'browser_runtime_config_drift';
	}

	if (
		input.runRequestMessage.payload?.provider !== 'groq' ||
		typeof input.runRequestMessage.payload?.provider_config?.apiKey !== 'string' ||
		input.runRequestMessage.payload.provider_config.apiKey.trim().length === 0
	) {
		return 'browser_runtime_config_drift';
	}

	if (input.serverLogs.includes('[provider.error.debug]') || input.serverLogs.includes('groq returned HTTP')) {
		return 'provider_response_error';
	}

	if (input.approvalBlock && !input.runFinishedMessage) {
		return 'ws_runtime_continuation_regression';
	}

	return 'browser_runtime_config_drift';
}

async function main() {
	const envState = createLoadedEnvironment();
	let finalExitCode = 0;

	if (envState.groq_api_key_source === 'missing') {
		printSummary({
			groq_api_key_source: 'missing',
			result: 'BLOCKED',
			reason: 'credential_missing',
			shell_groq_api_key_present: envState.shell_groq_api_key_present,
			file_backed_groq_api_key_present: envState.file_backed_groq_api_key_present,
		});
		finalExitCode = 2;
		process.exit(finalExitCode);
		return;
	}

	if (!existsSync(edgePath)) {
		printSummary({
			groq_api_key_source: envState.groq_api_key_source,
			result: 'BLOCKED',
			reason: 'browser_unavailable',
		});
		finalExitCode = 2;
		process.exit(finalExitCode);
		return;
	}

	const tempRoot = mkdtempSync(resolve(os.tmpdir(), 'runa-browser-authority-'));
	const edgeUserDataDir = resolve(tempRoot, 'edge-profile');
	const serverProcess = spawnManagedProcess({
		args: ['dist/index.js'],
		command: process.execPath,
		cwd: serverRoot,
		env: {
			...envState.environment,
			RUNA_DEBUG_PROVIDER_ERRORS: '1',
		},
		label: 'server',
	});
	const webProcess = spawnManagedProcess({
		args: ['exec', 'vite', '--host', '127.0.0.1', '--port', '5173'],
		command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
		cwd: webRoot,
		env: envState.environment,
		label: 'web',
	});
	let edgeProcess = null;
	let cdpSession = null;

	try {
		logStep('waiting for server and web readiness');
		await waitForHttpOk(`${serverBaseUrl}/health`, 30_000);
		await waitForHttpOk(webBaseUrl, 30_000);
		logStep('server and web are ready');

		edgeProcess = await launchEdge(edgeUserDataDir);
		await waitForHttpOk(`${cdpBaseUrl}/json/version`, 15_000);
		const targets = await readJson(`${cdpBaseUrl}/json/list`);
		const pageTarget = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);

		if (!pageTarget?.webSocketDebuggerUrl) {
			throw new Error('No debuggable Edge page target was created.');
		}

		cdpSession = new CdpSession(pageTarget.webSocketDebuggerUrl);
		await cdpSession.send('Page.enable');
		await cdpSession.send('Runtime.enable');
		await cdpSession.send('Page.addScriptToEvaluateOnNewDocument', {
			source: buildWebSocketLogInjection(),
		});

		logStep('navigating browser to web app root');
		await cdpSession.navigate(webBaseUrl);
		await cdpSession.evaluate(`
			window.localStorage.setItem(
				${escapeForEvaluate(runtimeConfigStorageKey)},
				JSON.stringify({
					apiKey: ${escapeForEvaluate(envState.environment.GROQ_API_KEY)},
					includePresentationBlocks: true,
					model: ${escapeForEvaluate(envState.environment.GROQ_MODEL ?? defaultModel)},
					provider: 'groq',
				})
			);
		`);

		logStep('starting local dev auth bootstrap');
		await cdpSession.navigate(
			`${webBaseUrl}/auth/dev/bootstrap?redirect_to=${encodeURIComponent(`${webBaseUrl}/chat`)}`,
		);

		await waitForCondition(
			'browser chat surface',
			async () => {
				const browserState = await readBrowserState(cdpSession);
				return browserState.pathname === '/chat' && browserState.has_textarea === true;
			},
			30_000,
		);
		logStep('chat surface is ready');

		const initialBrowserState = await readBrowserState(cdpSession);
		const configuredModel = initialBrowserState.runtime_config?.model ?? defaultModel;
		logStep('submitting browser run request');
		await cdpSession.evaluate(`
			(() => {
				const textarea = document.querySelector('textarea');
				const submitButton = document.querySelector('button[type="submit"]');

				if (!(textarea instanceof HTMLTextAreaElement) || !(submitButton instanceof HTMLButtonElement)) {
					throw new Error('Chat composer controls are missing.');
				}

				const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

				if (!valueSetter) {
					throw new Error('Textarea value setter is unavailable.');
				}

				valueSetter.call(textarea, ${escapeForEvaluate(promptText)});
				textarea.dispatchEvent(new Event('input', { bubbles: true }));
				textarea.dispatchEvent(new Event('change', { bubbles: true }));
				submitButton.click();
			})()
		`);

		await waitForCondition(
			'approval boundary in browser websocket log',
			async () => {
				const browserState = await readBrowserState(cdpSession);
				const authorityOutcome = extractAuthorityOutcome(browserState);
				return authorityOutcome.approvalBlock ? authorityOutcome : null;
			},
			60_000,
		);
		logStep('approval boundary observed in browser websocket log');

		await cdpSession.evaluate(`
			(() => {
				const approvalButton = Array.from(document.querySelectorAll('button')).find((button) =>
					button.textContent?.includes('Kabul Et') || button.textContent?.includes('Approve')
				);

				if (!(approvalButton instanceof HTMLButtonElement)) {
					throw new Error('Approval button is missing.');
				}

				approvalButton.click();
			})()
		`);
		logStep('approval button clicked');

		const finalBrowserState = await waitForCondition(
			'completed run.finished in browser websocket log',
			async () => {
				const browserState = await readBrowserState(cdpSession);
				const authorityOutcome = extractAuthorityOutcome(browserState);
				return authorityOutcome.runFinishedMessage?.payload?.final_state === 'COMPLETED'
					? browserState
					: null;
			},
			60_000,
		);
		const authorityOutcome = extractAuthorityOutcome(finalBrowserState);

		printSummary({
			browser_runtime_config_model: configuredModel,
			groq_api_key_source: envState.groq_api_key_source,
			result: 'PASS',
			scenario: {
				approval_id: authorityOutcome.approvalBlock?.payload?.approval_id ?? null,
				approval_kind: authorityOutcome.approvalBlock?.payload?.title ?? null,
				final_state: authorityOutcome.runFinishedMessage.payload.final_state,
				run_id: authorityOutcome.runFinishedMessage.payload.run_id,
				run_status: authorityOutcome.runFinishedMessage.payload.status,
				trace_id: authorityOutcome.runFinishedMessage.payload.trace_id,
			},
			ws_observation: {
				received_types: authorityOutcome.receivedMessages.map((message) => message?.type ?? 'unknown'),
				run_request_provider: authorityOutcome.runRequestMessage?.payload?.provider ?? null,
				run_request_provider_has_api_key:
					typeof authorityOutcome.runRequestMessage?.payload?.provider_config?.apiKey === 'string' &&
					authorityOutcome.runRequestMessage.payload.provider_config.apiKey.length > 0,
				run_request_model: authorityOutcome.runRequestMessage?.payload?.request?.model ?? null,
				socket_urls: sanitizeSocketUrls(finalBrowserState.ws_log?.socket_urls),
			},
		});
	} catch (error) {
		const browserState = cdpSession ? await readBrowserState(cdpSession).catch(() => null) : null;
		const authorityOutcome = browserState ? extractAuthorityOutcome(browserState) : {};
		const combinedServerLogs = `${serverProcess.stdout}\n${serverProcess.stderr}`;

		printSummary({
			browser_state: browserState
				? {
						body_text: browserState.body_text,
						href: browserState.href,
						pathname: browserState.pathname,
					}
				: null,
			error:
				error instanceof Error
					? {
							message: error.message,
							name: error.name,
						}
					: {
							message: String(error),
							name: 'UnknownError',
						},
			failure_layer: classifyFailure({
				approvalBlock: authorityOutcome.approvalBlock,
				runFinishedMessage: authorityOutcome.runFinishedMessage,
				runRequestMessage: authorityOutcome.runRequestMessage,
				serverLogs: combinedServerLogs,
			}),
			groq_api_key_source: envState.groq_api_key_source,
			result: 'FAIL',
			server_log_tail: combinedServerLogs.slice(-2000),
		});
		finalExitCode = 1;
	} finally {
		cdpSession?.close();
		if (edgeProcess) {
			await stopManagedProcess(edgeProcess);
		}
		await stopManagedProcess(webProcess);
		await stopManagedProcess(serverProcess);
		rmSync(tempRoot, { force: true, recursive: true });
		process.exit(finalExitCode);
	}
}

await main();
