import type { DesktopAgentPersistedSession } from './auth.js';
import type {
	DesktopAgentRuntimeSnapshot,
	DesktopAgentSessionRuntime,
	DesktopAgentSessionRuntimeOptions,
} from './session.js';

import { createDesktopAgentSessionRuntime } from './session.js';

export type DesktopAgentShellStatus =
	| 'bootstrapping'
	| 'connected'
	| 'connecting'
	| 'error'
	| 'needs_sign_in'
	| 'ready';

export interface DesktopAgentShellSnapshot {
	readonly agent_id: string;
	readonly connected_at?: string;
	readonly machine_label?: string;
	readonly message?: string;
	readonly session_present: boolean;
	readonly status: DesktopAgentShellStatus;
}

export type DesktopAgentShellListener = (snapshot: DesktopAgentShellSnapshot) => void;

export type DesktopAgentShellUnsubscribe = () => void;

export interface DesktopAgentShell {
	getSnapshot(): DesktopAgentShellSnapshot;
	retry(): Promise<DesktopAgentShellSnapshot>;
	signOut(): Promise<DesktopAgentShellSnapshot>;
	start(): Promise<DesktopAgentShellSnapshot>;
	stop(): Promise<DesktopAgentShellSnapshot>;
	submitSession(session: DesktopAgentPersistedSession): Promise<DesktopAgentShellSnapshot>;
	subscribe(listener: DesktopAgentShellListener): DesktopAgentShellUnsubscribe;
}

export interface DesktopAgentShellOptions extends DesktopAgentSessionRuntimeOptions {
	readonly session_runtime?: DesktopAgentSessionRuntime;
}

function projectShellSnapshot(
	runtimeSnapshot: DesktopAgentRuntimeSnapshot,
): DesktopAgentShellSnapshot {
	switch (runtimeSnapshot.status) {
		case 'bootstrapping':
			return {
				agent_id: runtimeSnapshot.agent_id,
				machine_label: runtimeSnapshot.machine_label,
				message: 'Connecting to Runa',
				session_present: false,
				status: 'bootstrapping',
			};
		case 'signed_in':
			return {
				agent_id: runtimeSnapshot.agent_id,
				machine_label: runtimeSnapshot.machine_label,
				message: 'Ready to connect',
				session_present: true,
				status: 'ready',
			};
		case 'bridge_connecting':
			return {
				agent_id: runtimeSnapshot.agent_id,
				machine_label: runtimeSnapshot.machine_label,
				message: 'Connecting to Runa',
				session_present: true,
				status: 'connecting',
			};
		case 'bridge_connected':
			return {
				agent_id: runtimeSnapshot.agent_id,
				connected_at: runtimeSnapshot.connected_at,
				machine_label: runtimeSnapshot.machine_label,
				message: 'Connected',
				session_present: true,
				status: 'connected',
			};
		case 'bridge_error':
			return {
				agent_id: runtimeSnapshot.agent_id,
				machine_label: runtimeSnapshot.machine_label,
				message: 'Connection failed',
				session_present: true,
				status: 'error',
			};
		case 'signed_out':
			return {
				agent_id: runtimeSnapshot.agent_id,
				machine_label: runtimeSnapshot.machine_label,
				message:
					runtimeSnapshot.reason === 'bootstrap_failed' ||
					runtimeSnapshot.reason === 'refresh_failed'
						? 'Connection failed'
						: 'Sign in required',
				session_present: false,
				status:
					runtimeSnapshot.reason === 'bootstrap_failed' ||
					runtimeSnapshot.reason === 'refresh_failed'
						? 'error'
						: 'needs_sign_in',
			};
	}
}

function resolveShellErrorSnapshot(
	runtimeSnapshot: DesktopAgentRuntimeSnapshot,
): DesktopAgentShellSnapshot {
	return {
		agent_id: runtimeSnapshot.agent_id,
		machine_label: runtimeSnapshot.machine_label,
		message: 'Connection failed',
		session_present: 'session' in runtimeSnapshot,
		status: 'error',
	};
}

function cloneShellSnapshot(snapshot: DesktopAgentShellSnapshot): DesktopAgentShellSnapshot {
	return {
		...snapshot,
	};
}

