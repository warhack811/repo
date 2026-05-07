import type { AuthContext } from '@runa/types';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesktopAgentBridgeRegistry } from './desktop-agent-bridge.js';

class MockSocket {
	readonly sentMessages: string[] = [];
	closed = false;
	closeCode?: number;
	closeReason?: string;
	#closeListener?: () => void;
	#messageListener?: (message: unknown) => void;

	on(event: 'close' | 'message', listener: (message?: unknown) => void): void {
		if (event === 'close') {
			this.#closeListener = listener as () => void;
			return;
		}

		this.#messageListener = listener as (message: unknown) => void;
	}

	send(message: string): void {
		this.sentMessages.push(message);
	}

	close(code?: number, reason?: string): void {
		this.closed = true;
		this.closeCode = code;
		this.closeReason = reason;
		this.#closeListener?.();
	}

	emitMessage(message: unknown): void {
		this.#messageListener?.(message);
	}
}

function createAuthenticatedAuthContext(): AuthContext {
	return {
		bearer_token_present: true,
		principal: {
			email: 'dev@runa.local',
			kind: 'authenticated',
			provider: 'internal',
			role: 'authenticated',
			scope: {
				workspace_id: 'workspace_1',
			},
			session_id: 'session_1',
			user_id: 'user_1',
		},
		request_id: 'req_desktop_agent_1',
		transport: 'websocket',
	};
}

function createAuthenticatedAuthContextForUser(userId: string): AuthContext {
	const authContext = createAuthenticatedAuthContext();

	if (authContext.principal.kind !== 'authenticated') {
		throw new Error('Expected authenticated test auth context.');
	}

	return {
		...authContext,
		principal: {
			...authContext.principal,
			email: `${userId}@runa.local`,
			session_id: `${userId}_session`,
			user_id: userId,
		},
	};
}

afterEach(() => {
	vi.useRealTimers();
});

function sendDesktopAgentHello(
	socket: MockSocket,
	input: Readonly<{
		agentId: string;
		capabilities?: readonly { readonly tool_name: string }[];
		machineLabel?: string;
	}>,
): void {
	socket.emitMessage(
		JSON.stringify({
			payload: {
				agent_id: input.agentId,
				capabilities: input.capabilities ?? [
					{
						tool_name: 'desktop.screenshot',
					},
				],
				machine_label: input.machineLabel,
				protocol_version: 1,
			},
			type: 'desktop-agent.hello',
		}),
	);
}

function getLatestHeartbeatPing(socket: MockSocket): {
	readonly payload: {
		readonly ping_id: string;
		readonly sent_at: string;
	};
	readonly type: 'desktop-agent.heartbeat.ping';
} {
	const heartbeatMessage = socket.sentMessages
		.map(
			(message) =>
				JSON.parse(message) as {
					readonly payload?: {
						readonly ping_id?: unknown;
						readonly sent_at?: unknown;
					};
					readonly type?: unknown;
				},
		)
		.reverse()
		.find((message) => message.type === 'desktop-agent.heartbeat.ping');

	if (
		heartbeatMessage?.type !== 'desktop-agent.heartbeat.ping' ||
		typeof heartbeatMessage.payload?.ping_id !== 'string' ||
		typeof heartbeatMessage.payload?.sent_at !== 'string'
	) {
		throw new Error('Expected a desktop-agent.heartbeat.ping message.');
	}

	return {
		payload: {
			ping_id: heartbeatMessage.payload.ping_id,
			sent_at: heartbeatMessage.payload.sent_at,
		},
		type: 'desktop-agent.heartbeat.ping',
	};
}

function sendDesktopAgentHeartbeatPong(
	socket: MockSocket,
	ping: ReturnType<typeof getLatestHeartbeatPing>,
): void {
	socket.emitMessage(
		JSON.stringify({
			payload: {
				ping_id: ping.payload.ping_id,
				received_at: new Date().toISOString(),
			},
			type: 'desktop-agent.heartbeat.pong',
		}),
	);
}

