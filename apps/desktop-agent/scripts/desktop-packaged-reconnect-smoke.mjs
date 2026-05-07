import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const packagedExePath =
	process.env.RUNA_DESKTOP_PACKAGED_EXE ??
	path.join(packageRoot, 'release', 'win-unpacked', 'Runa Desktop.exe');
const timeoutMs = Number.parseInt(
	process.env.RUNA_DESKTOP_PACKAGED_RECONNECT_SMOKE_TIMEOUT_MS ?? '90000',
	10,
);
const downWindowMs = 2200;
const host = '127.0.0.1';
const smokeId = randomUUID();
const agentId = `runa-packaged-reconnect-${smokeId}`;

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
	throw new Error(message);
}

function waitForCondition(label, predicate, waitMs = timeoutMs) {
	const startedAt = Date.now();

	return new Promise((resolve, reject) => {
		const interval = setInterval(() => {
			if (predicate()) {
				clearInterval(interval);
				resolve(true);
				return;
			}

			if (Date.now() - startedAt > waitMs) {
				clearInterval(interval);
				reject(new Error(`${label} timed out after ${waitMs}ms`));
			}
		}, 100);
	});
}

function createAcceptKey(webSocketKey) {
	return createHash('sha1')
		.update(`${webSocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
		.digest('base64');
}

function encodeFrame(opcode, payload = Buffer.alloc(0)) {
	const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));

	if (payloadBuffer.length < 126) {
		return Buffer.concat([Buffer.from([0x80 | opcode, payloadBuffer.length]), payloadBuffer]);
	}

	if (payloadBuffer.length <= 0xffff) {
		const header = Buffer.alloc(4);
		header[0] = 0x80 | opcode;
		header[1] = 126;
		header.writeUInt16BE(payloadBuffer.length, 2);
		return Buffer.concat([header, payloadBuffer]);
	}

	const header = Buffer.alloc(10);
	header[0] = 0x80 | opcode;
	header[1] = 127;
	header.writeBigUInt64BE(BigInt(payloadBuffer.length), 2);
	return Buffer.concat([header, payloadBuffer]);
}

function encodeCloseFrame(code, reason) {
	const reasonBuffer = Buffer.from(reason);
	const payload = Buffer.alloc(2 + reasonBuffer.length);
	payload.writeUInt16BE(code, 0);
	reasonBuffer.copy(payload, 2);
	return encodeFrame(0x8, payload);
}

class MinimalWebSocketConnection {
	#buffer = Buffer.alloc(0);
	#closed = false;
	#messageHandler;
	#socket;

	constructor(socket, messageHandler) {
		this.#socket = socket;
		this.#messageHandler = messageHandler;
		socket.on('data', (chunk) => this.#handleData(chunk));
		socket.on('close', () => {
			this.#closed = true;
		});
	}

	close(code = 1000, reason = '') {
		if (this.#closed) {
			return;
		}

		this.#socket.write(encodeCloseFrame(code, reason));
		setTimeout(() => this.#socket.end(), 50).unref?.();
	}

	sendJson(message) {
		if (this.#closed) {
			return;
		}

		this.#socket.write(encodeFrame(0x1, JSON.stringify(message)));
	}

	#handleData(chunk) {
		this.#buffer = Buffer.concat([this.#buffer, chunk]);

		while (this.#buffer.length >= 2) {
			const firstByte = this.#buffer[0];
			const secondByte = this.#buffer[1];
			const opcode = firstByte & 0x0f;
			const masked = (secondByte & 0x80) !== 0;
			let payloadLength = secondByte & 0x7f;
			let offset = 2;

			if (payloadLength === 126) {
				if (this.#buffer.length < offset + 2) {
					return;
				}
				payloadLength = this.#buffer.readUInt16BE(offset);
				offset += 2;
			} else if (payloadLength === 127) {
				if (this.#buffer.length < offset + 8) {
					return;
				}
				payloadLength = Number(this.#buffer.readBigUInt64BE(offset));
				offset += 8;
			}

			if (!Number.isSafeInteger(payloadLength)) {
				this.close(1009, 'Payload too large.');
				return;
			}

			const maskOffset = offset;
			const payloadOffset = masked ? offset + 4 : offset;
			const frameLength = payloadOffset + payloadLength;

			if (this.#buffer.length < frameLength) {
				return;
			}

			let payload = this.#buffer.subarray(payloadOffset, frameLength);

			if (masked) {
				const mask = this.#buffer.subarray(maskOffset, maskOffset + 4);
				payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
			}

			this.#buffer = this.#buffer.subarray(frameLength);

			if (opcode === 0x1) {
				this.#messageHandler(payload.toString('utf8'), this);
			} else if (opcode === 0x8) {
				this.#closed = true;
				this.#socket.end();
			} else if (opcode === 0x9) {
				this.#socket.write(encodeFrame(0x0a, payload));
			}
		}
	}
}

function createHarnessServer(state, requestedPort = 0) {
	const server = http.createServer((request, response) => {
		response.writeHead(200, {
			'content-type': 'text/html; charset=utf-8',
		});
		response.end('<!doctype html><html><body>Runa packaged reconnect smoke</body></html>');
	});

	server.on('upgrade', (request, socket) => {
		if (!(socket instanceof Socket)) {
			socket.destroy();
			return;
		}

		const requestUrl = new URL(request.url ?? '/', `http://${host}`);
		if (requestUrl.pathname !== '/ws/desktop-agent') {
			socket.destroy();
			return;
		}

		const webSocketKey = request.headers['sec-websocket-key'];
		if (typeof webSocketKey !== 'string') {
			socket.destroy();
			return;
		}

		socket.write(
			[
				'HTTP/1.1 101 Switching Protocols',
				'Upgrade: websocket',
				'Connection: Upgrade',
				`Sec-WebSocket-Accept: ${createAcceptKey(webSocketKey)}`,
				'\r\n',
			].join('\r\n'),
		);

		const connection = new MinimalWebSocketConnection(socket, (rawMessage, activeConnection) => {
			const message = JSON.parse(rawMessage);

			if (message.type !== 'desktop-agent.hello') {
				return;
			}

			const connectionId = randomUUID();
			state.sessions.push({
				agent_id: message.payload?.agent_id,
				capability_count: Array.isArray(message.payload?.capabilities)
					? message.payload.capabilities.length
					: 0,
				connection_id: connectionId,
				machine_label: message.payload?.machine_label,
			});
			activeConnection.sendJson({
				payload: {
					agent_id: message.payload?.agent_id,
					capabilities: message.payload?.capabilities ?? [],
					connection_id: connectionId,
					user_id: 'packaged-reconnect-smoke-user',
				},
				type: 'desktop-agent.session.accepted',
			});
		});

		connection.sendJson({
			message: 'ready',
			transport: 'desktop_bridge',
			type: 'desktop-agent.connection.ready',
		});
		state.connections.add(connection);
		socket.on('close', () => {
			state.connections.delete(connection);
		});
	});

	return new Promise((resolve) => {
		server.listen(requestedPort, host, () => {
			const address = server.address();
			if (address === null || typeof address === 'string') {
				fail('Unable to resolve reconnect smoke harness address.');
			}

			resolve({
				closeActiveConnections(code, reason) {
					for (const connection of state.connections) {
						connection.close(code, reason);
					}
				},
				closeServer() {
					return new Promise((serverResolve) => {
						server.close(() => serverResolve());
					});
				},
				port: address.port,
			});
		});
	});
}

