import type { DesktopAgentPersistedSession } from './auth.js';
import {
	type DesktopAgentBridgeFactory,
	type DesktopAgentSessionStorage,
	InMemoryDesktopAgentSessionStorage,
	createDesktopAgentSessionRuntime,
	resolveDesktopAgentReconnectDelayMs,
} from './session.js';
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

function createExpiredSessionWithoutRefreshToken(): DesktopAgentPersistedSession {
	return {
		access_token: 'expired-desktop-access-token',
		expires_at: Math.trunc(Date.now() / 1000) - 60,
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

function createFlakyReconnectBridgeFactory(): {
	readonly bridgeFactory: DesktopAgentBridgeFactory;
	readonly sockets: FakeDesktopBridgeSocket[];
} {
	const sockets: FakeDesktopBridgeSocket[] = [];
	const bridgeFactory = vi.fn(async (): Promise<DesktopAgentBridgeSession> => {
		if (bridgeFactory.mock.calls.length === 2) {
			throw new Error('Server is still restarting.');
		}

		const socket = new FakeDesktopBridgeSocket();
		sockets.push(socket);

		return {
			close: (code, reason) => socket.close(code, reason),
			socket: socket as unknown as WebSocket,
		};
	});

	return {
		bridgeFactory,
		sockets,
	};
}

describe('DesktopAgentSessionRuntime', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('uses bounded exponential reconnect backoff with jitter', () => {
		expect(resolveDesktopAgentReconnectDelayMs(0, 0.5)).toBe(1500);
		expect(resolveDesktopAgentReconnectDelayMs(1, 0.5)).toBe(3000);
		expect(resolveDesktopAgentReconnectDelayMs(2, 0.5)).toBe(6000);
		expect(resolveDesktopAgentReconnectDelayMs(0, 0)).toBe(1200);
		expect(resolveDesktopAgentReconnectDelayMs(0, 1)).toBe(1800);
		expect(resolveDesktopAgentReconnectDelayMs(10, 1)).toBe(30000);
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

		await vi.advanceTimersByTimeAsync(1800);
		await vi.waitFor(() => {
			expect(bridgeFactory).toHaveBeenCalledTimes(2);
		});
		expect(runtime.getSnapshot()).toMatchObject({
			status: 'bridge_connected',
		});
	});

	it('keeps retrying when the first reconnect attempt happens before the server is back', async () => {
		vi.useFakeTimers();
		const { bridgeFactory, sockets } = createFlakyReconnectBridgeFactory();
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
		await vi.advanceTimersByTimeAsync(1800);
		await vi.waitFor(() => {
			expect(bridgeFactory).toHaveBeenCalledTimes(2);
		});
		expect(runtime.getSnapshot()).toMatchObject({
			error_message: 'Server is still restarting.',
			status: 'bridge_error',
		});

		await vi.advanceTimersByTimeAsync(3600);
		await vi.waitFor(() => {
			expect(bridgeFactory).toHaveBeenCalledTimes(3);
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

	it('clears an expired stored session when no refresh token is available', async () => {
		const { bridgeFactory } = createBridgeFactory();
		const sessionStorage: DesktopAgentSessionStorage = new InMemoryDesktopAgentSessionStorage(
			createExpiredSessionWithoutRefreshToken(),
		);
		const runtime = createDesktopAgentSessionRuntime({
			agent_id: 'agent-expired',
			bridge_factory: bridgeFactory,
			machine_label: 'Expired Host',
			server_url: 'ws://127.0.0.1:3000/ws/desktop-agent',
			session_storage: sessionStorage,
		});

		await expect(runtime.start()).resolves.toMatchObject({
			reason: 'refresh_failed',
			status: 'signed_out',
		});

		expect(bridgeFactory).not.toHaveBeenCalled();
		await expect(sessionStorage.load()).resolves.toBeNull();
	});
});
