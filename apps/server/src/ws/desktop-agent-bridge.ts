import { randomUUID } from 'node:crypto';

import {
	type AuthContext,
	type DesktopAgentClientMessage,
	type DesktopAgentConnectionReadyServerMessage,
	type DesktopAgentExecuteServerMessage,
	type DesktopAgentHeartbeatPingServerMessage,
	type DesktopAgentHelloPayload,
	type DesktopAgentRejectedServerMessage,
	type DesktopAgentSessionAcceptedServerMessage,
	type DesktopBridgeInvoker,
	type DesktopDevicePresenceSnapshot,
	type ToolCallInput,
	type ToolErrorCode,
	type ToolExecutionContext,
	type ToolResult,
	desktopAgentToolNames,
	isDesktopAgentClientMessage,
} from '@runa/types';

import type { WebSocketConnection } from './transport.js';
import { decodeSocketMessage } from './transport.js';

const DESKTOP_AGENT_CLOSE_CODE = 1008;
const DESKTOP_AGENT_HEARTBEAT_INTERVAL_MS = 10_000;
const DESKTOP_AGENT_REQUEST_TIMEOUT_MS = 15_000;
const DESKTOP_AGENT_STALE_TIMEOUT_MS = 30_000;

export type DesktopToolName = (typeof desktopAgentToolNames)[number];

type AuthenticatedDesktopBridgeAuthContext = AuthContext & {
	readonly principal: Extract<AuthContext['principal'], { readonly kind: 'authenticated' }>;
	readonly transport: 'desktop_bridge';
};

interface PendingDesktopAgentRequest {
	readonly input: ToolCallInput<DesktopToolName>;
	readonly reject: (result: ToolResult<DesktopToolName>) => void;
	readonly resolve: (result: ToolResult<DesktopToolName>) => void;
	readonly timeout: ReturnType<typeof setTimeout>;
}

interface DesktopAgentSession {
	readonly auth_context: AuthenticatedDesktopBridgeAuthContext;
	readonly connection_id: string;
	connected_at?: string;
	heartbeat_interval?: ReturnType<typeof setInterval>;
	hello?: DesktopAgentHelloPayload;
	last_seen_at?: string;
	readonly pending_requests: Map<string, PendingDesktopAgentRequest>;
	readonly socket: WebSocketConnection;
	stale_timeout?: ReturnType<typeof setTimeout>;
}

interface ResolvedDesktopSessionTarget {
	readonly session?: DesktopAgentSession;
	readonly target_connection_id?: string;
}

interface DesktopAgentBridgeRegistryOptions {
	readonly clear_interval?: typeof clearInterval;
	readonly clear_timeout?: typeof clearTimeout;
	readonly heartbeat_interval_ms?: number;
	readonly now?: () => Date;
	readonly set_interval?: typeof setInterval;
	readonly set_timeout?: typeof setTimeout;
	readonly stale_timeout_ms?: number;
}

function isDesktopToolName(value: string): value is DesktopToolName {
	return desktopAgentToolNames.includes(value as DesktopToolName);
}

function sendDesktopAgentMessage(
	socket: WebSocketConnection,
	message:
		| DesktopAgentConnectionReadyServerMessage
		| DesktopAgentExecuteServerMessage
		| DesktopAgentHeartbeatPingServerMessage
		| DesktopAgentRejectedServerMessage
		| DesktopAgentSessionAcceptedServerMessage,
): void {
	socket.send(JSON.stringify(message));
}

function createDesktopAgentRejectedMessage(
	error_code: DesktopAgentRejectedServerMessage['payload']['error_code'],
	error_message: string,
): DesktopAgentRejectedServerMessage {
	return {
		payload: {
			error_code,
			error_message,
		},
		type: 'desktop-agent.rejected',
	};
}

function createDesktopAgentReadyMessage(): DesktopAgentConnectionReadyServerMessage {
	return {
		message: 'ready',
		transport: 'desktop_bridge',
		type: 'desktop-agent.connection.ready',
	};
}

