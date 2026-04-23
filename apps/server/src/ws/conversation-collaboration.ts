import type { AuthContext } from '@runa/types';

import {
	conversationScopeFromAuthContext,
	getConversationAccessRole,
} from '../persistence/conversation-store.js';
import type { RunRequestPayload } from './messages.js';
import type { RunToolWebSocketResult } from './orchestration-types.js';
import {
	type WebSocketConnection,
	createAcceptedMessage,
	createFinishedMessage,
	sendServerMessage,
} from './transport.js';

interface RegisteredSocketEntry {
	readonly auth_context?: AuthContext;
	readonly socket: WebSocketConnection;
}

const registeredSockets = new Set<RegisteredSocketEntry>();
let accessRoleResolver = getConversationAccessRole;

function supportsCloseListener(socket: WebSocketConnection): socket is WebSocketConnection & {
	on(event: 'close', listener: () => void): void;
} {
	return typeof socket.on === 'function';
}

export function resetConversationCollaborationHub(): void {
	registeredSockets.clear();
	accessRoleResolver = getConversationAccessRole;
}

export function setConversationCollaborationAccessResolver(
	resolver: typeof getConversationAccessRole,
): void {
	accessRoleResolver = resolver;
}

export function registerConversationCollaborationSocket(
	socket: WebSocketConnection,
	auth_context?: AuthContext,
): void {
	const existingEntry = [...registeredSockets].find((entry) => entry.socket === socket);

	if (existingEntry) {
		registeredSockets.delete(existingEntry);
	}

	const entry: RegisteredSocketEntry = {
		auth_context,
		socket,
	};

	registeredSockets.add(entry);

	if (supportsCloseListener(socket)) {
		socket.on('close', () => {
			registeredSockets.delete(entry);
		});
	}
}

async function listBroadcastTargets(
	originSocket: WebSocketConnection,
	conversation_id: string | undefined,
): Promise<readonly RegisteredSocketEntry[]> {
	if (!conversation_id) {
		return [];
	}

	const targets: RegisteredSocketEntry[] = [];

	for (const entry of registeredSockets) {
		if (entry.socket === originSocket || !entry.auth_context) {
			continue;
		}

		let accessRole: Awaited<ReturnType<typeof getConversationAccessRole>>;

		try {
			accessRole = await accessRoleResolver(
				conversation_id,
				conversationScopeFromAuthContext(entry.auth_context),
			);
		} catch {
			continue;
		}

		if (accessRole) {
			targets.push(entry);
		}
	}

	return targets;
}

export async function broadcastConversationRunAccepted(
	originSocket: WebSocketConnection,
	payload: RunRequestPayload,
): Promise<void> {
	const targets = await listBroadcastTargets(originSocket, payload.conversation_id);

	for (const target of targets) {
		sendServerMessage(target.socket, createAcceptedMessage(payload));
	}
}

export async function broadcastConversationRunFinished(
	originSocket: WebSocketConnection,
	payload: RunRequestPayload,
	result: RunToolWebSocketResult,
): Promise<void> {
	const finishedMessage = createFinishedMessage(payload, result);

	if (!finishedMessage) {
		return;
	}

	const targets = await listBroadcastTargets(originSocket, payload.conversation_id);

	for (const target of targets) {
		sendServerMessage(target.socket, finishedMessage);
	}
}
