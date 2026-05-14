import type { RunRequestPayload, WebSocketClientMessage } from './messages.js';

import { defaultApprovalStore } from '../persistence/approval-store.js';
import { handleApprovalResolveMessage } from './approval-handlers.js';
import { handleInspectionRequestMessage } from './inspection-handlers.js';
import type { RuntimeWebSocketHandlerOptions } from './orchestration-types.js';
import {
	type CancelRunPayload,
	handleCancelRunMessage,
	handleRunRequestMessage,
} from './run-execution.js';
import {
	type WebSocketConnection,
	createRejectedMessage,
	decodeSocketMessage,
	parseClientMessage,
	sendServerMessage,
} from './transport.js';

export type {
	RunToolWebSocketResult,
	RuntimeWebSocketHandlerOptions,
} from './orchestration-types.js';

function parseCancelRunPayload(message: unknown): CancelRunPayload | null {
	try {
		const decoded = decodeSocketMessage(message);
		const parsed = JSON.parse(decoded) as unknown;

		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('type' in parsed) ||
			!('run_id' in parsed)
		) {
			return null;
		}

		const candidate = parsed as { readonly run_id?: unknown; readonly type?: unknown };

		if (candidate.type !== 'cancel_run' || typeof candidate.run_id !== 'string') {
			return null;
		}

		return {
			run_id: candidate.run_id,
		};
	} catch {
		return null;
	}
}

async function handleParsedWebSocketMessage(
	socket: WebSocketConnection,
	clientMessage: WebSocketClientMessage,
	options: RuntimeWebSocketHandlerOptions,
): Promise<void> {
	const approvalStore = options.approvalStore ?? defaultApprovalStore;

	if (clientMessage.type === 'approval.resolve') {
		await handleApprovalResolveMessage(socket, clientMessage.payload, {
			...options,
			approvalStore,
		});
		return;
	}

	if (clientMessage.type === 'inspection.request') {
		handleInspectionRequestMessage(socket, clientMessage.payload);
		return;
	}

	await handleRunRequestMessage(socket, clientMessage.payload, {
		...options,
		approvalStore,
	});
}

export async function handleWebSocketMessage(
	socket: WebSocketConnection,
	message: unknown,
	options: RuntimeWebSocketHandlerOptions = {},
): Promise<void> {
	let runRequestPayload: RunRequestPayload | undefined;

	try {
		const cancelPayload = parseCancelRunPayload(message);

		if (cancelPayload) {
			await handleCancelRunMessage(socket, cancelPayload);
			return;
		}

		const clientMessage = parseClientMessage(message);

		if (clientMessage.type === 'run.request') {
			runRequestPayload = clientMessage.payload;
		}

		await handleParsedWebSocketMessage(socket, clientMessage, options);
	} catch (error: unknown) {
		sendServerMessage(
			socket,
			createRejectedMessage(
				error,
				runRequestPayload
					? {
							run_id: runRequestPayload.run_id,
							trace_id: runRequestPayload.trace_id,
						}
					: undefined,
			),
		);
	}
}
