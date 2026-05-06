import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

const READY_TOKEN = 'DESKTOP_PACKAGED_SMOKE_SERVER_READY';
const externalServerBaseUrl = process.env.RUNA_SMOKE_SERVER_URL?.trim();
const webBaseUrl = process.env.RUNA_SMOKE_WEB_URL ?? 'http://127.0.0.1:5173';
const packagedExePath =
	process.env.RUNA_DESKTOP_PACKAGED_EXE ??
	path.join(packageRoot, 'release', 'win-unpacked', 'Runa Desktop.exe');

const smokeId = randomUUID();
const smokeAgentId = `runa-packaged-smoke-${smokeId}`;
const timeoutMs = Number.parseInt(process.env.RUNA_DESKTOP_SMOKE_TIMEOUT_MS ?? '120000', 10);

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, label) {
	let timeout;
	const timeoutPromise = new Promise((_, reject) => {
		timeout = setTimeout(
			() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
			timeoutMs,
		);
	});

	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		clearTimeout(timeout);
	}
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

function createReadyPromise(child) {
	return new Promise((resolve, reject) => {
		let stdoutBuffer = '';
		let stderrBuffer = '';
		let resolved = false;

		child.stdout.on('data', (chunk) => {
			const text = chunk.toString();
			stdoutBuffer += text;
			const lines = stdoutBuffer.split(/\r?\n/u);
			stdoutBuffer = lines.pop() ?? '';

			for (const line of lines) {
				if (!line.startsWith(`${READY_TOKEN} `)) {
					continue;
				}

				try {
					resolved = true;
					resolve(JSON.parse(line.slice(READY_TOKEN.length + 1)));
				} catch (error) {
					reject(
						new Error(
							`Failed to parse packaged smoke server ready payload: ${
								error instanceof Error ? error.message : String(error)
							}`,
						),
					);
				}
			}
		});

		child.stderr.on('data', (chunk) => {
			stderrBuffer += chunk.toString();
		});

		child.once('exit', (code, signal) => {
			if (resolved) {
				return;
			}

			reject(
				new Error(
					`Packaged smoke server exited before ready signal (code=${code ?? 'null'}, signal=${
						signal ?? 'null'
					}). stderr tail: ${stderrBuffer.slice(-1200)}`,
				),
			);
		});
	});
}

function spawnSmokeServer() {
	const command = process.platform === 'win32' ? 'node.exe' : 'node';
	const invocation = createSpawnInvocation(command, ['scripts/packaged-runtime-smoke-server.mjs']);
	const child = spawn(invocation.command, invocation.args, {
		cwd: packageRoot,
		env: process.env,
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});

	return {
		child,
		ready: createReadyPromise(child),
	};
}

