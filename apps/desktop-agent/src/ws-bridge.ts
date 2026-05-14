import {
	type DesktopAgentClientMessage,
	type DesktopAgentConnectionReadyServerMessage,
	type DesktopAgentExecuteServerMessage,
	type DesktopAgentHeartbeatPingServerMessage,
	type DesktopAgentHeartbeatPongClientMessage,
	type DesktopAgentHelloClientMessage,
	type DesktopAgentRejectedServerMessage,
	type DesktopAgentResultClientMessage,
	type DesktopAgentServerMessage,
	type DesktopAgentSessionAcceptedServerMessage,
	desktopAgentProtocolVersion,
	desktopAgentToolNames,
	isDesktopAgentConnectionReadyServerMessage,
	isDesktopAgentExecuteServerMessage,
	isDesktopAgentHeartbeatPingServerMessage,
	isDesktopAgentRejectedServerMessage,
	isDesktopAgentServerMessage,
	isDesktopAgentSessionAcceptedServerMessage,
} from '@runa/types';

import { executeDesktopAgentLaunch } from './app-launcher.js';
import { requestDesktopAgentWebSocketTicket, type DesktopAgentAuthFetch, type DesktopAgentConfig } from './auth.js';
import {
	executeDesktopAgentClipboardRead,
	executeDesktopAgentClipboardWrite,
} from './clipboard.js';
import { executeDesktopAgentInput } from './input.js';
import { type DesktopAgentScreenshotPayload, captureDesktopScreenshot } from './screenshot.js';

const DESKTOP_AGENT_HANDSHAKE_TIMEOUT_MS = 15_000;

export const desktopAgentImplementedCapabilities = desktopAgentToolNames.map((toolName) => ({
	tool_name: toolName,
}));

export interface DesktopAgentBridgeOptions extends DesktopAgentConfig {
	readonly auth_fetch?: DesktopAgentAuthFetch;
	readonly capture_screenshot?: () => Promise<DesktopAgentScreenshotPayload>;
	readonly web_socket_factory?: (url: string) => WebSocket;
}

export interface DesktopAgentBridgeSession {
	close(code?: number, reason?: string): void;
	readonly socket: WebSocket;
}

function sendClientMessage(socket: WebSocket, message: DesktopAgentClientMessage): void {
	socket.send(JSON.stringify(message));
}

function createHelloMessage(options: DesktopAgentBridgeOptions): DesktopAgentHelloClientMessage {
	return {
		payload: {
			agent_id: options.agent_id,
			capabilities: desktopAgentImplementedCapabilities,
			machine_label: options.machine_label,
			protocol_version: desktopAgentProtocolVersion,
		},
		type: 'desktop-agent.hello',
	};
}

function createResultMessage(
	request_id: string,
	call_id: string,
	tool_name: DesktopAgentExecuteServerMessage['payload']['tool_name'],
	result:
		| {
				readonly status: 'error';
				readonly details?: Readonly<Record<string, unknown>>;
				readonly error_code:
					| 'EXECUTION_FAILED'
					| 'INVALID_INPUT'
					| 'NOT_FOUND'
					| 'PERMISSION_DENIED'
					| 'TIMEOUT'
					| 'UNKNOWN';
				readonly error_message: string;
				readonly retryable?: boolean;
		  }
		| {
				readonly metadata?: Readonly<Record<string, unknown>>;
				readonly output: unknown;
				readonly status: 'success';
		  },
): DesktopAgentResultClientMessage {
	return {
		payload: {
			call_id,
			request_id,
			tool_name,
			...result,
		},
		type: 'desktop-agent.result',
	};
}

function createHeartbeatPongMessage(
	ping: DesktopAgentHeartbeatPingServerMessage,
): DesktopAgentHeartbeatPongClientMessage {
	return {
		payload: {
			ping_id: ping.payload.ping_id,
			received_at: new Date().toISOString(),
		},
		type: 'desktop-agent.heartbeat.pong',
	};
}

