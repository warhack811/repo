import {
	isConnectionReadyServerMessage,
	isPresentationBlocksServerMessage,
	isRunAcceptedServerMessage,
	isRunFinishedServerMessage,
	isRunRejectedServerMessage,
	isRuntimeEventServerMessage,
} from '@runa/types';

import { uiCopy } from '../localization/copy.js';
import type {
	ApprovalResolveClientMessage,
	ApprovalResolvePayload,
	InspectionRequestClientMessage,
	InspectionRequestPayload,
	RunRequestClientMessage,
	RunRequestPayload,
	WebSocketServerBridgeMessage,
} from '../ws-types.js';

export async function decodeWebSocketMessageData(data: Blob | string): Promise<string> {
	if (typeof data === 'string') {
		return data;
	}

	return data.text();
}

export function parseServerMessage(raw: string): WebSocketServerBridgeMessage {
	const parsed = JSON.parse(raw) as unknown;

	if (isConnectionReadyServerMessage(parsed)) {
		return parsed;
	}

	if (isRunAcceptedServerMessage(parsed)) {
		return parsed;
	}

	if (isRuntimeEventServerMessage(parsed)) {
		return parsed;
	}

	if (isRunRejectedServerMessage(parsed)) {
		return parsed;
	}

	if (isRunFinishedServerMessage(parsed)) {
		return parsed;
	}

	if (isPresentationBlocksServerMessage(parsed)) {
		return parsed;
	}

	throw new Error(uiCopy.runtime.unsupportedWsMessage);
}

export function createWebSocketUrl(accessToken?: string | null): string {
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const websocketUrl = new URL(`${protocol}//${window.location.host}/ws`);
	const normalizedAccessToken = accessToken?.trim();

	if (normalizedAccessToken) {
		websocketUrl.searchParams.set('access_token', normalizedAccessToken);
	}

	return websocketUrl.toString();
}

export function createClientId(prefix: 'run' | 'trace'): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createRunRequestMessage(payload: RunRequestPayload): RunRequestClientMessage {
	return {
		payload,
		type: 'run.request',
	};
}

export function createApprovalResolveMessage(
	payload: ApprovalResolvePayload,
): ApprovalResolveClientMessage {
	return {
		payload,
		type: 'approval.resolve',
	};
}

export function createInspectionRequestMessage(
	payload: InspectionRequestPayload,
): InspectionRequestClientMessage {
	return {
		payload,
		type: 'inspection.request',
	};
}
