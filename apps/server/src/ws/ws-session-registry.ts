import type { AuthContext } from '@runa/types';

interface WebSocketConnectionLike {
	close(code?: number, reason?: string): void;
	on(event: 'close', listener: () => void): void;
}

interface RegisteredSocketContext {
	readonly auth: AuthContext;
	readonly socket: WebSocketConnectionLike;
}

const activeSockets = new Set<RegisteredSocketContext>();

function isSamePrincipal(
	left: AuthContext['principal'],
	right: AuthContext['principal'],
): boolean {
	if (left.kind !== right.kind) {
		return false;
	}

	if (left.kind === 'authenticated' && right.kind === 'authenticated') {
		return left.user_id === right.user_id;
	}

	if (left.kind === 'service' && right.kind === 'service') {
		return left.service_name === right.service_name;
	}

	return false;
}

export function registerWebSocketSession(
	socket: WebSocketConnectionLike,
	auth: AuthContext,
): () => void {
	const record: RegisteredSocketContext = {
		auth,
		socket,
	};
	activeSockets.add(record);

	const release = () => {
		activeSockets.delete(record);
	};

	socket.on('close', release);
	return release;
}

export function closeWebSocketSessionsForAuthContext(
	auth: AuthContext,
	input: Readonly<{
		readonly code?: number;
		readonly reason?: string;
	}> = {},
): void {
	for (const record of activeSockets) {
		if (!isSamePrincipal(record.auth.principal, auth.principal)) {
			continue;
		}

		record.socket.close(
			input.code ?? 1000,
			input.reason ?? 'WebSocket session invalidated by auth logout.',
		);
		activeSockets.delete(record);
	}
}