function waitForProcessExit(child, waitMs = 15000) {
	return new Promise((resolve) => {
		if (!child || child.exitCode !== null || child.signalCode !== null) {
			resolve(true);
			return;
		}

		const timeout = setTimeout(() => resolve(false), waitMs);
		child.once('exit', () => {
			clearTimeout(timeout);
			resolve(true);
		});
	});
}

async function requestGracefulShutdown(child, shutdownFilePath) {
	if (!child || child.exitCode !== null || child.signalCode !== null) {
		return true;
	}

	await writeFile(shutdownFilePath, new Date().toISOString(), 'utf8');
	const exited = await waitForProcessExit(child);

	if (!exited) {
		child.kill('SIGTERM');
	}

	return exited;
}

async function safeRmTempDirectory(directoryPath) {
	const resolvedPath = path.resolve(directoryPath);
	const resolvedTemp = path.resolve(os.tmpdir());

	if (!resolvedPath.startsWith(resolvedTemp + path.sep)) {
		fail(`Refusing to remove non-temp directory: ${resolvedPath}`);
	}

	await rm(resolvedPath, { force: true, recursive: true });
}

async function main() {
	if (!existsSync(packagedExePath)) {
		fail(`Packaged desktop executable was not found at ${packagedExePath}`);
	}

	const state = {
		connections: new Set(),
		sessions: [],
	};
	let harness = await createHarnessServer(state);
	const serverBaseUrl = `http://${host}:${String(harness.port)}`;
	const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'runa-packaged-reconnect-'));
	const shutdownFilePath = path.join(userDataDir, 'smoke-shutdown-request');
	let stdout = '';
	let stderr = '';
	let shutdownClean = false;

	const child = spawn(packagedExePath, ['--no-sandbox'], {
		cwd: path.dirname(packagedExePath),
		env: {
			...process.env,
			ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
			RUNA_DESKTOP_AGENT_ACCESS_TOKEN: 'packaged-reconnect-smoke-token',
			RUNA_DESKTOP_AGENT_ID: agentId,
			RUNA_DESKTOP_AGENT_MACHINE_LABEL: 'Packaged Reconnect Smoke Workstation',
			RUNA_DESKTOP_AGENT_SERVER_URL: serverBaseUrl,
			RUNA_DESKTOP_AGENT_SMOKE_SHUTDOWN_FILE: shutdownFilePath,
			RUNA_DESKTOP_AGENT_USER_DATA_DIR: userDataDir,
			RUNA_DESKTOP_WEB_URL: `${serverBaseUrl}/chat`,
		},
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});

	child.stdout?.on('data', (chunk) => {
		stdout += chunk.toString();
	});
	child.stderr?.on('data', (chunk) => {
		stderr += chunk.toString();
	});

	try {
		await waitForCondition('initial desktop bridge session', () => state.sessions.length >= 1);
		const initialSession = state.sessions[0];
		harness.closeActiveConnections(1012, 'Packaged reconnect smoke server restart.');
		await delay(100);
		await harness.closeServer();
		const restartStartedAt = Date.now();
		await delay(downWindowMs);
		harness = await createHarnessServer(state, harness.port);
		await waitForCondition('reconnected desktop bridge session', () => state.sessions.length >= 2);
		const reconnectSession = state.sessions[1];
		shutdownClean = await requestGracefulShutdown(child, shutdownFilePath);

		const summary = {
			agent_id_stable_after_reconnect:
				initialSession?.agent_id === agentId && reconnectSession?.agent_id === agentId,
			connection_id_changed_after_reconnect:
				Boolean(initialSession?.connection_id) &&
				Boolean(reconnectSession?.connection_id) &&
				initialSession.connection_id !== reconnectSession.connection_id,
			initial_capability_count: initialSession?.capability_count ?? 0,
			initial_session_accepted: Boolean(initialSession),
			packaged_app_started:
				stdout.includes('[boot:window:ready-to-show]') ||
				stdout.includes('[boot:window:did-finish-load]'),
			packaged_app_shutdown_clean: shutdownClean,
			reconnect_capability_count: reconnectSession?.capability_count ?? 0,
			reconnected_after_server_restart: Boolean(reconnectSession),
			server_down_window_ms: downWindowMs,
			server_restart_disconnect_sent: true,
			server_restart_elapsed_ms: Date.now() - restartStartedAt,
			total_sessions_accepted: state.sessions.length,
		};

		console.log(`DESKTOP_PACKAGED_RECONNECT_SMOKE_SUMMARY ${JSON.stringify(summary)}`);

		if (
			!summary.packaged_app_started ||
			!summary.initial_session_accepted ||
			!summary.reconnected_after_server_restart ||
			!summary.agent_id_stable_after_reconnect ||
			!summary.connection_id_changed_after_reconnect ||
			!summary.packaged_app_shutdown_clean
		) {
			process.exitCode = 1;
		}
	} finally {
		await requestGracefulShutdown(child, shutdownFilePath).catch(() => false);
		for (const connection of state.connections) {
			connection.close(1001, 'Packaged reconnect smoke shutdown.');
		}
		await harness.closeServer().catch(() => {});
		await safeRmTempDirectory(userDataDir).catch(() => {});

		if (process.exitCode) {
			process.stdout.write(stdout);
			process.stderr.write(stderr);
		}
	}
}

main().catch((error) => {
	console.error(
		`DESKTOP_PACKAGED_RECONNECT_SMOKE_FAILED ${
			error instanceof Error ? error.message : String(error)
		}`,
	);
	process.exitCode = 1;
});
