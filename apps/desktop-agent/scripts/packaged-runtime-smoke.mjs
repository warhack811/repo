import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

async function fetchDevAccessToken() {
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

	return accessToken;
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
							clearTimeout(timeout);
							finished = {
								payload: { status: 'desktop_screenshot_success' },
								type: 'tool_result.proof',
							};
							resolve(finished);
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
			final_message_type: finished?.type,
			run_status: finished?.payload?.status ?? finished?.payload?.error_name,
			screenshot_succeeded: screenshotSucceeded,
			total_messages: messages.length,
		};
	} finally {
		socket.close();
		await Promise.race([waitForSocketClose(socket), delay(1000)]);
	}
}

async function killProcessTree(child) {
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

let packagedProcessExit = null;
let serverBaseUrl = externalServerBaseUrl ?? '';

function assertPackagedProcessAlive() {
	if (packagedProcessExit !== null) {
		throw new Error(
			`Packaged desktop app exited before presence proof completed (code=${
				packagedProcessExit.code ?? 'null'
			}, signal=${packagedProcessExit.signal ?? 'null'}).`,
		);
	}
}

async function main() {
	let smokeServer = null;

	if (!externalServerBaseUrl) {
		smokeServer = spawnSmokeServer();
		const readyPayload = await withTimeout(smokeServer.ready, 'packaged smoke server startup');
		serverBaseUrl = readyPayload.server_base_url;
	}

	const accessToken = await fetchDevAccessToken();
	const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'runa-desktop-packaged-smoke-'));
	const logPath = path.join(os.tmpdir(), `runa-desktop-packaged-smoke-${smokeId}.log`);

	const child = spawn(packagedExePath, ['--no-sandbox'], {
		env: {
			...process.env,
			ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
			RUNA_DESKTOP_AGENT_ACCESS_TOKEN: accessToken,
			RUNA_DESKTOP_AGENT_ID: smokeAgentId,
			RUNA_DESKTOP_AGENT_MACHINE_LABEL: 'Packaged Smoke Workstation',
			RUNA_DESKTOP_AGENT_SERVER_URL: serverBaseUrl,
			RUNA_DESKTOP_AGENT_USER_DATA_DIR: userDataDir,
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

	let stdout = '';
	let stderr = '';
	child.stdout?.on('data', (chunk) => {
		stdout += String(chunk);
	});
	child.stderr?.on('data', (chunk) => {
		stderr += String(chunk);
	});

	let device;
	let proof = null;
	let removedAfterShutdown = false;

	try {
		device = await withTimeout(waitForDevice(accessToken), 'packaged desktop presence');
		proof = await runDesktopScreenshotProof(accessToken, device.connection_id);
	} finally {
		await killProcessTree(child);
		removedAfterShutdown = await waitForDeviceRemoval(accessToken);
		if (smokeServer) {
			await killProcessTree(smokeServer.child);
		}
		await writeFile(logPath, `STDOUT\n${stdout}\n\nSTDERR\n${stderr}\n`);
	}

	const logPreview = await readFile(logPath, 'utf8');
	const summary = {
		agent_id: smokeAgentId,
		device_online: Boolean(device),
		device_removed_after_shutdown: removedAfterShutdown,
		log_path: logPath,
		packaged_exe_path: packagedExePath,
		proof,
		server_base_url: serverBaseUrl,
		stderr_preview: stderr.slice(0, 1000),
		stdout_preview: logPreview.slice(0, 1000),
	};

	console.log(`DESKTOP_PACKAGED_RUNTIME_SMOKE_SUMMARY ${JSON.stringify(summary)}`);

	if (!device || proof?.approval_resolve_sent !== true || proof?.screenshot_succeeded !== true) {
		throw new Error('Packaged desktop runtime smoke failed.');
	}

	await rm(userDataDir, { force: true, recursive: true });
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