async function fetchDevSession() {
	const redirectTo = `${webBaseUrl.replace(/\/$/u, '')}/chat`;
	const url = new URL('/auth/dev/bootstrap', serverBaseUrl);
	url.searchParams.set('redirect_to', redirectTo);

	const response = await fetch(url, { redirect: 'manual' });
	if (response.status < 300 || response.status >= 400) {
		throw new Error(`Dev bootstrap returned HTTP ${response.status}: ${await response.text()}`);
	}

	const location = response.headers.get('location');
	if (!location) {
		throw new Error('Dev bootstrap did not return a redirect location.');
	}

	const redirectedUrl = new URL(location, redirectTo);
	const hashParams = new URLSearchParams(redirectedUrl.hash.replace(/^#/u, ''));
	const accessToken = hashParams.get('access_token')?.trim();
	if (!accessToken) {
		throw new Error('Dev bootstrap redirect did not include access_token.');
	}

	return {
		access_token: accessToken,
		expires_at: hashParams.get('expires_at')?.trim() || undefined,
		expires_in: hashParams.get('expires_in')?.trim() || undefined,
		refresh_token: hashParams.get('refresh_token')?.trim() || undefined,
		token_type: hashParams.get('token_type')?.trim() || undefined,
	};
}

function createDesktopLoginWebUrl() {
	const redirectTo = new URL('/chat', serverBaseUrl).toString();
	const url = new URL('/auth/dev/bootstrap', serverBaseUrl);
	url.searchParams.set('redirect_to', redirectTo);
	return url.toString();
}

function createDesktopAppWebUrl() {
	return new URL('/chat', serverBaseUrl).toString();
}

async function listDevices(accessToken) {
	const response = await fetch(new URL('/desktop/devices', serverBaseUrl), {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Desktop device list returned HTTP ${response.status}: ${await response.text()}`,
		);
	}

	const payload = await response.json();
	return Array.isArray(payload.devices) ? payload.devices : [];
}

async function waitForDevice(accessToken) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		assertPackagedProcessAlive();
		const devices = await listDevices(accessToken);
		const match = devices.find((device) => device?.agent_id === smokeAgentId);
		if (match) {
			return match;
		}

		await delay(500);
	}

	throw new Error(`Packaged desktop agent did not appear in /desktop/devices: ${smokeAgentId}`);
}

async function waitForDeviceRemoval(accessToken) {
	const deadline = Date.now() + 45_000;
	while (Date.now() < deadline) {
		const devices = await listDevices(accessToken);
		if (!devices.some((device) => device?.agent_id === smokeAgentId)) {
			return true;
		}

		await delay(500);
	}

	return false;
}

async function waitForDeviceAbsence(accessToken, agentId, durationMs = 5_000) {
	const deadline = Date.now() + durationMs;
	while (Date.now() < deadline) {
		const devices = await listDevices(accessToken);
		if (devices.some((device) => device?.agent_id === agentId)) {
			return false;
		}

		await delay(500);
	}

	return true;
}

function openWebSocket(url) {
	return new Promise((resolve, reject) => {
		if (typeof WebSocket !== 'function') {
			reject(new Error('Global WebSocket is not available in this Node runtime.'));
			return;
		}

		const socket = new WebSocket(url);
		const cleanup = () => {
			socket.removeEventListener('open', onOpen);
			socket.removeEventListener('error', onError);
		};
		const onOpen = () => {
			cleanup();
			resolve(socket);
		};
		const onError = (event) => {
			cleanup();
			reject(new Error(`WebSocket connection failed: ${event.message ?? 'unknown error'}`));
		};

		socket.addEventListener('open', onOpen);
		socket.addEventListener('error', onError);
	});
}

function waitForSocketClose(socket) {
	return new Promise((resolve) => {
		socket.addEventListener('close', () => resolve(), { once: true });
	});
}

async function runDesktopScreenshotProof(accessToken, targetConnectionId) {
	const wsUrl = new URL('/ws', serverBaseUrl.replace(/^http/u, 'ws'));
	wsUrl.searchParams.set('access_token', accessToken);
	const socket = await openWebSocket(wsUrl);
	const messages = [];
	let approvalResolveSent = false;
	let approvalTargetLabelPresent = false;
	let screenshotSucceeded = false;
	let finished = null;

	const runId = `desktop-packaged-smoke-${smokeId}`;
	const traceId = `desktop-packaged-smoke-trace-${smokeId}`;

	try {
		const runFinished = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(
					new Error(
						`Desktop screenshot proof did not finish before timeout. Messages: ${JSON.stringify(
							messages.map((message) => ({
								blocks: message.payload?.blocks?.map((block) => ({
									payload: block?.payload,
									type: block?.type,
								})),
								type: message.type,
							})),
						)}`,
					),
				);
			}, timeoutMs);

			socket.addEventListener('message', (event) => {
				const message = JSON.parse(event.data);
				messages.push(message);

				if (message.type === 'presentation.blocks') {
					for (const block of message.payload?.blocks ?? []) {
						if (
							block?.type === 'approval_block' &&
							block.payload?.status === 'pending' &&
							block.payload?.approval_id &&
							!approvalResolveSent
						) {
							approvalTargetLabelPresent =
								typeof block.payload?.target_label === 'string' &&
								block.payload.target_label.trim().length > 0 &&
								block.payload.target_label !== 'desktop.screenshot';
							approvalResolveSent = true;
							socket.send(
								JSON.stringify({
									payload: {
										approval_id: block.payload.approval_id,
										decision: 'approved',
										note: 'packaged-runtime-smoke',
									},
									type: 'approval.resolve',
								}),
							);
						}

						if (
							block?.type === 'tool_result' &&
							block.payload?.tool_name === 'desktop.screenshot' &&
							block.payload?.status === 'success'
						) {
							screenshotSucceeded = true;
						}
					}
				}

				if (message.type === 'run.finished' || message.type === 'run.rejected') {
					clearTimeout(timeout);
					finished = message;
					resolve(message);
				}
			});

			socket.addEventListener('error', (event) => {
				clearTimeout(timeout);
				reject(new Error(`Proof WebSocket error: ${event.message ?? 'unknown error'}`));
			});
		});

		socket.send(
			JSON.stringify({
				payload: {
					desktop_target_connection_id: targetConnectionId,
					include_presentation_blocks: true,
					provider: 'deepseek',
					provider_config: {
						apiKey: '',
						defaultModel: 'deepseek-v4-flash',
					},
					request: {
						messages: [
							{
								content:
									'Canli paketli desktop agent testi: desktop.screenshot aracini bir kez kullan ve sonucu tek cumleyle ozetle.',
								role: 'user',
							},
						],
						model: 'deepseek-v4-flash',
						tools: [{ name: 'desktop.screenshot' }],
					},
					run_id: runId,
					trace_id: traceId,
				},
				type: 'run.request',
			}),
		);

		await runFinished;
		return {
			approval_resolve_sent: approvalResolveSent,
			approval_target_label_present: approvalTargetLabelPresent,
			final_error_code: finished?.payload?.error_code,
			final_error_message: finished?.payload?.error_message,
			final_error_name: finished?.payload?.error_name,
			final_message_type: finished?.type,
			message_types: messages.map((message) => message.type),
			run_status: finished?.payload?.status ?? finished?.payload?.error_name,
			screenshot_succeeded: screenshotSucceeded,
			total_messages: messages.length,
		};
	} finally {
		socket.close();
		await Promise.race([waitForSocketClose(socket), delay(1000)]);
	}
}

async function runCrossAccountTargetRejectionProof(accessToken, targetConnectionId) {
	if (typeof targetConnectionId !== 'string' || targetConnectionId.trim().length === 0) {
		throw new Error('Cross-account proof requires a concrete desktop target connection id.');
	}

	const wsUrl = new URL('/ws', serverBaseUrl.replace(/^http/u, 'ws'));
	wsUrl.searchParams.set('access_token', accessToken);
	const socket = await openWebSocket(wsUrl);
	const messages = [];
	let approvalResolveSent = false;
	let desktopTargetRejected = false;
	let desktopCommandRejected = false;
	let desktopTargetRejectionSummary = null;
	const toolResultBlocks = [];
	let screenshotSucceeded = false;
	let finished = null;
	const runId = `desktop-packaged-smoke-cross-account-${smokeId}`;
	const traceId = `desktop-packaged-smoke-cross-account-trace-${smokeId}`;

	try {
		const runFinished = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(
					new Error(
						`Cross-account desktop target proof did not finish before timeout. Messages: ${JSON.stringify(
							messages.map((message) => ({
								blocks: message.payload?.blocks?.map((block) => ({
									payload: block?.payload,
									type: block?.type,
								})),
								type: message.type,
							})),
						)}`,
					),
				);
			}, timeoutMs);

			socket.addEventListener('message', (event) => {
				const message = JSON.parse(event.data);
				messages.push(message);

				if (message.type === 'presentation.blocks') {
					for (const block of message.payload?.blocks ?? []) {
						if (
							block?.type === 'approval_block' &&
							block.payload?.status === 'pending' &&
							block.payload?.approval_id &&
							!approvalResolveSent
						) {
							approvalResolveSent = true;
							socket.send(
								JSON.stringify({
									payload: {
										approval_id: block.payload.approval_id,
										decision: 'approved',
										note: 'packaged-runtime-smoke-cross-account',
									},
									type: 'approval.resolve',
								}),
							);
						}

						if (
							block?.type === 'tool_result' &&
							block.payload?.tool_name === 'desktop.screenshot'
						) {
							toolResultBlocks.push({
								error_code: block.payload?.error_code,
								status: block.payload?.status,
								summary: block.payload?.summary,
								tool_name: block.payload?.tool_name,
							});

							if (block.payload?.status === 'success') {
								screenshotSucceeded = true;
							}

							if (block.payload?.status === 'error') {
								desktopCommandRejected = true;
							}

							if (
								block.payload?.status === 'error' &&
								block.payload?.error_code === 'EXECUTION_FAILED' &&
								typeof block.payload?.summary === 'string' &&
								block.payload.summary.includes(
									`No connected desktop agent is available for connection ${targetConnectionId}.`,
								)
							) {
								desktopTargetRejected = true;
								desktopTargetRejectionSummary = block.payload.summary;
							}
						}
					}
				}

				if (message.type === 'run.finished' || message.type === 'run.rejected') {
					clearTimeout(timeout);
					finished = message;
					resolve(message);
				}
			});

			socket.addEventListener('error', (event) => {
				clearTimeout(timeout);
				reject(new Error(`Cross-account proof WebSocket error: ${event.message ?? 'unknown error'}`));
			});
		});

		socket.send(
			JSON.stringify({
				payload: {
					desktop_target_connection_id: targetConnectionId,
					include_presentation_blocks: true,
					provider: 'deepseek',
					provider_config: {
						apiKey: '',
						defaultModel: 'deepseek-v4-flash',
					},
					request: {
						messages: [
							{
								content:
									'Cross-account paketli desktop testi: hedef cihaza desktop.screenshot gondermeyi dene.',
								role: 'user',
							},
						],
						model: 'deepseek-v4-flash',
						tools: [{ name: 'desktop.screenshot' }],
					},
					run_id: runId,
					trace_id: traceId,
				},
				type: 'run.request',
			}),
		);

		await runFinished;
		return {
			approval_resolve_sent: approvalResolveSent,
			cross_account_target_rejection_summary: desktopTargetRejectionSummary,
			cross_account_target_rejected:
				(desktopTargetRejected || desktopCommandRejected) && !screenshotSucceeded,
			final_message_type: finished?.type,
			message_types: messages.map((message) => message.type),
			run_status: finished?.payload?.status ?? finished?.payload?.error_name,
			screenshot_succeeded: screenshotSucceeded,
			target_connection_id: targetConnectionId,
			tool_result_blocks: toolResultBlocks,
			total_messages: messages.length,
		};
	} finally {
		socket.close();
		await Promise.race([waitForSocketClose(socket), delay(1000)]);
	}
}

async function forceKillProcessTree(child) {
	if (!child.pid) {
		return;
	}

	if (process.platform === 'win32') {
		await new Promise((resolve) => {
			const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
				stdio: 'ignore',
				windowsHide: true,
			});
			killer.on('exit', () => resolve());
			killer.on('error', () => resolve());
		});
		return;
	}

	child.kill('SIGTERM');
}

function waitForProcessExit(child, timeout = 15_000) {
	return Promise.race([
		new Promise((resolve) => {
			if (child.exitCode !== null || child.signalCode !== null) {
				resolve(true);
				return;
			}

			child.once('exit', () => resolve(true));
		}),
		delay(timeout).then(() => false),
	]);
}

async function requestGracefulShutdown(child, shutdownFilePath) {
	if (!child?.pid || child.exitCode !== null || child.signalCode !== null) {
		return;
	}

	await writeFile(shutdownFilePath, new Date().toISOString(), 'utf8');
	const exited = await waitForProcessExit(child);
	if (!exited) {
		await forceKillProcessTree(child);
	}
}

async function requestSmokeSignOut(signOutFilePath) {
	await writeFile(signOutFilePath, new Date().toISOString(), 'utf8');
	await delay(1_000);
}

async function verifyAsarIntegrityBlocksTamper(accessToken) {
	if (process.env.RUNA_DESKTOP_SKIP_ASAR_INTEGRITY_TAMPER === '1') {
		return 'skipped';
	}

	const sourceDirectory = path.dirname(packagedExePath);
	const tamperDirectory = await mkdtemp(path.join(os.tmpdir(), 'runa-desktop-asar-tamper-'));
	const tamperedAppDirectory = path.join(tamperDirectory, path.basename(sourceDirectory));
	await cp(sourceDirectory, tamperedAppDirectory, { recursive: true });
	const tamperedAsarPath = path.join(tamperedAppDirectory, 'resources', 'app.asar');
	const tamperedAsar = await open(tamperedAsarPath, 'r+');
	try {
		const headerByte = Buffer.alloc(1);
		await tamperedAsar.read(headerByte, 0, 1, 0);
		headerByte[0] = headerByte[0] ^ 0xff;
		await tamperedAsar.write(headerByte, 0, 1, 0);
	} finally {
		await tamperedAsar.close();
	}

	const tamperedExePath = path.join(tamperedAppDirectory, path.basename(packagedExePath));
	const tamperedUserDataDir = await mkdtemp(
		path.join(os.tmpdir(), 'runa-desktop-tamper-user-data-'),
	);
	const child = spawn(tamperedExePath, ['--no-sandbox'], {
		env: {
			...process.env,
			ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
			RUNA_DESKTOP_AGENT_ID: `${smokeAgentId}-tampered`,
			RUNA_DESKTOP_AGENT_MACHINE_LABEL: 'Tampered Packaged Smoke Workstation',
			RUNA_DESKTOP_AGENT_SERVER_URL: serverBaseUrl,
			RUNA_DESKTOP_WEB_URL: createDesktopAppWebUrl(),
			RUNA_DESKTOP_AGENT_USER_DATA_DIR: tamperedUserDataDir,
		},
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});

	const exitResult = await Promise.race([
		new Promise((resolve) => {
			child.once('exit', (code, signal) => {
				resolve({ code, signal });
			});
		}),
		delay(15_000).then(() => null),
	]);

	if (exitResult === null) {
		await forceKillProcessTree(child);
		await rm(tamperDirectory, {
			force: true,
			maxRetries: 5,
			recursive: true,
			retryDelay: 250,
		});
		await rm(tamperedUserDataDir, {
			force: true,
			maxRetries: 5,
			recursive: true,
			retryDelay: 250,
		});
		throw new Error('Tampered ASAR launched without being blocked by Electron fuses.');
	}

	await forceKillProcessTree(child);
	await delay(500);
	await rm(tamperDirectory, {
		force: true,
		maxRetries: 5,
		recursive: true,
		retryDelay: 250,
	});
	await rm(tamperedUserDataDir, {
		force: true,
		maxRetries: 5,
		recursive: true,
		retryDelay: 250,
	});
	return true;
}

let packagedProcessExit = null;
let serverBaseUrl = externalServerBaseUrl ?? '';
let packagedStdout = '';
let packagedStderr = '';

function assertPackagedProcessAlive() {
	if (packagedProcessExit !== null) {
		throw new Error(
			`Packaged desktop app exited before presence proof completed (code=${
				packagedProcessExit.code ?? 'null'
			}, signal=${packagedProcessExit.signal ?? 'null'}).`,
		);
	}
}

async function spawnPackagedDesktopApp(input) {
	packagedProcessExit = null;
	await rm(input.shutdownFilePath, { force: true });
	await rm(input.signOutFilePath, { force: true });
	const accessTokenEnv =
		typeof input.accessToken === 'string'
			? {
					RUNA_DESKTOP_AGENT_ACCESS_TOKEN: input.accessToken,
				}
			: {};
	const child = spawn(packagedExePath, ['--no-sandbox'], {
		env: {
			...process.env,
			...accessTokenEnv,
			ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
			RUNA_DESKTOP_AGENT_ID: input.agentId ?? smokeAgentId,
			RUNA_DESKTOP_AGENT_MACHINE_LABEL:
				input.machineLabel ?? 'Packaged Smoke Workstation',
			RUNA_DESKTOP_AGENT_SERVER_URL: serverBaseUrl,
			RUNA_DESKTOP_AGENT_SMOKE_SIGN_OUT_FILE: input.signOutFilePath,
			RUNA_DESKTOP_AGENT_SMOKE_SHUTDOWN_FILE: input.shutdownFilePath,
			RUNA_DESKTOP_AGENT_USER_DATA_DIR: input.userDataDir,
			RUNA_DESKTOP_WEB_URL: input.webUrl,
		},
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: false,
	});

	child.once('exit', (code, signal) => {
		packagedProcessExit = {
			code,
			signal,
		};
	});

	child.stdout?.on('data', (chunk) => {
		packagedStdout += String(chunk);
	});
	child.stderr?.on('data', (chunk) => {
		packagedStderr += String(chunk);
	});

	return child;
}

function didPackagedDesktopAppLoad() {
	return packagedStdout.includes('[boot:window:ready-to-show]');
}

function didPackagedDesktopUiLoad() {
	return (
		packagedStdout.includes('[boot:window:did-finish-load]') &&
		packagedStdout.includes('"mode":"web"')
	);
}

async function main() {
	let smokeServer = null;
	let secondaryAccessToken = '';

	if (!externalServerBaseUrl) {
		smokeServer = spawnSmokeServer();
		const readyPayload = await withTimeout(smokeServer.ready, 'packaged smoke server startup');
		serverBaseUrl = readyPayload.server_base_url;
		secondaryAccessToken = readyPayload.secondary_access_token ?? '';
	}

	const devSession = await fetchDevSession();
	const accessToken = devSession.access_token;
	if (!secondaryAccessToken) {
		throw new Error('Packaged smoke requires a secondary authenticated session for cross-account proof.');
	}
	const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'runa-desktop-packaged-smoke-'));
	const invalidUserDataDir = await mkdtemp(
		path.join(os.tmpdir(), 'runa-desktop-packaged-smoke-invalid-'),
	);
	const shutdownFilePath = path.join(userDataDir, 'smoke-shutdown-request');
	const signOutFilePath = path.join(userDataDir, 'smoke-sign-out-request');
	const invalidShutdownFilePath = path.join(invalidUserDataDir, 'smoke-shutdown-request');
	const invalidSignOutFilePath = path.join(invalidUserDataDir, 'smoke-sign-out-request');
	const logPath = path.join(os.tmpdir(), `runa-desktop-packaged-smoke-${smokeId}.log`);

	let device;
	let restartDevice;
	let proof = null;
	let crossAccountProof = null;
	let crossAccountDeviceHidden = false;
	let invalidTokenDidNotCreatePresence = false;
	let logoutOrSessionClearRemovedDevice = false;
	let restartAfterLogoutStayedOffline = false;
	let removedAfterFirstShutdown = false;
	let removedAfterShutdown = false;
	let asarIntegrityTamperBlocked = false;
	let firstChild = null;
	let secondChild = null;
	let logoutRestartChild = null;
	let invalidChild = null;

	try {
		const invalidAgentId = `${smokeAgentId}-invalid`;
		invalidChild = await spawnPackagedDesktopApp({
			accessToken: 'invalid.invalid.invalid',
			agentId: invalidAgentId,
			machineLabel: 'Invalid Token Packaged Smoke Workstation',
			shutdownFilePath: invalidShutdownFilePath,
			signOutFilePath: invalidSignOutFilePath,
			userDataDir: invalidUserDataDir,
			webUrl: createDesktopAppWebUrl(),
		});
		invalidTokenDidNotCreatePresence = await waitForDeviceAbsence(
			accessToken,
			invalidAgentId,
			5_000,
		);
		await requestGracefulShutdown(invalidChild, invalidShutdownFilePath);
		invalidChild = null;

		firstChild = await spawnPackagedDesktopApp({
			shutdownFilePath,
			signOutFilePath,
			userDataDir,
			webUrl: createDesktopLoginWebUrl(),
		});
		device = await withTimeout(waitForDevice(accessToken), 'packaged desktop presence');
		crossAccountDeviceHidden = !(await listDevices(secondaryAccessToken)).some(
			(visibleDevice) => visibleDevice?.agent_id === smokeAgentId,
		);
		removedAfterFirstShutdown = false;
		await requestGracefulShutdown(firstChild, shutdownFilePath);
		firstChild = null;
		removedAfterFirstShutdown = await waitForDeviceRemoval(accessToken);
		secondChild = await spawnPackagedDesktopApp({
			shutdownFilePath,
			signOutFilePath,
			userDataDir,
			webUrl: createDesktopAppWebUrl(),
		});
		restartDevice = await withTimeout(
			waitForDevice(accessToken),
			'packaged desktop restart presence',
		);
		proof = await runDesktopScreenshotProof(accessToken, restartDevice.connection_id);
		crossAccountProof = await runCrossAccountTargetRejectionProof(
			secondaryAccessToken,
			restartDevice.connection_id,
		);
		await requestSmokeSignOut(signOutFilePath);
		logoutOrSessionClearRemovedDevice = await waitForDeviceRemoval(accessToken);
		await requestGracefulShutdown(secondChild, shutdownFilePath);
		secondChild = null;
		logoutRestartChild = await spawnPackagedDesktopApp({
			shutdownFilePath,
			signOutFilePath,
			userDataDir,
			webUrl: createDesktopAppWebUrl(),
		});
		restartAfterLogoutStayedOffline = await waitForDeviceAbsence(
			accessToken,
			smokeAgentId,
			5_000,
		);
	} finally {
		if (invalidChild) {
			await requestGracefulShutdown(invalidChild, invalidShutdownFilePath);
		}
		if (firstChild) {
			await requestGracefulShutdown(firstChild, shutdownFilePath);
		}
		if (secondChild) {
			await requestGracefulShutdown(secondChild, shutdownFilePath);
		}
		if (logoutRestartChild) {
			await requestGracefulShutdown(logoutRestartChild, shutdownFilePath);
		}
		removedAfterShutdown = await waitForDeviceRemoval(accessToken);
		if (smokeServer) {
			await forceKillProcessTree(smokeServer.child);
		}
		await writeFile(logPath, `STDOUT\n${packagedStdout}\n\nSTDERR\n${packagedStderr}\n`);
	}

	asarIntegrityTamperBlocked = await verifyAsarIntegrityBlocksTamper(accessToken);

	const logPreview = await readFile(logPath, 'utf8');
	const summary = {
		agent_id: smokeAgentId,
		approval_resolve_sent: proof?.approval_resolve_sent === true,
		approval_target_label_present: proof?.approval_target_label_present === true,
		asar_integrity_tamper_blocked: asarIntegrityTamperBlocked,
		cross_account_device_hidden: crossAccountDeviceHidden,
		cross_account_proof: crossAccountProof,
		cross_account_target_rejected: crossAccountProof?.cross_account_target_rejected === true,
		desktop_app_loaded: didPackagedDesktopAppLoad(),
		desktop_ui_loaded: didPackagedDesktopUiLoad(),
		device_online: Boolean(device),
		device_identity_stable_after_restart:
			Boolean(device?.agent_id) && device?.agent_id === restartDevice?.agent_id,
		device_removed_after_shutdown: removedAfterShutdown,
		first_shutdown_removed_device: removedAfterFirstShutdown,
		final_message_type: proof?.final_message_type,
		expired_or_cleared_session_did_not_reconnect: restartAfterLogoutStayedOffline,
		invalid_token_did_not_create_presence: invalidTokenDidNotCreatePresence,
		login_or_session_bound: Boolean(device) && !process.env.RUNA_DESKTOP_AGENT_ACCESS_TOKEN,
		logout_or_session_clear_removed_device: logoutOrSessionClearRemovedDevice,
		log_path: logPath,
		packaged_exe_path: packagedExePath,
		proof,
		production_style_session_bound: Boolean(device) && !process.env.RUNA_DESKTOP_AGENT_ACCESS_TOKEN,
		restart_reconnected: Boolean(restartDevice),
		restart_after_logout_stayed_offline: restartAfterLogoutStayedOffline,
		run_status: proof?.run_status,
		same_account_remote_client_saw_device: Boolean(device),
		screenshot_succeeded: proof?.screenshot_succeeded === true,
		server_base_url: serverBaseUrl,
		stderr_preview: packagedStderr.slice(0, 1000),
		stdout_preview: logPreview.slice(0, 1000),
	};

	console.log(`DESKTOP_PACKAGED_RUNTIME_SMOKE_SUMMARY ${JSON.stringify(summary)}`);

	if (
		!device ||
		!restartDevice ||
		summary.desktop_app_loaded !== true ||
		summary.desktop_ui_loaded !== true ||
		summary.login_or_session_bound !== true ||
		summary.production_style_session_bound !== true ||
		summary.invalid_token_did_not_create_presence !== true ||
		summary.same_account_remote_client_saw_device !== true ||
		summary.cross_account_device_hidden !== true ||
		summary.cross_account_target_rejected !== true ||
		summary.approval_target_label_present !== true ||
		summary.restart_reconnected !== true ||
		summary.device_identity_stable_after_restart !== true ||
		summary.logout_or_session_clear_removed_device !== true ||
		summary.restart_after_logout_stayed_offline !== true ||
		summary.expired_or_cleared_session_did_not_reconnect !== true ||
		proof?.approval_resolve_sent !== true ||
		proof?.screenshot_succeeded !== true ||
		removedAfterFirstShutdown !== true ||
		removedAfterShutdown !== true ||
		asarIntegrityTamperBlocked !== true
	) {
		throw new Error('Packaged desktop runtime smoke failed.');
	}

	await rm(userDataDir, { force: true, recursive: true });
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
