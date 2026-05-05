import type { DesktopAgentPersistedSession } from './auth.js';
import { type DesktopAgentBridgeFactory, createDesktopAgentSessionRuntime } from './session.js';
import type { DesktopAgentBridgeSession } from './ws-bridge.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeDesktopBridgeSocket extends EventTarget {
	readonly send = vi.fn();

	close(code = 1000, reason = ''): void {
		const event = new Event('close') as CloseEvent;
		Object.defineProperties(event, {
			code: {
				value: code,
			},
			reason: {
				value: reason,
			},
		});
		this.dispatchEvent(event);
	}
}

function createSession(): DesktopAgentPersistedSession {
	return {
		access_token: 'desktop-access-token',
		expires_at: Math.trunc(Date.now() / 1000) + 3600,
		refresh_token: 'desktop-refresh-token',
		token_type: 'Bearer',
	};
}

function createBridgeFactory(): {
	readonly bridgeFactory: DesktopAgentBridgeFactory;
	readonly sockets: FakeDesktopBridgeSocket[];
} {
	const sockets: FakeDesktopBridgeSocket[] = [];
	const bridgeFactory: DesktopAgentBridgeFactory = vi.fn(
		async (): Promise<DesktopAgentBridgeSession> => {
			const socket = new FakeDesktopBridgeSocket();
			sockets.push(socket);

			return {
				close: (code, reason) => socket.close(code, reason),
				socket: socket as unknown as WebSocket,
			};
		},
	);

	return {
		bridgeFactory,
		sockets,
	};
}

describe('DesktopAgentSessionRuntime', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('reconnects the desktop bridge after an unexpected socket close', async () => {
		vi.useFakeTimers();
		const { bridgeFactory, sockets } = createBridgeFactory();
		const runtime = createDesktopAgentSessionRuntime({
			agent_id: 'agent-reconnect',
			bridge_factory: bridgeFactory,
			initial_session: createSession(),
			machine_label: 'Reconnect Host',
			server_url: 'ws://127.0.0.1:3000/ws/desktop-agent',
		});

		await expect(runtime.start()).resolves.toMatchObject({
			status: 'bridge_connected',
		});
		expect(bridgeFactory).toHaveBeenCalledTimes(1);

		sockets[0]?.close(1012, 'Server restarted.');
		expect(runtime.getSnapshot()).toMatchObject({
			error_message: 'Server restarted.',
			status: 'bridge_error',
		});

		await vi.advanceTimersByTimeAsync(1500);
		await vi.waitFor(() => {
			expect(bridgeFactory).toHaveBeenCalledTimes(2);
		});
		expect(runtime.getSnapshot()).toMatchObject({
			status: 'bridge_connected',
		});
	});

	it('does not reconnect after an intentional stop', async () => {
		vi.useFakeTimers();
		const { bridgeFactory } = createBridgeFactory();
		const runtime = createDesktopAgentSessionRuntime({
			agent_id: 'agent-stop',
			bridge_factory: bridgeFactory,
			initial_session: createSession(),
			machine_label: 'Stopped Host',
			server_url: 'ws://127.0.0.1:3000/ws/desktop-agent',
		});

		await runtime.start();
		await runtime.stop();
		await vi.advanceTimersByTimeAsync(3000);

		expect(bridgeFactory).toHaveBeenCalledTimes(1);
		expect(runtime.getSnapshot()).toMatchObject({
			status: 'signed_in',
		});
	});
});