describe('DesktopAgentBridgeRegistry', () => {
	it('rejects bridge result messages before desktop-agent.hello completes the handshake', () => {
		const socket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry();

		registry.attach(socket, createAuthenticatedAuthContext());
		socket.emitMessage(
			JSON.stringify({
				payload: {
					call_id: 'call_desktop_1',
					output: {},
					request_id: 'request_desktop_1',
					status: 'success',
					tool_name: 'desktop.screenshot',
				},
				type: 'desktop-agent.result',
			}),
		);

		expect(socket.sentMessages.map((message) => JSON.parse(message).type)).toEqual([
			'desktop-agent.connection.ready',
			'desktop-agent.rejected',
		]);
		expect(JSON.parse(socket.sentMessages[1] ?? '{}')).toMatchObject({
			payload: {
				error_code: 'INVALID_MESSAGE',
				error_message: 'Desktop agent hello is required before bridge results.',
			},
			type: 'desktop-agent.rejected',
		});
		expect(socket.closed).toBe(true);
		expect(socket.closeReason).toBe('Desktop agent hello is required before bridge results.');
	});

	it('rejects stale desktop-agent.result payloads after handshake without closing the socket', () => {
		const socket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry();

		registry.attach(socket, createAuthenticatedAuthContext());
		socket.emitMessage(
			JSON.stringify({
				payload: {
					agent_id: 'desktop-agent-1',
					capabilities: [
						{
							tool_name: 'desktop.screenshot',
						},
					],
					protocol_version: 1,
				},
				type: 'desktop-agent.hello',
			}),
		);
		socket.emitMessage(
			JSON.stringify({
				payload: {
					call_id: 'call_desktop_2',
					output: {},
					request_id: 'request_missing',
					status: 'success',
					tool_name: 'desktop.screenshot',
				},
				type: 'desktop-agent.result',
			}),
		);

		expect(socket.closed).toBe(false);
		expect(JSON.parse(socket.sentMessages[2] ?? '{}')).toMatchObject({
			payload: {
				error_code: 'STALE_REQUEST',
			},
			type: 'desktop-agent.rejected',
		});
	});

	it('lists presence snapshots for an authenticated user after desktop-agent.hello', () => {
		const socket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry();

		registry.attach(socket, createAuthenticatedAuthContext());
		sendDesktopAgentHello(socket, {
			agentId: 'desktop-agent-1',
			machineLabel: 'Workstation',
		});

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([
			expect.objectContaining({
				agent_id: 'desktop-agent-1',
				capabilities: [
					{
						tool_name: 'desktop.screenshot',
					},
				],
				connection_id: expect.any(String),
				connected_at: expect.any(String),
				machine_label: 'Workstation',
				status: 'online',
				transport: 'desktop_bridge',
				user_id: 'user_1',
			}),
		]);
	});

	it('clears presence snapshots when the desktop bridge socket closes', () => {
		const socket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry();

		registry.attach(socket, createAuthenticatedAuthContext());
		sendDesktopAgentHello(socket, {
			agentId: 'desktop-agent-1',
		});

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toHaveLength(1);

		socket.close();

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([]);
	});

	it('lists multiple desktop devices in newest-first order and preserves remaining sessions on partial disconnect', () => {
		vi.useFakeTimers();
		const firstSocket = new MockSocket();
		const secondSocket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry({
			heartbeat_interval_ms: 60 * 60 * 1000,
			stale_timeout_ms: 60 * 60 * 1000,
		});

		registry.attach(firstSocket, createAuthenticatedAuthContext());
		registry.attach(secondSocket, createAuthenticatedAuthContext());

		vi.setSystemTime(new Date('2026-04-23T10:00:00.000Z'));
		sendDesktopAgentHello(firstSocket, {
			agentId: 'desktop-agent-1',
			machineLabel: 'Alpha',
		});

		vi.setSystemTime(new Date('2026-04-23T10:05:00.000Z'));
		sendDesktopAgentHello(secondSocket, {
			agentId: 'desktop-agent-2',
			machineLabel: 'Beta',
		});

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([
			expect.objectContaining({
				agent_id: 'desktop-agent-2',
				machine_label: 'Beta',
			}),
			expect.objectContaining({
				agent_id: 'desktop-agent-1',
				machine_label: 'Alpha',
			}),
		]);

		secondSocket.close();

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([
			expect.objectContaining({
				agent_id: 'desktop-agent-1',
				machine_label: 'Alpha',
			}),
		]);

		firstSocket.close();

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([]);
	});

	it('supports targetable invokers without silently falling back to a different desktop connection', async () => {
		const firstSocket = new MockSocket();
		const secondSocket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry();

		registry.attach(firstSocket, createAuthenticatedAuthContext());
		registry.attach(secondSocket, createAuthenticatedAuthContext());
		sendDesktopAgentHello(firstSocket, {
			agentId: 'desktop-agent-1',
			machineLabel: 'Alpha',
		});
		sendDesktopAgentHello(secondSocket, {
			agentId: 'desktop-agent-2',
			machineLabel: 'Beta',
		});

		const targetConnectionId = registry
			.listPresenceSnapshotsForUserId('user_1')
			.find((device) => device.agent_id === 'desktop-agent-1')?.connection_id;

		expect(targetConnectionId).toBeTypeOf('string');

		const targetedInvoker = registry.createInvoker(
			createAuthenticatedAuthContext(),
			targetConnectionId,
		);

		expect(targetedInvoker?.agent_id).toBe('desktop-agent-1');
		expect(targetedInvoker?.supports('desktop.screenshot')).toBe(true);

		const targetedInvokePromise = targetedInvoker?.invoke(
			{
				arguments: {},
				call_id: 'call_desktop_target_1',
				tool_name: 'desktop.screenshot',
			},
			{
				run_id: 'run_desktop_target_1',
				trace_id: 'trace_desktop_target_1',
			},
		);

		const firstExecuteMessage = JSON.parse(firstSocket.sentMessages.at(-1) ?? '{}');

		expect(firstExecuteMessage).toMatchObject({
			payload: {
				call_id: 'call_desktop_target_1',
				tool_name: 'desktop.screenshot',
			},
			type: 'desktop-agent.execute',
		});
		expect(secondSocket.sentMessages.at(-1)).not.toContain('"type":"desktop-agent.execute"');

		firstSocket.emitMessage(
			JSON.stringify({
				payload: {
					call_id: 'call_desktop_target_1',
					output: {
						ok: true,
					},
					request_id: firstExecuteMessage.payload.request_id,
					status: 'success',
					tool_name: 'desktop.screenshot',
				},
				type: 'desktop-agent.result',
			}),
		);

		await expect(targetedInvokePromise).resolves.toMatchObject({
			call_id: 'call_desktop_target_1',
			output: {
				ok: true,
			},
			status: 'success',
			tool_name: 'desktop.screenshot',
		});

		const missingTargetInvoker = registry.createInvoker(
			createAuthenticatedAuthContext(),
			'connection_missing',
		);
		const missingTargetResult = await missingTargetInvoker?.invoke(
			{
				arguments: {},
				call_id: 'call_desktop_target_missing',
				tool_name: 'desktop.screenshot',
			},
			{
				run_id: 'run_desktop_target_missing',
				trace_id: 'trace_desktop_target_missing',
			},
		);

		expect(missingTargetInvoker?.supports('desktop.screenshot')).toBe(false);
		expect(missingTargetResult).toMatchObject({
			call_id: 'call_desktop_target_missing',
			details: {
				connection_id: 'connection_missing',
				reason: 'desktop_agent_target_unavailable',
			},
			error_code: 'EXECUTION_FAILED',
			error_message: 'No connected desktop agent is available for connection connection_missing.',
			status: 'error',
			tool_name: 'desktop.screenshot',
		});
		expect(secondSocket.sentMessages.at(-1)).not.toContain(
			'"call_id":"call_desktop_target_missing"',
		);
	});

	it('rejects a targeted desktop command when the connection belongs to another user', async () => {
		const socket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry();

		registry.attach(socket, createAuthenticatedAuthContextForUser('user_1'));
		sendDesktopAgentHello(socket, {
			agentId: 'desktop-agent-user-1',
			machineLabel: 'User One Workstation',
		});

		const targetConnectionId = registry.listPresenceSnapshotsForUserId('user_1')[0]?.connection_id;

		expect(targetConnectionId).toBeTypeOf('string');

		const crossAccountInvoker = registry.createInvoker(
			createAuthenticatedAuthContextForUser('user_2'),
			targetConnectionId,
		);
		const result = await crossAccountInvoker?.invoke(
			{
				arguments: {},
				call_id: 'call_cross_account_desktop_target',
				tool_name: 'desktop.screenshot',
			},
			{
				run_id: 'run_cross_account_desktop_target',
				trace_id: 'trace_cross_account_desktop_target',
			},
		);

		expect(crossAccountInvoker?.supports('desktop.screenshot')).toBe(false);
		expect(result).toMatchObject({
			call_id: 'call_cross_account_desktop_target',
			details: {
				connection_id: targetConnectionId,
				reason: 'desktop_agent_target_unavailable',
			},
			error_code: 'EXECUTION_FAILED',
			error_message: `No connected desktop agent is available for connection ${targetConnectionId}.`,
			status: 'error',
			tool_name: 'desktop.screenshot',
		});
		expect(socket.sentMessages.at(-1)).not.toContain('"call_cross_account_desktop_target"');
	});

	it('keeps a healthy desktop session online when heartbeat pong messages arrive', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-24T10:00:00.000Z'));
		const socket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry({
			heartbeat_interval_ms: 1_000,
			stale_timeout_ms: 2_500,
		});

		registry.attach(socket, createAuthenticatedAuthContext());
		sendDesktopAgentHello(socket, {
			agentId: 'desktop-agent-1',
			machineLabel: 'Workstation',
		});

		await vi.advanceTimersByTimeAsync(1_000);
		const ping = getLatestHeartbeatPing(socket);
		sendDesktopAgentHeartbeatPong(socket, ping);
		await vi.advanceTimersByTimeAsync(1_000);
		sendDesktopAgentHeartbeatPong(socket, getLatestHeartbeatPing(socket));
		await vi.advanceTimersByTimeAsync(1_000);

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([
			expect.objectContaining({
				agent_id: 'desktop-agent-1',
				machine_label: 'Workstation',
			}),
		]);
	});

	it('drops stale sessions and rejects pending requests when heartbeat timeout elapses', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-24T11:00:00.000Z'));
		const socket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry({
			heartbeat_interval_ms: 1_000,
			stale_timeout_ms: 2_500,
		});

		registry.attach(socket, createAuthenticatedAuthContext());
		sendDesktopAgentHello(socket, {
			agentId: 'desktop-agent-1',
			machineLabel: 'Workstation',
		});

		const invoker = registry.createInvoker(createAuthenticatedAuthContext());
		const invokePromise = invoker?.invoke(
			{
				arguments: {},
				call_id: 'call_desktop_stale_1',
				tool_name: 'desktop.screenshot',
			},
			{
				run_id: 'run_desktop_stale_1',
				trace_id: 'trace_desktop_stale_1',
			},
		);

		await vi.advanceTimersByTimeAsync(2_600);

		await expect(invokePromise).resolves.toMatchObject({
			call_id: 'call_desktop_stale_1',
			details: {
				reason: 'desktop_agent_stale',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.screenshot',
		});
		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([]);
	});

	it('preserves other active sessions and allows a stale desktop agent to reconnect as a new session', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));
		const staleSocket = new MockSocket();
		const healthySocket = new MockSocket();
		const reconnectSocket = new MockSocket();
		const registry = new DesktopAgentBridgeRegistry({
			heartbeat_interval_ms: 1_000,
			stale_timeout_ms: 2_500,
		});

		registry.attach(staleSocket, createAuthenticatedAuthContext());
		sendDesktopAgentHello(staleSocket, {
			agentId: 'desktop-agent-1',
			machineLabel: 'Original Workstation',
		});

		registry.attach(healthySocket, createAuthenticatedAuthContext());
		sendDesktopAgentHello(healthySocket, {
			agentId: 'desktop-agent-2',
			machineLabel: 'Healthy Laptop',
		});

		await vi.advanceTimersByTimeAsync(1_000);
		sendDesktopAgentHeartbeatPong(healthySocket, getLatestHeartbeatPing(healthySocket));
		await vi.advanceTimersByTimeAsync(1_600);

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([
			expect.objectContaining({
				agent_id: 'desktop-agent-2',
				machine_label: 'Healthy Laptop',
			}),
		]);

		registry.attach(reconnectSocket, createAuthenticatedAuthContext());
		sendDesktopAgentHello(reconnectSocket, {
			agentId: 'desktop-agent-1',
			machineLabel: 'Original Workstation',
		});

		expect(registry.listPresenceSnapshotsForUserId('user_1')).toEqual([
			expect.objectContaining({
				agent_id: 'desktop-agent-1',
				machine_label: 'Original Workstation',
			}),
			expect.objectContaining({
				agent_id: 'desktop-agent-2',
				machine_label: 'Healthy Laptop',
			}),
		]);
	});
});
