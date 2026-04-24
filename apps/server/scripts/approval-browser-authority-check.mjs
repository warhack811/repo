import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const defaultModel = 'llama-3.1-8b-instant';
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const debugLogPath = process.env.RUNA_APPROVAL_BROWSER_DEBUG_LOG?.trim() || undefined;
const promptVariants = {
	package_json_list: {
		id: 'package_json_list',
		prompt:
			'Tool kullanarak mevcut klasordeki dosyalari listele ve yalnizca "package.json var" ya da "package.json yok" diye yanit ver.',
	},
	readme_file_read_probe: {
		id: 'readme_file_read_probe',
		prompt:
			'Mevcut klasorde README.md varsa file.read ile oku ve yalnizca projenin adini ya da README yoksa "README yok" diye yanit ver.',
	},
};
const toolModeVariants = {
	full_registry: 'full_registry',
	minimal_authority: 'minimal_authority',
};

function printSummary(summary) {
	process.stdout.write(`${summaryToken} ${JSON.stringify(summary)}\n`);
	writeDebugLog(`${summaryToken} ${JSON.stringify(summary)}`);
}

function logStep(message) {
	process.stdout.write(`[approval-browser-authority] ${message}\n`);
	writeDebugLog(`[approval-browser-authority] ${message}`);
}

