export interface MockSocketSentMessages {
	type: string;
	payload?: Record<string, unknown>;
	[key: string]: unknown;
}

export function createMockSocket(): {
	socket: {
		close(code?: number, reason?: string): void;
		on(event: 'close' | 'message', listener: (message?: unknown) => void): void;
		send(message: string): void;
	};
	sentMessages: MockSocketSentMessages[];
} {
	const sentMessages: MockSocketSentMessages[] = [];
	return {
		socket: {
			close: () => {},
			on: () => {},
			send: (msg: string) => {
				try {
					const parsed = JSON.parse(msg);
					sentMessages.push(parsed as MockSocketSentMessages);
				} catch {
					sentMessages.push({ type: 'error', raw: msg } as MockSocketSentMessages);
				}
			},
		},
		sentMessages,
	};
}