async function waitForServerMessage(
	socket: WebSocket,
	guard:
		| ((message: DesktopAgentServerMessage) => message is DesktopAgentConnectionReadyServerMessage)
		| ((message: DesktopAgentServerMessage) => message is DesktopAgentSessionAcceptedServerMessage),
): Promise<DesktopAgentConnectionReadyServerMessage | DesktopAgentSessionAcceptedServerMessage> {
	return await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error('Desktop agent bridge handshake timed out.'));
		}, DESKTOP_AGENT_HANDSHAKE_TIMEOUT_MS);
		const cleanup = () => {
			clearTimeout(timeout);
			socket.removeEventListener('close', handleClose);
			socket.removeEventListener('error', handleError);
			socket.removeEventListener('message', handleMessage);
		};

		const handleClose = (event: CloseEvent) => {
			cleanup();
			reject(new Error(`Desktop agent bridge closed: ${event.reason || String(event.code)}`));
		};

		const handleError = () => {
			cleanup();
			reject(new Error('Desktop agent bridge socket error.'));
		};

		const handleMessage = (event: MessageEvent) => {
			try {
				const parsedMessage = JSON.parse(String(event.data)) as DesktopAgentServerMessage;

				if (!isDesktopAgentServerMessage(parsedMessage)) {
					throw new Error('Desktop agent bridge received an invalid server message.');
				}

				if (isDesktopAgentRejectedServerMessage(parsedMessage)) {
					throw new Error(parsedMessage.payload.error_message);
				}

				if (guard(parsedMessage)) {
					cleanup();
					resolve(parsedMessage);
				}
			} catch (error: unknown) {
				cleanup();
				reject(error);
			}
		};

		socket.addEventListener('close', handleClose, { once: true });
		socket.addEventListener('error', handleError, { once: true });
		socket.addEventListener('message', handleMessage);
	});
}

async function waitForSocketOpen(socket: WebSocket): Promise<void> {
	return await new Promise((resolve, reject) => {
		const cleanup = () => {
			socket.removeEventListener('error', handleError);
			socket.removeEventListener('open', handleOpen);
		};
		const handleOpen = () => {
			cleanup();
			resolve();
		};
		const handleError = () => {
			cleanup();
			reject(new Error('Desktop agent bridge failed to connect.'));
		};

		socket.addEventListener('open', handleOpen, { once: true });
		socket.addEventListener('error', handleError, { once: true });
	});
}