function writeDebugLog(message) {
	if (!debugLogPath) {
		return;
	}

	try {
		appendFileSync(debugLogPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
	} catch {}
}

process.on('uncaughtException', (error) => {
	writeDebugLog(
		`uncaughtException ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
	);
});

process.on('unhandledRejection', (reason) => {
	writeDebugLog(
		`unhandledRejection ${reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)}`,
	);
});

async function sleep(durationMs) {
	await new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));
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
		if (
			this.socket.readyState === WebSocket.OPEN ||
			this.socket.readyState === WebSocket.CONNECTING
		) {
			this.socket.close();
		}
	}
}

function buildWebSocketLogInjection() {
	const requestOverrides = {
		request: buildAuthorityRequestOverrides(),
	};

	return `
		(() => {
			if (window.__RUNA_WS_LOG__) {
				return;
			}
			const requestOverrides = ${JSON.stringify(requestOverrides)};
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
					let rewrittenValue = rawValue;

					try {
						const parsed = JSON.parse(rawValue);

						if (
							parsed?.type === 'run.request' &&
							parsed.payload &&
							typeof parsed.payload === 'object' &&
							parsed.payload.request &&
							typeof parsed.payload.request === 'object' &&
							requestOverrides.request &&
							typeof requestOverrides.request === 'object'
						) {
							parsed.payload.request = {
								...parsed.payload.request,
								...requestOverrides.request,
							};
							rewrittenValue = JSON.stringify(parsed);
						}
					} catch {}

					log.sent.push(toLoggedPayload(rewrittenValue));
					return nativeSend(rewrittenValue);
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

function resolvePromptVariant() {
	const requestedVariant = process.env.RUNA_APPROVAL_BROWSER_PROMPT_VARIANT?.trim();

	if (!requestedVariant) {
		return promptVariants.package_json_list;
	}

	return (
		promptVariants[requestedVariant] ?? {
			id: requestedVariant,
			prompt: requestedVariant,
		}
	);
}

function resolveToolMode() {
	const requestedMode = process.env.RUNA_APPROVAL_BROWSER_TOOL_MODE?.trim();

	if (!requestedMode) {
		return toolModeVariants.minimal_authority;
	}

	return requestedMode;
}

function buildMinimalAuthorityAvailableTools() {
	const promptVariant = resolvePromptVariant();

	switch (promptVariant.id) {
		case 'readme_file_read_probe':
			return [
				{
					description: 'Reads a text file from the local workspace and returns its contents.',
					name: 'file.read',
					parameters: {
						encoding: {
							description: 'Optional text encoding.',
							type: 'string',
						},
						path: {
							description: 'Path to read.',
							required: true,
							type: 'string',
						},
					},
				},
			];
		default:
			return [
				{
					description:
						'Lists the entries in a local workspace directory with deterministic ordering.',
					name: 'file.list',
					parameters: {
						include_hidden: {
							description: 'Whether hidden files and directories should be listed.',
							type: 'boolean',
						},
						path: {
							description: 'Directory path to list.',
							required: true,
							type: 'string',
						},
					},
				},
			];
	}
}

function buildAuthorityRequestOverrides() {
	if (resolveToolMode() !== toolModeVariants.minimal_authority) {
		return undefined;
	}

	return {
		available_tools: buildMinimalAuthorityAvailableTools(),
		max_output_tokens: 64,
	};
}

function summarizeRunRequestPayload(payload) {
	if (!payload || typeof payload !== 'object') {
		return null;
	}

	const request = payload.request;
	const firstMessage =
		request && typeof request === 'object' && Array.isArray(request.messages)
			? request.messages[0]
			: null;

	return {
		available_tool_count:
			request && typeof request === 'object' && Array.isArray(request.available_tools)
				? request.available_tools.length
				: null,
		available_tool_names:
			request && typeof request === 'object' && Array.isArray(request.available_tools)
				? request.available_tools.map((tool) =>
						tool && typeof tool === 'object' && typeof tool.name === 'string'
							? tool.name
							: 'unknown',
					)
				: [],
		include_presentation_blocks: payload.include_presentation_blocks === true,
		model:
			request && typeof request === 'object' && typeof request.model === 'string'
				? request.model
				: null,
		provider: typeof payload.provider === 'string' ? payload.provider : null,
		provider_has_api_key:
			typeof payload.provider_config?.apiKey === 'string' &&
			payload.provider_config.apiKey.trim().length > 0,
		user_message_preview:
			firstMessage && typeof firstMessage === 'object' && typeof firstMessage.content === 'string'
				? firstMessage.content.slice(0, 160)
				: null,
	};
}

function parseProviderErrorDebugPayloads(serverLogs) {
	const payloads = [];

	for (const rawLine of serverLogs.split(/\r?\n/u)) {
		const line = rawLine.trim();

		if (!line.startsWith('[provider.error.debug] ')) {
			continue;
		}

		const serializedPayload = line.slice('[provider.error.debug] '.length);

		try {
			payloads.push(JSON.parse(serializedPayload));
		} catch {
			payloads.push({
				parse_error: 'invalid_provider_error_debug_json',
				raw: serializedPayload,
			});
		}
	}

	return payloads;
}

function summarizeProviderErrorDebugPayload(payload) {
	if (!payload || typeof payload !== 'object') {
		return null;
	}

	return {
		provider: typeof payload.provider === 'string' ? payload.provider : null,
		request_summary:
			payload.request_summary && typeof payload.request_summary === 'object'
				? payload.request_summary
				: null,
		response_body: typeof payload.response_body === 'string' ? payload.response_body : null,
		status_code: typeof payload.status_code === 'number' ? payload.status_code : null,
	};
}

function findLastMatchingEntry(entries, predicate) {
	if (!Array.isArray(entries)) {
		return undefined;
	}

	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];

		if (predicate(entry) === true) {
			return entry;
		}
	}

	return undefined;
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
	const runFinishedMessage = findLastMatchingEntry(
		receivedMessages,
		(message) => message?.type === 'run.finished',
	);
	const runId = runFinishedMessage?.payload?.run_id;
	const runRequestMessage =
		findLastMatchingEntry(
			sentMessages,
			(message) =>
				message?.type === 'run.request' &&
				(typeof runId !== 'string' || message?.payload?.run_id === runId),
		) ?? findLastMatchingEntry(sentMessages, (message) => message?.type === 'run.request');
	const approvalMessage =
		findLastMatchingEntry(
			receivedMessages,
			(message) =>
				message?.type === 'presentation.blocks' &&
				(typeof runId !== 'string' || message.payload?.run_id === runId) &&
				Array.isArray(message.payload?.blocks) &&
				message.payload.blocks.some(
					(block) => block?.type === 'approval_block' && block?.payload?.status === 'pending',
				),
		) ??
		findLastMatchingEntry(
			receivedMessages,
			(message) =>
				message?.type === 'presentation.blocks' &&
				Array.isArray(message.payload?.blocks) &&
				message.payload.blocks.some(
					(block) => block?.type === 'approval_block' && block?.payload?.status === 'pending',
				),
		);
	const approvalBlock = approvalMessage?.payload?.blocks?.find(
		(block) => block?.type === 'approval_block',
	);
	const approvalResolveMessage =
		findLastMatchingEntry(
			sentMessages,
			(message) =>
				message?.type === 'approval.resolve' &&
				(typeof approvalBlock?.payload?.approval_id !== 'string' ||
					message?.payload?.approval_id === approvalBlock.payload.approval_id),
		) ?? findLastMatchingEntry(sentMessages, (message) => message?.type === 'approval.resolve');

	return {
		approvalBlock,
		approvalMessage,
		approvalResolveMessage,
		receivedMessages,
		runFinishedMessage,
		runRequestMessage,
		sentMessages,
	};
}

function summarizeBrowserChain(authorityOutcome) {
	const runId =
		authorityOutcome.runFinishedMessage?.payload?.run_id ??
		authorityOutcome.approvalMessage?.payload?.run_id ??
		null;
	const receivedMessages = Array.isArray(authorityOutcome.receivedMessages)
		? authorityOutcome.receivedMessages
		: [];
	const continuationSignalTypes = receivedMessages
		.filter((message) => {
			if (typeof runId === 'string' && message?.payload?.run_id !== runId) {
				return false;
			}

			return (
				message?.type === 'presentation.blocks' ||
				message?.type === 'run.finished' ||
				message?.type === 'runtime.event'
			);
		})
		.map((message) => message?.type ?? 'unknown');

	return {
		approval_boundary_observed: Boolean(authorityOutcome.approvalBlock),
		approval_resolve_sent: Boolean(authorityOutcome.approvalResolveMessage),
		continuation_observed:
			continuationSignalTypes.length > 0 &&
			(authorityOutcome.runFinishedMessage !== undefined ||
				continuationSignalTypes.some((type) => type === 'runtime.event')),
		continuation_signal_types: Array.from(new Set(continuationSignalTypes)),
		reconnect_restart_tolerated: false,
		terminal_run_finished_completed:
			authorityOutcome.runFinishedMessage?.payload?.final_state === 'COMPLETED',
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

	if (
		input.serverLogs.includes('[provider.error.debug]') ||
		input.serverLogs.includes('groq returned HTTP')
	) {
		return 'provider_response_error';
	}

	if (input.approvalBlock && !input.runFinishedMessage) {
		return 'ws_runtime_continuation_regression';
	}

	return 'browser_runtime_config_drift';
}

async function main() {
	writeDebugLog('main.entered');
	const envState = createLoadedEnvironment();
	const promptVariant = resolvePromptVariant();
	const toolMode = resolveToolMode();
	let finalExitCode = 0;

	if (envState.groq_api_key_source === 'missing') {
		printSummary({
			groq_api_key_source: 'missing',
			prompt_variant: promptVariant.id,
			result: 'BLOCKED',
			reason: 'credential_missing',
			shell_groq_api_key_present: envState.shell_groq_api_key_present,
			file_backed_groq_api_key_present: envState.file_backed_groq_api_key_present,
			tool_mode: toolMode,
		});
		finalExitCode = 2;
		process.exit(finalExitCode);
		return;
	}

	if (!existsSync(edgePath)) {
		printSummary({
			groq_api_key_source: envState.groq_api_key_source,
			prompt_variant: promptVariant.id,
			result: 'BLOCKED',
			reason: 'browser_unavailable',
			tool_mode: toolMode,
		});
		finalExitCode = 2;
		process.exit(finalExitCode);
		return;
	}

	const tempRoot = mkdtempSync(resolve(os.tmpdir(), 'runa-browser-authority-'));
	const edgeUserDataDir = resolve(tempRoot, 'edge-profile');
	const serverEntryPath = resolve(serverRoot, 'dist', 'index.js');
	const serverProcess = spawnManagedProcess({
		args: [serverEntryPath],
		command: process.execPath,
		cwd: workspaceRoot,
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
		const pageTarget = targets.find(
			(target) => target.type === 'page' && target.webSocketDebuggerUrl,
		);

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

		await waitForCondition(
			'browser websocket ready state',
			async () => {
				const browserState = await readBrowserState(cdpSession);
				const receivedMessages = Array.isArray(browserState.ws_log?.received)
					? browserState.ws_log.received
					: [];
				return receivedMessages.some((message) => message?.type === 'connection.ready');
			},
			30_000,
		);
		logStep('browser websocket ready observed');

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

				valueSetter.call(textarea, ${escapeForEvaluate(promptVariant.prompt)});
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
		await sleep(750);
		logStep('approval boundary stabilized before resolve');

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
			chain: summarizeBrowserChain(authorityOutcome),
			groq_api_key_source: envState.groq_api_key_source,
			prompt_variant: promptVariant.id,
			result: 'PASS',
			scenario: {
				scenario_id: 'browser_authority_live',
				approval_id: authorityOutcome.approvalBlock?.payload?.approval_id ?? null,
				approval_kind: authorityOutcome.approvalBlock?.payload?.title ?? null,
				final_state: authorityOutcome.runFinishedMessage.payload.final_state,
				run_id: authorityOutcome.runFinishedMessage.payload.run_id,
				run_status: authorityOutcome.runFinishedMessage.payload.status,
				trace_id: authorityOutcome.runFinishedMessage.payload.trace_id,
			},
			ws_observation: {
				received_types: authorityOutcome.receivedMessages.map(
					(message) => message?.type ?? 'unknown',
				),
				run_request: summarizeRunRequestPayload(authorityOutcome.runRequestMessage?.payload),
				socket_urls: sanitizeSocketUrls(finalBrowserState.ws_log?.socket_urls),
			},
			tool_mode: toolMode,
		});
	} catch (error) {
		const browserState = cdpSession ? await readBrowserState(cdpSession).catch(() => null) : null;
		const authorityOutcome = browserState ? extractAuthorityOutcome(browserState) : {};
		const combinedServerLogs = `${serverProcess.stdout}\n${serverProcess.stderr}`;
		const providerErrorDebugPayloads = parseProviderErrorDebugPayloads(combinedServerLogs);
		const lastProviderErrorDebugPayload =
			providerErrorDebugPayloads.length > 0
				? providerErrorDebugPayloads[providerErrorDebugPayloads.length - 1]
				: null;

		printSummary({
			browser_state: browserState
				? {
						body_text: browserState.body_text,
						href: browserState.href,
						pathname: browserState.pathname,
					}
				: null,
			chain: summarizeBrowserChain(authorityOutcome),
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
			provider_error_debug: summarizeProviderErrorDebugPayload(lastProviderErrorDebugPayload),
			prompt_variant: promptVariant.id,
			result: 'FAIL',
			ws_observation: {
				received_types:
					authorityOutcome.receivedMessages?.map((message) => message?.type ?? 'unknown') ?? [],
				run_request: summarizeRunRequestPayload(authorityOutcome.runRequestMessage?.payload),
				socket_urls: sanitizeSocketUrls(browserState?.ws_log?.socket_urls),
			},
			server_log_tail: combinedServerLogs.slice(-2000),
			tool_mode: toolMode,
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
