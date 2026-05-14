import type { DesktopAgentBridgeOptions, DesktopAgentBridgeSession } from './ws-bridge.js';

import {
	type DesktopAgentAuthFetch,
	type DesktopAgentBootstrapConfig,
	type DesktopAgentPersistedSession,
	normalizeDesktopAgentPersistedSession,
	refreshDesktopAgentSession,
} from './auth.js';
import { startDesktopAgentBridge } from './ws-bridge.js';

const SESSION_EXPIRING_WINDOW_SECONDS = 90;
const BRIDGE_RECONNECT_INITIAL_DELAY_MS = 1_500;
const BRIDGE_RECONNECT_MAX_DELAY_MS = 30_000;
const BRIDGE_RECONNECT_JITTER_RATIO = 0.2;

export type DesktopAgentSignedOutReason =
	| 'bootstrap_failed'
	| 'missing_session'
	| 'refresh_failed'
	| 'signed_out'
	| 'stopped';

interface DesktopAgentRuntimeSnapshotBase {
	readonly agent_id: string;
	readonly machine_label?: string;
}

export interface DesktopAgentSignedOutSnapshot extends DesktopAgentRuntimeSnapshotBase {
	readonly error_message?: string;
	readonly reason: DesktopAgentSignedOutReason;
	readonly status: 'signed_out';
}

export interface DesktopAgentBootstrappingSnapshot extends DesktopAgentRuntimeSnapshotBase {
	readonly status: 'bootstrapping';
}

export interface DesktopAgentSignedInSnapshot extends DesktopAgentRuntimeSnapshotBase {
	readonly session: DesktopAgentPersistedSession;
	readonly status: 'signed_in';
}

export interface DesktopAgentBridgeConnectingSnapshot extends DesktopAgentRuntimeSnapshotBase {
	readonly session: DesktopAgentPersistedSession;
	readonly status: 'bridge_connecting';
}

export interface DesktopAgentBridgeConnectedSnapshot extends DesktopAgentRuntimeSnapshotBase {
	readonly connected_at: string;
	readonly session: DesktopAgentPersistedSession;
	readonly status: 'bridge_connected';
}

export interface DesktopAgentBridgeErrorSnapshot extends DesktopAgentRuntimeSnapshotBase {
	readonly error_message: string;
	readonly session: DesktopAgentPersistedSession;
	readonly status: 'bridge_error';
}

export type DesktopAgentRuntimeSnapshot =
	| DesktopAgentBootstrappingSnapshot
	| DesktopAgentBridgeConnectedSnapshot
	| DesktopAgentBridgeConnectingSnapshot
	| DesktopAgentBridgeErrorSnapshot
	| DesktopAgentSignedInSnapshot
	| DesktopAgentSignedOutSnapshot;

export interface DesktopAgentSessionStorage {
	clear(): Promise<void>;
	load(): Promise<DesktopAgentPersistedSession | null>;
	save(session: DesktopAgentPersistedSession): Promise<void>;
}

export interface DesktopAgentSessionRuntimeOptions extends DesktopAgentBootstrapConfig {
	readonly auth_fetch?: DesktopAgentAuthFetch;
	readonly bridge_factory?: DesktopAgentBridgeFactory;
	readonly session_storage?: DesktopAgentSessionStorage;
}

export interface DesktopAgentSessionRuntime {
	getSnapshot(): DesktopAgentRuntimeSnapshot;
	setSession(session: DesktopAgentPersistedSession): Promise<DesktopAgentRuntimeSnapshot>;
	signOut(): Promise<DesktopAgentRuntimeSnapshot>;
	start(): Promise<DesktopAgentRuntimeSnapshot>;
	stop(): Promise<DesktopAgentRuntimeSnapshot>;
}

export type DesktopAgentBridgeFactory = (
	options: DesktopAgentBridgeOptions,
) => Promise<DesktopAgentBridgeSession>;

function createSignedOutSnapshot(
	config: DesktopAgentBootstrapConfig,
	reason: DesktopAgentSignedOutReason,
	error_message?: string,
): DesktopAgentSignedOutSnapshot {
	return {
		agent_id: config.agent_id,
		error_message,
		machine_label: config.machine_label,
		reason,
		status: 'signed_out',
	};
}

function createBootstrappingSnapshot(
	config: DesktopAgentBootstrapConfig,
): DesktopAgentBootstrappingSnapshot {
	return {
		agent_id: config.agent_id,
		machine_label: config.machine_label,
		status: 'bootstrapping',
	};
}

function createSignedInSnapshot(
	config: DesktopAgentBootstrapConfig,
	session: DesktopAgentPersistedSession,
): DesktopAgentSignedInSnapshot {
	return {
		agent_id: config.agent_id,
		machine_label: config.machine_label,
		session,
		status: 'signed_in',
	};
}