function createDesktopAgentSessionAcceptedMessage(
	session: DesktopAgentSession,
): DesktopAgentSessionAcceptedServerMessage {
	if (session.hello === undefined) {
		throw new Error('Desktop agent session acceptance requires a hello payload.');
	}

	return {
		payload: {
			agent_id: session.hello.agent_id,
			capabilities: session.hello.capabilities,
			connection_id: session.connection_id,
			user_id: session.auth_context.principal.user_id,
		},
		type: 'desktop-agent.session.accepted',
	};
}

function createDesktopAgentExecuteMessage<TName extends DesktopToolName>(
	input: ToolCallInput<TName>,
	context: Pick<ToolExecutionContext, 'run_id' | 'trace_id'>,
	requestId: string,
): DesktopAgentExecuteServerMessage {
	return {
		payload: {
			arguments: input.arguments,
			call_id: input.call_id,
			request_id: requestId,
			run_id: context.run_id,
			tool_name: input.tool_name,
			trace_id: context.trace_id,
		},
		type: 'desktop-agent.execute',
	};
}

function createDesktopAgentHeartbeatPingMessage(
	now: () => Date,
): DesktopAgentHeartbeatPingServerMessage {
	return {
		payload: {
			ping_id: randomUUID(),
			sent_at: now().toISOString(),
		},
		type: 'desktop-agent.heartbeat.ping',
	};
}

function createBridgeErrorResult<TName extends DesktopToolName>(
	input: Pick<ToolCallInput<TName>, 'call_id' | 'tool_name'>,
	error_code: ToolErrorCode,
	error_message: string,
	details?: Readonly<Record<string, unknown>>,
	retryable?: boolean,
): ToolResult<TName> {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: input.tool_name,
	};
}

function retagDesktopBridgeAuthContext(
	authContext: AuthContext,
): AuthenticatedDesktopBridgeAuthContext {
	return {
		...authContext,
		transport: 'desktop_bridge',
	} as AuthenticatedDesktopBridgeAuthContext;
}

function createDesktopDevicePresenceSnapshot(
	session: DesktopAgentSession,
): DesktopDevicePresenceSnapshot | undefined {
	if (
		session.hello === undefined ||
		session.connected_at === undefined ||
		session.last_seen_at === undefined
	) {
		return undefined;
	}

	return {
		agent_id: session.hello.agent_id,
		capabilities: session.hello.capabilities,
		connected_at: session.connected_at,
		connection_id: session.connection_id,
		machine_label: session.hello.machine_label,
		status: 'online',
		transport: 'desktop_bridge',
		user_id: session.auth_context.principal.user_id,
	};
}

function compareDesktopAgentSessions(
	left: DesktopAgentSession,
	right: DesktopAgentSession,
): number {
	const leftConnectedAt = left.connected_at ?? '';
	const rightConnectedAt = right.connected_at ?? '';
	const timestampComparison = rightConnectedAt.localeCompare(leftConnectedAt);

	if (timestampComparison !== 0) {
		return timestampComparison;
	}

	return left.connection_id.localeCompare(right.connection_id);
}

export class DesktopAgentBridgeRegistry {
	readonly #options: Required<DesktopAgentBridgeRegistryOptions>;
	#sessionsBySocket = new WeakMap<WebSocketConnection, DesktopAgentSession>();
	#sessionsByUserId = new Map<string, Map<string, DesktopAgentSession>>();