async function handleExecuteMessage(
	socket: WebSocket,
	message: DesktopAgentExecuteServerMessage,
	captureScreenshot: () => Promise<DesktopAgentScreenshotPayload>,
): Promise<void> {
	try {
		switch (message.payload.tool_name) {
			case 'desktop.screenshot': {
				const screenshot = await captureScreenshot();
				sendClientMessage(
					socket,
					createResultMessage(
						message.payload.request_id,
						message.payload.call_id,
						message.payload.tool_name,
						{
							output: screenshot,
							status: 'success',
						},
					),
				);
				return;
			}
			case 'desktop.click':
			case 'desktop.keypress':
			case 'desktop.scroll':
			case 'desktop.type': {
				const result = await executeDesktopAgentInput(
					message.payload.tool_name,
					message.payload.arguments,
				);
				sendClientMessage(
					socket,
					createResultMessage(
						message.payload.request_id,
						message.payload.call_id,
						message.payload.tool_name,
						result,
					),
				);
				return;
			}
			case 'desktop.clipboard.read': {
				const result = await executeDesktopAgentClipboardRead(message.payload.arguments);
				sendClientMessage(
					socket,
					createResultMessage(
						message.payload.request_id,
						message.payload.call_id,
						message.payload.tool_name,
						result,
					),
				);
				return;
			}
			case 'desktop.clipboard.write': {
				const result = await executeDesktopAgentClipboardWrite(message.payload.arguments);
				sendClientMessage(
					socket,
					createResultMessage(
						message.payload.request_id,
						message.payload.call_id,
						message.payload.tool_name,
						result,
					),
				);
				return;
			}
			case 'desktop.launch': {
				const result = await executeDesktopAgentLaunch(message.payload.arguments);
				sendClientMessage(
					socket,
					createResultMessage(
						message.payload.request_id,
						message.payload.call_id,
						message.payload.tool_name,
						result,
					),
				);
				return;
			}
			default:
				sendClientMessage(
					socket,
					createResultMessage(
						message.payload.request_id,
						message.payload.call_id,
						message.payload.tool_name,
						{
							details: {
								reason: 'unsupported_capability',
							},
							error_code: 'INVALID_INPUT',
							error_message: `Desktop agent has not implemented ${message.payload.tool_name} yet.`,
							retryable: false,
							status: 'error',
						},
					),
				);
		}
	} catch (error: unknown) {
		sendClientMessage(
			socket,
			createResultMessage(
				message.payload.request_id,
				message.payload.call_id,
				message.payload.tool_name,
				{
					details: {
						reason:
							message.payload.tool_name === 'desktop.screenshot'
								? 'desktop_capture_failed'
								: 'desktop_input_failed',
					},
					error_code: 'EXECUTION_FAILED',
					error_message:
						error instanceof Error
							? error.message
							: message.payload.tool_name === 'desktop.screenshot'
								? 'Desktop agent screenshot capture failed.'
								: `Desktop agent ${message.payload.tool_name} execution failed.`,
					retryable: false,
					status: 'error',
				},
			),
		);
	}
}

export async function startDesktopAgentBridge(
	options: DesktopAgentBridgeOptions,
): Promise<DesktopAgentBridgeSession> {
	const socketFactory = options.web_socket_factory ?? ((url: string) => new WebSocket(url));
	const bridgeUrl = new URL(options.server_url);
	const wsTicket = await requestDesktopAgentWebSocketTicket({
		access_token: options.access_token,
		auth_fetch: options.auth_fetch,
		server_url: options.server_url,
	});

	bridgeUrl.searchParams.set('ws_ticket', wsTicket.ws_ticket);

	const socket = socketFactory(bridgeUrl.toString());
	const connectionReadyPromise = waitForServerMessage(
		socket,
		isDesktopAgentConnectionReadyServerMessage,
	);
	let connectionReadyHandled = false;

	try {
		await waitForSocketOpen(socket);
		await connectionReadyPromise;
		connectionReadyHandled = true;
	} finally {
		if (!connectionReadyHandled) {
			connectionReadyPromise.catch(() => {});
		}
	}

	const sessionAcceptedPromise = waitForServerMessage(
		socket,
		isDesktopAgentSessionAcceptedServerMessage,
	);
	sendClientMessage(socket, createHelloMessage(options));
	await sessionAcceptedPromise;

	const captureScreenshot = options.capture_screenshot ?? captureDesktopScreenshot;

	socket.addEventListener('message', (event) => {
		try {
			const parsedMessage = JSON.parse(String(event.data)) as DesktopAgentServerMessage;

			if (!isDesktopAgentServerMessage(parsedMessage)) {
				socket.close(1008, 'Desktop agent bridge received an invalid server message.');
				return;
			}

			if (isDesktopAgentExecuteServerMessage(parsedMessage)) {
				void handleExecuteMessage(socket, parsedMessage, captureScreenshot);
			}

			if (isDesktopAgentHeartbeatPingServerMessage(parsedMessage)) {
				sendClientMessage(socket, createHeartbeatPongMessage(parsedMessage));
			}

			if (isDesktopAgentRejectedServerMessage(parsedMessage)) {
				socket.close(1011, parsedMessage.payload.error_message);
			}
		} catch {
			socket.close(1008, 'Desktop agent bridge received an invalid server message.');
		}
	});

	return {
		close(code?: number, reason?: string) {
			socket.close(code, reason);
		},
		socket,
	};
}