function createBridgeConnectingSnapshot(
	config: DesktopAgentBootstrapConfig,
	session: DesktopAgentPersistedSession,
): DesktopAgentBridgeConnectingSnapshot {
	return {
		agent_id: config.agent_id,
		machine_label: config.machine_label,
		session,
		status: 'bridge_connecting',
	};
}

function createBridgeConnectedSnapshot(
	config: DesktopAgentBootstrapConfig,
	session: DesktopAgentPersistedSession,
	connectedAt: string,
): DesktopAgentBridgeConnectedSnapshot {
	return {
		agent_id: config.agent_id,
		connected_at: connectedAt,
		machine_label: config.machine_label,
		session,
		status: 'bridge_connected',
	};
}

function createBridgeErrorSnapshot(
	config: DesktopAgentBootstrapConfig,
	session: DesktopAgentPersistedSession,
	error_message: string,
): DesktopAgentBridgeErrorSnapshot {
	return {
		agent_id: config.agent_id,
		error_message,
		machine_label: config.machine_label,
		session,
		status: 'bridge_error',
	};
}

function cloneSession(session: DesktopAgentPersistedSession): DesktopAgentPersistedSession {
	return {
		access_token: session.access_token,
		expires_at: session.expires_at,
		expires_in: session.expires_in,
		refresh_token: session.refresh_token,
		token_type: session.token_type,
	};
}

function cloneSnapshot(snapshot: DesktopAgentRuntimeSnapshot): DesktopAgentRuntimeSnapshot {
	if ('session' in snapshot) {
		return {
			...snapshot,
			session: cloneSession(snapshot.session),
		};
	}

	return {
		...snapshot,
	};
}

function resolveRuntimeErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function shouldRefreshSession(session: DesktopAgentPersistedSession): boolean {
	if (typeof session.expires_at !== 'number') {
		return false;
	}

	const nowSeconds = Math.trunc(Date.now() / 1000);
	return session.expires_at <= nowSeconds + SESSION_EXPIRING_WINDOW_SECONDS;
}

export function resolveDesktopAgentReconnectDelayMs(
	attempt: number,
	randomValue = Math.random(),
): number {
	const safeAttempt = Math.max(0, Math.trunc(attempt));
	const exponentialDelayMs = Math.min(
		BRIDGE_RECONNECT_INITIAL_DELAY_MS * 2 ** safeAttempt,
		BRIDGE_RECONNECT_MAX_DELAY_MS,
	);
	const clampedRandomValue = Math.min(1, Math.max(0, randomValue));
	const jitterWindowMs = Math.round(exponentialDelayMs * BRIDGE_RECONNECT_JITTER_RATIO);
	const jitterMs = Math.round((clampedRandomValue * 2 - 1) * jitterWindowMs);

	return Math.min(BRIDGE_RECONNECT_MAX_DELAY_MS, Math.max(0, exponentialDelayMs + jitterMs));
}

export class InMemoryDesktopAgentSessionStorage implements DesktopAgentSessionStorage {
	#session: DesktopAgentPersistedSession | null;

	constructor(initialSession: DesktopAgentPersistedSession | null = null) {
		this.#session = initialSession ? cloneSession(initialSession) : null;
	}

	async clear(): Promise<void> {
		this.#session = null;
	}

	async load(): Promise<DesktopAgentPersistedSession | null> {
		return this.#session ? cloneSession(this.#session) : null;
	}

	async save(session: DesktopAgentPersistedSession): Promise<void> {
		this.#session = cloneSession(session);
	}
}

class DesktopAgentSessionRuntimeImpl implements DesktopAgentSessionRuntime {
	readonly #options: Required<
		Pick<DesktopAgentSessionRuntimeOptions, 'auth_fetch' | 'bridge_factory' | 'session_storage'>
	> &
		Pick<
			DesktopAgentSessionRuntimeOptions,
			'agent_id' | 'initial_session' | 'machine_label' | 'server_url'
		>;

	#activeSession: DesktopAgentPersistedSession | null;
	#bootstrapSession: DesktopAgentPersistedSession | null;
	#bridgeCleanup: (() => void) | null;
	#bridgeSession: DesktopAgentBridgeSession | null;
	#operation: Promise<void>;
	#reconnectAttempt: number;
	#reconnectTimeout: ReturnType<typeof setTimeout> | null;
	#snapshot: DesktopAgentRuntimeSnapshot;