function areShellSnapshotsEqual(
	left: DesktopAgentShellSnapshot,
	right: DesktopAgentShellSnapshot,
): boolean {
	return (
		left.agent_id === right.agent_id &&
		left.connected_at === right.connected_at &&
		left.machine_label === right.machine_label &&
		left.message === right.message &&
		left.session_present === right.session_present &&
		left.status === right.status
	);
}

const SHELL_RUNTIME_WATCH_INTERVAL_MS = 500;

class DesktopAgentShellImpl implements DesktopAgentShell {
	readonly #runtime: DesktopAgentSessionRuntime;
	readonly #listeners = new Set<DesktopAgentShellListener>();
	#snapshot: DesktopAgentShellSnapshot;
	#watchHandle: ReturnType<typeof setInterval> | null = null;

	constructor(options: DesktopAgentShellOptions) {
		this.#runtime =
			options.session_runtime ??
			createDesktopAgentSessionRuntime({
				agent_id: options.agent_id,
				auth_fetch: options.auth_fetch,
				bridge_factory: options.bridge_factory,
				initial_session: options.initial_session,
				machine_label: options.machine_label,
				server_url: options.server_url,
				session_storage: options.session_storage,
			});
		this.#snapshot = projectShellSnapshot(this.#runtime.getSnapshot());
	}

	getSnapshot(): DesktopAgentShellSnapshot {
		return cloneShellSnapshot(this.#snapshot);
	}

	retry(): Promise<DesktopAgentShellSnapshot> {
		return this.#syncFromRuntime(async () => await this.#runtime.start());
	}

	signOut(): Promise<DesktopAgentShellSnapshot> {
		return this.#syncFromRuntime(async () => await this.#runtime.signOut());
	}

	start(): Promise<DesktopAgentShellSnapshot> {
		return this.#syncFromRuntime(async () => await this.#runtime.start());
	}

	stop(): Promise<DesktopAgentShellSnapshot> {
		return this.#syncFromRuntime(async () => await this.#runtime.stop());
	}

	submitSession(session: DesktopAgentPersistedSession): Promise<DesktopAgentShellSnapshot> {
		return this.#syncFromRuntime(async () => await this.#runtime.setSession(session));
	}

	subscribe(listener: DesktopAgentShellListener): DesktopAgentShellUnsubscribe {
		this.#listeners.add(listener);
		this.#ensureWatchLoop();
		listener(this.getSnapshot());

		return () => {
			this.#listeners.delete(listener);
			this.#stopWatchLoopIfIdle();
		};
	}

	async #syncFromRuntime(
		operation: () => Promise<DesktopAgentRuntimeSnapshot>,
	): Promise<DesktopAgentShellSnapshot> {
		try {
			this.#setSnapshot(projectShellSnapshot(await operation()));
		} catch {
			this.#setSnapshot(resolveShellErrorSnapshot(this.#runtime.getSnapshot()));
		}

		return this.getSnapshot();
	}

	#ensureWatchLoop(): void {
		if (this.#watchHandle || this.#listeners.size === 0) {
			return;
		}

		this.#watchHandle = setInterval(() => {
			const runtimeSnapshot = this.#runtime.getSnapshot();
			this.#setSnapshot(projectShellSnapshot(runtimeSnapshot));
		}, SHELL_RUNTIME_WATCH_INTERVAL_MS);

		if (
			typeof this.#watchHandle === 'object' &&
			this.#watchHandle !== null &&
			'unref' in this.#watchHandle &&
			typeof this.#watchHandle.unref === 'function'
		) {
			this.#watchHandle.unref();
		}
	}

	#stopWatchLoopIfIdle(): void {
		if (this.#listeners.size > 0 || !this.#watchHandle) {
			return;
		}

		clearInterval(this.#watchHandle);
		this.#watchHandle = null;
	}

	#setSnapshot(nextSnapshot: DesktopAgentShellSnapshot): void {
		if (areShellSnapshotsEqual(this.#snapshot, nextSnapshot)) {
			return;
		}

		this.#snapshot = cloneShellSnapshot(nextSnapshot);
		this.#notifyListeners();
	}

	#notifyListeners(): void {
		const snapshot = this.getSnapshot();

		for (const listener of this.#listeners) {
			listener(snapshot);
		}
	}
}

export function createDesktopAgentShell(options: DesktopAgentShellOptions): DesktopAgentShell {
	return new DesktopAgentShellImpl(options);
}