	constructor(options: DesktopAgentBridgeRegistryOptions = {}) {
		this.#options = {
			clear_interval: options.clear_interval ?? clearInterval,
			clear_timeout: options.clear_timeout ?? clearTimeout,
			heartbeat_interval_ms: options.heartbeat_interval_ms ?? DESKTOP_AGENT_HEARTBEAT_INTERVAL_MS,
			now: options.now ?? (() => new Date()),
			set_interval: options.set_interval ?? setInterval,
			set_timeout: options.set_timeout ?? setTimeout,
			stale_timeout_ms: options.stale_timeout_ms ?? DESKTOP_AGENT_STALE_TIMEOUT_MS,
		};
	}

	attach(socket: WebSocketConnection, authContext: AuthContext): void {
		const desktopBridgeAuthContext = retagDesktopBridgeAuthContext(authContext);

		if (desktopBridgeAuthContext.principal.kind !== 'authenticated') {
			sendDesktopAgentMessage(
				socket,
				createDesktopAgentRejectedMessage(
					'UNAUTHORIZED',
					'Desktop agent bridge requires an authenticated user session.',
				),
			);
			socket.close(
				DESKTOP_AGENT_CLOSE_CODE,
				'Desktop agent bridge requires an authenticated user session.',
			);
			return;
		}

		const session: DesktopAgentSession = {
			auth_context: desktopBridgeAuthContext,
			connection_id: randomUUID(),
			pending_requests: new Map(),
			socket,
		};

		this.#sessionsBySocket.set(socket, session);
		sendDesktopAgentMessage(socket, createDesktopAgentReadyMessage());
		socket.on('message', (message) => {
			void this.handleMessage(socket, message);
		});
		socket.on('close', () => {
			this.handleClose(socket);
		});
	}

	createInvoker(
		authContext: AuthContext | undefined,
		targetConnectionId?: string,
	): DesktopBridgeInvoker | undefined {
		if (authContext?.principal.kind !== 'authenticated') {
			return undefined;
		}

		const authenticatedAuthContext = authContext as AuthenticatedDesktopBridgeAuthContext;

		const getCapabilities = (): readonly Extract<
			ToolCallInput['tool_name'],
			`desktop.${string}`
		>[] => {
			const session = this.resolveSessionTarget(
				authenticatedAuthContext.principal.user_id,
				targetConnectionId,
			).session;

			return (session?.hello?.capabilities.map((capability) => capability.tool_name) ??
				[]) as readonly Extract<ToolCallInput['tool_name'], `desktop.${string}`>[];
		};

		return {
			agent_id:
				this.resolveSessionTarget(authenticatedAuthContext.principal.user_id, targetConnectionId)
					.session?.hello?.agent_id ?? 'desktop-agent-unavailable',
			get capabilities() {
				return getCapabilities();
			},
			invoke: async <TName extends Extract<ToolCallInput['tool_name'], `desktop.${string}`>>(
				input: ToolCallInput<TName>,
				context: Pick<ToolExecutionContext, 'run_id' | 'signal' | 'trace_id'>,
			): Promise<ToolResult<TName>> => {
				if (!isDesktopToolName(input.tool_name)) {
					return createBridgeErrorResult(
						input as ToolCallInput<DesktopToolName>,
						'EXECUTION_FAILED',
						`Desktop bridge does not support ${input.tool_name}.`,
						{
							reason: 'desktop_agent_unknown_tool',
						},
						false,
					) as ToolResult<TName>;
				}

				return (await this.invokeTool(
					authenticatedAuthContext,
					input as ToolCallInput<DesktopToolName>,
					context,
					targetConnectionId,
				)) as ToolResult<TName>;
			},
			supports: (tool_name) => {
				const session = this.resolveSessionTarget(
					authenticatedAuthContext.principal.user_id,
					targetConnectionId,
				).session;

				return (
					session?.hello?.capabilities.some((capability) => capability.tool_name === tool_name) ??
					false
				);
			},
		};
	}

	listPresenceSnapshotsForUserId(userId: string): readonly DesktopDevicePresenceSnapshot[] {
		return this.listReadySessionsForUserId(userId)
			.map((session) => createDesktopDevicePresenceSnapshot(session))
			.filter((snapshot): snapshot is DesktopDevicePresenceSnapshot => snapshot !== undefined);
	}

	createInvokerForConnection(
		authContext: AuthContext | undefined,
		connectionId: string,
	): DesktopBridgeInvoker | undefined {
		return this.createInvoker(authContext, connectionId);
	}

	private async handleMessage(socket: WebSocketConnection, rawMessage: unknown): Promise<void> {
		const session = this.#sessionsBySocket.get(socket);

		if (!session) {
			return;
		}

		let parsedMessage: DesktopAgentClientMessage;

		try {
			parsedMessage = JSON.parse(decodeSocketMessage(rawMessage)) as DesktopAgentClientMessage;
		} catch {
			sendDesktopAgentMessage(
				socket,
				createDesktopAgentRejectedMessage(
					'INVALID_MESSAGE',
					'Desktop agent message must be valid JSON.',
				),
			);
			socket.close(DESKTOP_AGENT_CLOSE_CODE, 'Desktop agent message must be valid JSON.');
			return;
		}

		if (!isDesktopAgentClientMessage(parsedMessage)) {
			sendDesktopAgentMessage(
				socket,
				createDesktopAgentRejectedMessage(
					'INVALID_MESSAGE',
					'Unsupported or invalid desktop agent message.',
				),
			);
			socket.close(DESKTOP_AGENT_CLOSE_CODE, 'Unsupported or invalid desktop agent message.');
			return;
		}

		if (parsedMessage.type === 'desktop-agent.hello') {
			this.registerHello(session, parsedMessage.payload);
			sendDesktopAgentMessage(socket, createDesktopAgentSessionAcceptedMessage(session));
			return;
		}

		if (session.hello === undefined) {
			sendDesktopAgentMessage(
				socket,
				createDesktopAgentRejectedMessage(
					'INVALID_MESSAGE',
					'Desktop agent hello is required before bridge results.',
				),
			);
			socket.close(
				DESKTOP_AGENT_CLOSE_CODE,
				'Desktop agent hello is required before bridge results.',
			);
			return;
		}

		if (parsedMessage.type === 'desktop-agent.heartbeat.pong') {
			this.markSessionAlive(session);
			return;
		}

		const pendingRequest = session.pending_requests.get(parsedMessage.payload.request_id);

		if (!pendingRequest) {
			sendDesktopAgentMessage(
				socket,
				createDesktopAgentRejectedMessage(
					'STALE_REQUEST',
					`No pending desktop bridge request exists for ${parsedMessage.payload.request_id}.`,
				),
			);
			return;
		}

		this.#options.clear_timeout(pendingRequest.timeout);
		session.pending_requests.delete(parsedMessage.payload.request_id);
		this.markSessionAlive(session);
		pendingRequest.resolve(parsedMessage.payload as ToolResult<DesktopToolName>);
	}

	private registerHello(session: DesktopAgentSession, hello: DesktopAgentHelloPayload): void {
		if (hello.protocol_version !== 1) {
			sendDesktopAgentMessage(
				session.socket,
				createDesktopAgentRejectedMessage(
					'UNSUPPORTED_PROTOCOL',
					`Desktop agent protocol version ${String(hello.protocol_version)} is not supported.`,
				),
			);
			session.socket.close(
				DESKTOP_AGENT_CLOSE_CODE,
				`Desktop agent protocol version ${String(hello.protocol_version)} is not supported.`,
			);
			return;
		}

		session.hello = hello;
		const now = this.#options.now().toISOString();
		session.connected_at ??= now;
		session.last_seen_at = now;
		this.getOrCreateUserSessionMap(session.auth_context.principal.user_id).set(
			session.connection_id,
			session,
		);
		this.startHeartbeat(session);
		this.refreshStaleTimeout(session);
	}

	private handleClose(socket: WebSocketConnection): void {
		const session = this.#sessionsBySocket.get(socket);

		if (!session) {
			return;
		}

		this.cleanupSession(
			session,
			'Desktop agent bridge disconnected before replying.',
			'desktop_agent_disconnected',
			true,
		);
	}

	private rejectPendingRequests(
		session: DesktopAgentSession,
		errorMessage: string,
		reason: string,
		retryable: boolean,
	): void {
		for (const pendingRequest of session.pending_requests.values()) {
			this.#options.clear_timeout(pendingRequest.timeout);
			pendingRequest.reject(
				createBridgeErrorResult(
					pendingRequest.input,
					'EXECUTION_FAILED',
					errorMessage,
					{
						reason,
					},
					retryable,
				),
			);
		}

		session.pending_requests.clear();
	}

	private cleanupSession(
		session: DesktopAgentSession,
		errorMessage: string,
		reason: string,
		retryable: boolean,
	): void {
		if (this.#sessionsBySocket.get(session.socket) !== session) {
			return;
		}

		this.#sessionsBySocket.delete(session.socket);
		this.stopHeartbeat(session);
		this.removeUserSession(session);
		this.rejectPendingRequests(session, errorMessage, reason, retryable);
	}

	private markSessionAlive(session: DesktopAgentSession): void {
		session.last_seen_at = this.#options.now().toISOString();
		this.refreshStaleTimeout(session);
	}

	private async invokeTool(
		authContext: AuthContext,
		input: ToolCallInput<DesktopToolName>,
		context: Pick<ToolExecutionContext, 'run_id' | 'signal' | 'trace_id'>,
		targetConnectionId?: string,
	): Promise<ToolResult<DesktopToolName>> {
		if (authContext.principal.kind !== 'authenticated') {
			return createBridgeErrorResult(
				input,
				'PERMISSION_DENIED',
				'Desktop bridge requires an authenticated user session.',
				{
					reason: 'desktop_agent_unauthorized',
				},
				false,
			);
		}

		const resolvedSessionTarget = this.resolveSessionTarget(
			authContext.principal.user_id,
			targetConnectionId,
		);
		const session = resolvedSessionTarget.session;

		if (!session || session.hello === undefined) {
			return createBridgeErrorResult(
				input,
				'EXECUTION_FAILED',
				resolvedSessionTarget.target_connection_id
					? `No connected desktop agent is available for connection ${resolvedSessionTarget.target_connection_id}.`
					: 'No connected desktop agent is available for this user session.',
				resolvedSessionTarget.target_connection_id
					? {
							connection_id: resolvedSessionTarget.target_connection_id,
							reason: 'desktop_agent_target_unavailable',
						}
					: {
							reason: 'desktop_agent_unavailable',
						},
				true,
			);
		}

		if (
			!session.hello.capabilities.some((capability) => capability.tool_name === input.tool_name)
		) {
			return createBridgeErrorResult(
				input,
				'EXECUTION_FAILED',
				resolvedSessionTarget.target_connection_id
					? `Targeted desktop agent does not advertise ${input.tool_name} support.`
					: `Connected desktop agent does not advertise ${input.tool_name} support.`,
				resolvedSessionTarget.target_connection_id
					? {
							connection_id: resolvedSessionTarget.target_connection_id,
							reason: 'desktop_agent_capability_unavailable',
						}
					: {
							reason: 'desktop_agent_capability_unavailable',
						},
				false,
			);
		}

		if (context.signal?.aborted) {
			return createBridgeErrorResult(
				input,
				'EXECUTION_FAILED',
				'Desktop bridge request was aborted before dispatch.',
				{
					reason: 'aborted',
				},
				true,
			);
		}

		const requestId = randomUUID();

		return await new Promise<ToolResult<DesktopToolName>>((resolve) => {
			const timeout = setTimeout(() => {
				session.pending_requests.delete(requestId);
				resolve(
					createBridgeErrorResult(
						input,
						'TIMEOUT',
						`Desktop agent did not reply to ${input.tool_name} within ${String(DESKTOP_AGENT_REQUEST_TIMEOUT_MS)}ms.`,
						{
							reason: 'desktop_agent_timeout',
						},
						true,
					),
				);
			}, DESKTOP_AGENT_REQUEST_TIMEOUT_MS);

			session.pending_requests.set(requestId, {
				input,
				reject: resolve,
				resolve,
				timeout,
			});
			sendDesktopAgentMessage(
				session.socket,
				createDesktopAgentExecuteMessage(input, context, requestId),
			);
		});
	}

	private getOrCreateUserSessionMap(userId: string): Map<string, DesktopAgentSession> {
		let sessions = this.#sessionsByUserId.get(userId);

		if (!sessions) {
			sessions = new Map<string, DesktopAgentSession>();
			this.#sessionsByUserId.set(userId, sessions);
		}

		return sessions;
	}

	private listReadySessionsForUserId(userId: string): readonly DesktopAgentSession[] {
		const sessions = this.#sessionsByUserId.get(userId);

		if (!sessions) {
			return [];
		}

		return Array.from(sessions.values())
			.filter((session) => this.pruneStaleSession(session))
			.filter((session) => session.hello !== undefined && session.connected_at !== undefined)
			.sort(compareDesktopAgentSessions);
	}

	private resolveSessionTarget(
		userId: string,
		targetConnectionId?: string,
	): ResolvedDesktopSessionTarget {
		if (targetConnectionId) {
			const targetedSession = this.#sessionsByUserId.get(userId)?.get(targetConnectionId);

			if (targetedSession && !this.pruneStaleSession(targetedSession)) {
				return {
					session: undefined,
					target_connection_id: targetConnectionId,
				};
			}

			return {
				session: targetedSession,
				target_connection_id: targetConnectionId,
			};
		}

		return {
			session: this.listReadySessionsForUserId(userId)[0],
		};
	}

	private removeUserSession(session: DesktopAgentSession): void {
		const userSessions = this.#sessionsByUserId.get(session.auth_context.principal.user_id);

		if (!userSessions) {
			return;
		}

		userSessions.delete(session.connection_id);

		if (userSessions.size === 0) {
			this.#sessionsByUserId.delete(session.auth_context.principal.user_id);
		}
	}

	private refreshStaleTimeout(session: DesktopAgentSession): void {
		if (session.stale_timeout !== undefined) {
			this.#options.clear_timeout(session.stale_timeout);
		}

		session.stale_timeout = this.#options.set_timeout(() => {
			this.cleanupSession(
				session,
				'Desktop agent heartbeat timed out before replying.',
				'desktop_agent_stale',
				true,
			);
			session.socket.close(
				DESKTOP_AGENT_CLOSE_CODE,
				'Desktop agent heartbeat timed out before replying.',
			);
		}, this.#options.stale_timeout_ms);
	}

	private startHeartbeat(session: DesktopAgentSession): void {
		this.stopHeartbeat(session);
		session.heartbeat_interval = this.#options.set_interval(() => {
			if (this.#sessionsBySocket.get(session.socket) !== session || session.hello === undefined) {
				return;
			}

			sendDesktopAgentMessage(
				session.socket,
				createDesktopAgentHeartbeatPingMessage(this.#options.now),
			);
		}, this.#options.heartbeat_interval_ms);
	}

	private stopHeartbeat(session: DesktopAgentSession): void {
		if (session.heartbeat_interval !== undefined) {
			this.#options.clear_interval(session.heartbeat_interval);
			session.heartbeat_interval = undefined;
		}

		if (session.stale_timeout !== undefined) {
			this.#options.clear_timeout(session.stale_timeout);
			session.stale_timeout = undefined;
		}
	}

	private pruneStaleSession(session: DesktopAgentSession): boolean {
		if (session.last_seen_at === undefined) {
			return true;
		}

		const lastSeenAt = Date.parse(session.last_seen_at);

		if (Number.isNaN(lastSeenAt)) {
			this.cleanupSession(
				session,
				'Desktop agent heartbeat timed out before replying.',
				'desktop_agent_stale',
				true,
			);
			return false;
		}

		const isLive = this.#options.now().getTime() - lastSeenAt <= this.#options.stale_timeout_ms;

		if (!isLive) {
			this.cleanupSession(
				session,
				'Desktop agent heartbeat timed out before replying.',
				'desktop_agent_stale',
				true,
			);
		}

		return isLive;
	}
}

export const defaultDesktopAgentBridgeRegistry = new DesktopAgentBridgeRegistry();