	constructor(options: DesktopAgentSessionRuntimeOptions) {
		this.#options = {
			agent_id: options.agent_id,
			auth_fetch: options.auth_fetch ?? globalThis.fetch,
			bridge_factory: options.bridge_factory ?? startDesktopAgentBridge,
			initial_session: options.initial_session ? cloneSession(options.initial_session) : undefined,
			machine_label: options.machine_label,
			server_url: options.server_url,
			session_storage:
				options.session_storage ??
				new InMemoryDesktopAgentSessionStorage(options.initial_session ?? null),
		};
		this.#bootstrapSession = options.initial_session ? cloneSession(options.initial_session) : null;
		this.#activeSession = options.initial_session ? cloneSession(options.initial_session) : null;
		this.#bridgeCleanup = null;
		this.#bridgeSession = null;
		this.#operation = Promise.resolve();
		this.#reconnectAttempt = 0;
		this.#reconnectTimeout = null;
		this.#snapshot = createSignedOutSnapshot(
			this.#options,
			options.initial_session ? 'stopped' : 'missing_session',
		);
	}

	getSnapshot(): DesktopAgentRuntimeSnapshot {
		return cloneSnapshot(this.#snapshot);
	}

	start(): Promise<DesktopAgentRuntimeSnapshot> {
		return this.#enqueue(async () => {
			this.#clearReconnectTimeout();

			if (this.#bridgeSession && this.#snapshot.status === 'bridge_connected') {
				return this.getSnapshot();
			}

			this.#setSnapshot(createBootstrappingSnapshot(this.#options));
			const resolvedSession = await this.#resolveBootstrapSession();

			if (!resolvedSession) {
				return this.getSnapshot();
			}

			this.#activeSession = resolvedSession;
			this.#setSnapshot(createSignedInSnapshot(this.#options, resolvedSession));
			this.#setSnapshot(createBridgeConnectingSnapshot(this.#options, resolvedSession));

			try {
				const bridgeSession = await this.#options.bridge_factory({
					access_token: resolvedSession.access_token,
					agent_id: this.#options.agent_id,
					auth_fetch: this.#options.auth_fetch,
					machine_label: this.#options.machine_label,
					server_url: this.#options.server_url,
				});

				this.#bridgeSession = bridgeSession;
				this.#attachBridgeLifecycle(bridgeSession, resolvedSession);
				this.#reconnectAttempt = 0;
				this.#setSnapshot(
					createBridgeConnectedSnapshot(this.#options, resolvedSession, new Date().toISOString()),
				);
			} catch (error: unknown) {
				this.#bridgeSession = null;
				this.#setSnapshot(
					createBridgeErrorSnapshot(
						this.#options,
						resolvedSession,
						resolveRuntimeErrorMessage(error, 'Desktop bridge connection failed.'),
					),
				);
				this.#scheduleReconnect(resolvedSession);
			}

			return this.getSnapshot();
		});
	}

	stop(): Promise<DesktopAgentRuntimeSnapshot> {
		return this.#enqueue(async () => {
			this.#clearReconnectTimeout();
			this.#reconnectAttempt = 0;
			this.#closeBridgeSession(1000, 'Desktop runtime stopped.');

			if (this.#activeSession) {
				this.#setSnapshot(createSignedInSnapshot(this.#options, this.#activeSession));
			} else {
				this.#setSnapshot(createSignedOutSnapshot(this.#options, 'stopped'));
			}

			return this.getSnapshot();
		});
	}

	setSession(session: DesktopAgentPersistedSession): Promise<DesktopAgentRuntimeSnapshot> {
		return this.#enqueue(async () => {
			const normalizedSession = normalizeDesktopAgentPersistedSession(session);

			this.#clearReconnectTimeout();
			this.#reconnectAttempt = 0;
			this.#closeBridgeSession(1000, 'Desktop runtime session updated.');
			await this.#options.session_storage.save(normalizedSession);
			this.#activeSession = cloneSession(normalizedSession);
			this.#bootstrapSession = cloneSession(normalizedSession);
			this.#setSnapshot(createSignedInSnapshot(this.#options, normalizedSession));

			return this.getSnapshot();
		});
	}

	signOut(): Promise<DesktopAgentRuntimeSnapshot> {
		return this.#enqueue(async () => {
			this.#clearReconnectTimeout();
			this.#reconnectAttempt = 0;
			this.#closeBridgeSession(1000, 'Desktop runtime signed out.');
			await this.#options.session_storage.clear();
			this.#activeSession = null;
			this.#bootstrapSession = null;
			this.#setSnapshot(createSignedOutSnapshot(this.#options, 'signed_out'));
			return this.getSnapshot();
		});
	}

	async #resolveBootstrapSession(): Promise<DesktopAgentPersistedSession | null> {
		try {
			const storedSession = await this.#options.session_storage.load();
			const candidateSession =
				storedSession ?? this.#bootstrapSession ?? this.#activeSession ?? null;

			if (!candidateSession) {
				this.#setSnapshot(createSignedOutSnapshot(this.#options, 'missing_session'));
				return null;
			}

			let normalizedSession = normalizeDesktopAgentPersistedSession(candidateSession);

			if (shouldRefreshSession(normalizedSession)) {
				if (!normalizedSession.refresh_token) {
					await this.#options.session_storage.clear();
					this.#activeSession = null;
					this.#bootstrapSession = null;
					this.#setSnapshot(
						createSignedOutSnapshot(
							this.#options,
							'refresh_failed',
							'Desktop agent session expired and no refresh token was available.',
						),
					);
					return null;
				}

				try {
					normalizedSession = await refreshDesktopAgentSession({
						auth_fetch: this.#options.auth_fetch,
						server_url: this.#options.server_url,
						session: normalizedSession,
					});
				} catch (error: unknown) {
					await this.#options.session_storage.clear();
					this.#activeSession = null;
					this.#bootstrapSession = null;
					this.#setSnapshot(
						createSignedOutSnapshot(
							this.#options,
							'refresh_failed',
							resolveRuntimeErrorMessage(error, 'Desktop agent session refresh failed.'),
						),
					);
					return null;
				}
			}

			await this.#options.session_storage.save(normalizedSession);
			this.#bootstrapSession = cloneSession(normalizedSession);

			return normalizedSession;
		} catch (error: unknown) {
			this.#activeSession = null;
			this.#setSnapshot(
				createSignedOutSnapshot(
					this.#options,
					'bootstrap_failed',
					resolveRuntimeErrorMessage(error, 'Desktop agent session bootstrap failed.'),
				),
			);
			return null;
		}
	}

	#attachBridgeLifecycle(
		bridgeSession: DesktopAgentBridgeSession,
		session: DesktopAgentPersistedSession,
	): void {
		const handleClose = (event: CloseEvent) => {
			if (this.#bridgeSession !== bridgeSession) {
				return;
			}

			this.#bridgeSession = null;
			this.#detachBridgeLifecycle();
			this.#setSnapshot(
				createBridgeErrorSnapshot(
					this.#options,
					session,
					event.reason || `Desktop bridge closed with code ${String(event.code)}.`,
				),
			);
			this.#scheduleReconnect(session);
		};
		const handleError = () => {
			if (this.#bridgeSession !== bridgeSession) {
				return;
			}

			this.#bridgeSession = null;
			this.#detachBridgeLifecycle();
			this.#setSnapshot(
				createBridgeErrorSnapshot(this.#options, session, 'Desktop bridge socket error.'),
			);
			this.#scheduleReconnect(session);
		};

		bridgeSession.socket.addEventListener('close', handleClose);
		bridgeSession.socket.addEventListener('error', handleError);
		this.#bridgeCleanup = () => {
			bridgeSession.socket.removeEventListener('close', handleClose);
			bridgeSession.socket.removeEventListener('error', handleError);
		};
	}

	#closeBridgeSession(code: number, reason: string): void {
		const bridgeSession = this.#bridgeSession;

		if (!bridgeSession) {
			return;
		}

		this.#bridgeSession = null;
		this.#detachBridgeLifecycle();
		bridgeSession.close(code, reason);
	}

	#detachBridgeLifecycle(): void {
		this.#bridgeCleanup?.();
		this.#bridgeCleanup = null;
	}

	#clearReconnectTimeout(): void {
		if (this.#reconnectTimeout === null) {
			return;
		}

		clearTimeout(this.#reconnectTimeout);
		this.#reconnectTimeout = null;
	}

	#enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const runOperation = this.#operation.then(operation, operation);
		this.#operation = runOperation.then(
			() => undefined,
			() => undefined,
		);
		return runOperation;
	}

	#scheduleReconnect(session: DesktopAgentPersistedSession): void {
		if (this.#reconnectTimeout !== null || this.#activeSession === null) {
			return;
		}

		const reconnectSession = cloneSession(session);
		const reconnectDelayMs = resolveDesktopAgentReconnectDelayMs(this.#reconnectAttempt);
		this.#reconnectAttempt += 1;
		this.#reconnectTimeout = setTimeout(() => {
			this.#reconnectTimeout = null;

			if (this.#activeSession === null) {
				return;
			}

			this.#bootstrapSession = reconnectSession;
			void this.start();
		}, reconnectDelayMs);
	}

	#setSnapshot(snapshot: DesktopAgentRuntimeSnapshot): void {
		this.#snapshot = cloneSnapshot(snapshot);
	}
}

export function createDesktopAgentSessionRuntime(
	options: DesktopAgentSessionRuntimeOptions,
): DesktopAgentSessionRuntime {
	return new DesktopAgentSessionRuntimeImpl(options);
}
