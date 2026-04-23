import {
	isApprovalResolveClientMessage,
	isInspectionRequestClientMessage,
	isRunRequestClientMessage,
} from '@runa/types';
import type {
	AuthContext,
	RenderBlock,
	RuntimeEvent,
	SubscriptionContext,
	UsageLimitRejection,
} from '@runa/types';

import type {
	ConnectionReadyServerMessage,
	PresentationBlocksServerMessage,
	RunAcceptedServerMessage,
	RunFinishedServerMessage,
	RunRejectedServerMessage,
	RunRequestPayload,
	RuntimeEventServerMessage,
	TextDeltaServerMessage,
	WebSocketClientMessage,
	WebSocketServerBridgeMessage,
} from './messages.js';

export interface WebSocketConnection {
	close(code?: number, reason?: string): void;
	on(event: 'close' | 'message', listener: (message?: unknown) => void): void;
	send(message: string): void;
}

interface FinishedRunResult {
	readonly error_message?: string;
	readonly final_state:
		| 'COMPLETED'
		| 'FAILED'
		| 'INIT'
		| 'MODEL_THINKING'
		| 'TOOL_EXECUTING'
		| 'TOOL_RESULT_INGESTING'
		| 'WAITING_APPROVAL';
	readonly status: 'approval_required' | 'completed' | 'failed';
}

export interface AttachWebSocketTransportOptions {
	readonly auth_context?: AuthContext;
	readonly on_message: (message: unknown) => void;
	readonly subscription_context?: SubscriptionContext;
}

const authContextsBySocket = new WeakMap<WebSocketConnection, AuthContext>();
const subscriptionContextsBySocket = new WeakMap<WebSocketConnection, SubscriptionContext>();

export function decodeSocketMessage(message: unknown): string {
	if (typeof message === 'string') {
		return message;
	}

	if (message instanceof ArrayBuffer) {
		return Buffer.from(message).toString('utf8');
	}

	if (ArrayBuffer.isView(message)) {
		return Buffer.from(message.buffer, message.byteOffset, message.byteLength).toString('utf8');
	}

	throw new Error('Unsupported WebSocket message payload.');
}

export function getErrorDetails(error: unknown): {
	readonly error_message: string;
	readonly error_name: string;
	readonly reject_reason?: UsageLimitRejection;
} {
	if (error instanceof Error) {
		const rejectReason =
			'reject_reason' in error &&
			typeof error.reject_reason === 'object' &&
			error.reject_reason !== null
				? (error.reject_reason as UsageLimitRejection)
				: undefined;

		return {
			error_message: error.message,
			error_name: error.name,
			reject_reason: rejectReason,
		};
	}

	return {
		error_message: 'Unknown WebSocket handler error.',
		error_name: 'UnknownError',
	};
}

export function sendServerMessage(
	socket: WebSocketConnection,
	message: WebSocketServerBridgeMessage,
): void {
	socket.send(JSON.stringify(message));
}

export function createReadyMessage(): ConnectionReadyServerMessage {
	return {
		message: 'ready',
		transport: 'websocket',
		type: 'connection.ready',
	};
}

export function createAcceptedMessage(payload: RunRequestPayload): RunAcceptedServerMessage {
	return {
		payload: {
			conversation_id: payload.conversation_id,
			provider: payload.provider,
			run_id: payload.run_id,
			trace_id: payload.trace_id,
		},
		type: 'run.accepted',
	};
}

export function createRuntimeEventMessage(
	payload: RunRequestPayload,
	event: RuntimeEvent,
): RuntimeEventServerMessage {
	return {
		payload: {
			event,
			run_id: payload.run_id,
			trace_id: payload.trace_id,
		},
		type: 'runtime.event',
	};
}

export function createTextDeltaMessage(
	payload: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
	textDelta: string,
): TextDeltaServerMessage {
	return {
		payload: {
			run_id: payload.run_id,
			text_delta: textDelta,
			trace_id: payload.trace_id,
		},
		type: 'text.delta',
	};
}

export function createRejectedMessage(
	error: unknown,
	context?: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
): RunRejectedServerMessage {
	const details = getErrorDetails(error);

	return {
		payload: {
			error_message: details.error_message,
			error_name: details.error_name,
			reject_reason: details.reject_reason,
			run_id: context?.run_id,
			trace_id: context?.trace_id,
		},
		type: 'run.rejected',
	};
}

export function createPresentationBlocksMessage(
	context: Readonly<{
		readonly blocks: readonly RenderBlock[];
		readonly run_id: string;
		readonly trace_id: string;
	}>,
): PresentationBlocksServerMessage {
	return {
		payload: {
			blocks: context.blocks,
			run_id: context.run_id,
			trace_id: context.trace_id,
		},
		type: 'presentation.blocks',
	};
}

export function createStandalonePresentationBlocksMessage(
	context: Readonly<{
		readonly blocks: readonly RenderBlock[];
		readonly run_id: string;
		readonly trace_id: string;
	}>,
): PresentationBlocksServerMessage {
	return createPresentationBlocksMessage(context);
}

export function createFinishedMessage(
	payload: RunRequestPayload,
	result: FinishedRunResult,
): RunFinishedServerMessage | undefined {
	if (
		result.status === 'approval_required' ||
		(result.final_state !== 'COMPLETED' && result.final_state !== 'FAILED')
	) {
		return undefined;
	}

	return {
		payload: {
			error_message: result.status === 'failed' ? result.error_message : undefined,
			final_state: result.final_state,
			run_id: payload.run_id,
			status: result.status,
			trace_id: payload.trace_id,
		},
		type: 'run.finished',
	};
}

export function parseClientMessage(message: unknown): WebSocketClientMessage {
	const parsedMessage = JSON.parse(decodeSocketMessage(message)) as unknown;

	if (
		!isRunRequestClientMessage(parsedMessage) &&
		!isApprovalResolveClientMessage(parsedMessage) &&
		!isInspectionRequestClientMessage(parsedMessage)
	) {
		throw new Error('Unsupported or invalid WebSocket message.');
	}

	return parsedMessage;
}

export function getWebSocketAuthContext(socket: WebSocketConnection): AuthContext | undefined {
	return authContextsBySocket.get(socket);
}

export function getWebSocketSubscriptionContext(
	socket: WebSocketConnection,
): SubscriptionContext | undefined {
	return subscriptionContextsBySocket.get(socket);
}

export function attachWebSocketTransport(
	socket: WebSocketConnection,
	options: AttachWebSocketTransportOptions,
): void {
	if (options.auth_context !== undefined) {
		authContextsBySocket.set(socket, options.auth_context);
	}

	if (options.subscription_context !== undefined) {
		subscriptionContextsBySocket.set(socket, options.subscription_context);
	}

	sendServerMessage(socket, createReadyMessage());
	socket.on('message', options.on_message);
}
