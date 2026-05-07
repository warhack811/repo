import type { WebSocketServerBridgeMessage } from '@runa/types';
import type { WebSocketConnection } from '../ws/transport.js';

export function createMockSocket(): {
	socket: WebSocketConnection;
	sentMessages: WebSocketServerBridgeMessage[];
} {
	const sentMessages: WebSocketServerBridgeMessage[] = [];
	return {
		socket: {
			close: () => {},
			on: () => {},
			send: (msg: string) => {
				sentMessages.push(JSON.parse(msg) as WebSocketServerBridgeMessage);
			},
		},
		sentMessages,
	};
}
