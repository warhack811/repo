import type { DesktopAgentPersistedSession } from './auth.js';
import type {
	DesktopAgentShell,
	DesktopAgentShellOptions,
	DesktopAgentShellSnapshot,
	DesktopAgentShellStatus,
} from './shell.js';

import { createDesktopAgentShell } from './shell.js';

export type DesktopAgentLaunchSurfaceStatus = DesktopAgentShellStatus;

export interface DesktopAgentLaunchAction {
	readonly id: 'connect' | 'connecting' | 'retry' | 'sign_in' | 'sign_out';
	readonly label: string;
}

export interface DesktopAgentLaunchSurfaceSnapshot {
	readonly agent_id: string;
	readonly connected_at?: string;
	readonly machine_label?: string;
	readonly message?: string;
	readonly session_present: boolean;
	readonly status: DesktopAgentLaunchSurfaceStatus;
}

export interface DesktopAgentLaunchViewModel {
	readonly agent_id: string;
	readonly connected_at?: string;
	readonly machine_label?: string;
	readonly message: string;
	readonly primary_action: DesktopAgentLaunchAction;
	readonly secondary_action?: DesktopAgentLaunchAction;
	readonly session_present: boolean;
	readonly status: DesktopAgentLaunchSurfaceStatus;
	readonly title: string;
}

export type DesktopAgentLaunchSurfaceListener = (
	snapshot: DesktopAgentLaunchSurfaceSnapshot,
	viewModel: DesktopAgentLaunchViewModel,
) => void;

export type DesktopAgentLaunchSurfaceUnsubscribe = () => void;

export interface DesktopAgentLaunchSurface {
	getSnapshot(): DesktopAgentLaunchSurfaceSnapshot;
	getViewModel(): DesktopAgentLaunchViewModel;
	retry(): Promise<DesktopAgentLaunchSurfaceSnapshot>;
	signOut(): Promise<DesktopAgentLaunchSurfaceSnapshot>;
	start(): Promise<DesktopAgentLaunchSurfaceSnapshot>;
	stop(): Promise<DesktopAgentLaunchSurfaceSnapshot>;
	submitSession(session: DesktopAgentPersistedSession): Promise<DesktopAgentLaunchSurfaceSnapshot>;
	subscribe(listener: DesktopAgentLaunchSurfaceListener): DesktopAgentLaunchSurfaceUnsubscribe;
}

export interface DesktopAgentLaunchSurfaceOptions extends DesktopAgentShellOptions {
	readonly shell?: DesktopAgentShell;
}

function cloneLaunchAction(action: DesktopAgentLaunchAction): DesktopAgentLaunchAction {
	return {
		...action,
	};
}

function cloneLaunchSnapshot(
	snapshot: DesktopAgentLaunchSurfaceSnapshot,
): DesktopAgentLaunchSurfaceSnapshot {
	return {
		...snapshot,
	};
}

function cloneLaunchViewModel(viewModel: DesktopAgentLaunchViewModel): DesktopAgentLaunchViewModel {
	return {
		...viewModel,
		primary_action: cloneLaunchAction(viewModel.primary_action),
		secondary_action: viewModel.secondary_action
			? cloneLaunchAction(viewModel.secondary_action)
			: undefined,
	};
}

function projectLaunchSurfaceSnapshot(
	shellSnapshot: DesktopAgentShellSnapshot,
): DesktopAgentLaunchSurfaceSnapshot {
	return {
		agent_id: shellSnapshot.agent_id,
		connected_at: shellSnapshot.connected_at,
		machine_label: shellSnapshot.machine_label,
		message: shellSnapshot.message,
		session_present: shellSnapshot.session_present,
		status: shellSnapshot.status,
	};
}

function resolveLaunchViewModel(
	snapshot: DesktopAgentLaunchSurfaceSnapshot,
): DesktopAgentLaunchViewModel {
	switch (snapshot.status) {
		case 'needs_sign_in':
			return {
				agent_id: snapshot.agent_id,
				machine_label: snapshot.machine_label,
				message: 'Sign in to connect this computer to Runa.',
				primary_action: {
					id: 'sign_in',
					label: 'Sign in',
				},
				session_present: snapshot.session_present,
				status: snapshot.status,
				title: 'Sign in required',
			};
		case 'bootstrapping':
			return {
				agent_id: snapshot.agent_id,
				machine_label: snapshot.machine_label,
				message: 'Checking your saved session.',
				primary_action: {
					id: 'connecting',
					label: 'Checking session',
				},
				session_present: snapshot.session_present,
				status: snapshot.status,
				title: 'Connecting to Runa',
			};
		case 'ready':
			return {
				agent_id: snapshot.agent_id,
				machine_label: snapshot.machine_label,
				message: 'Your session is ready when you want to connect.',
				primary_action: {
					id: 'connect',
					label: 'Connect',
				},
				secondary_action: {
					id: 'sign_out',
					label: 'Sign out',
				},
				session_present: snapshot.session_present,
				status: snapshot.status,
				title: 'Ready to connect',
			};
		case 'connecting':
			return {
				agent_id: snapshot.agent_id,
				machine_label: snapshot.machine_label,
				message: 'Connecting to Runa.',
				primary_action: {
					id: 'connecting',
					label: 'Connecting',
				},
				secondary_action: {
					id: 'sign_out',
					label: 'Sign out',
				},
				session_present: snapshot.session_present,
				status: snapshot.status,
				title: 'Connecting to Runa',
			};
		case 'connected':
			return {
				agent_id: snapshot.agent_id,
				connected_at: snapshot.connected_at,
				machine_label: snapshot.machine_label,
				message: 'This computer is connected and ready.',
				primary_action: {
					id: 'connect',
					label: 'Connected',
				},
				secondary_action: {
					id: 'sign_out',
					label: 'Sign out',
				},
				session_present: snapshot.session_present,
				status: snapshot.status,
				title: 'Connected',
			};
		case 'error':
			return {
				agent_id: snapshot.agent_id,
				machine_label: snapshot.machine_label,
				message: snapshot.session_present
					? 'We could not connect right now. You can try again.'
					: 'Sign in again to continue.',
				primary_action: snapshot.session_present
					? {
							id: 'retry',
							label: 'Try again',
						}
					: {
							id: 'sign_in',
							label: 'Sign in',
						},
				secondary_action: snapshot.session_present
					? {
							id: 'sign_out',
							label: 'Sign out',
						}
					: undefined,
				session_present: snapshot.session_present,
				status: snapshot.status,
				title: 'Connection failed',
			};
	}
}

class DesktopAgentLaunchSurfaceImpl implements DesktopAgentLaunchSurface {
	readonly #listeners = new Set<DesktopAgentLaunchSurfaceListener>();
	readonly #shell: DesktopAgentShell;
	#snapshot: DesktopAgentLaunchSurfaceSnapshot;
	#viewModel: DesktopAgentLaunchViewModel;

	constructor(options: DesktopAgentLaunchSurfaceOptions) {
		this.#shell =
			options.shell ??
			createDesktopAgentShell({
				agent_id: options.agent_id,
				auth_fetch: options.auth_fetch,
				bridge_factory: options.bridge_factory,
				initial_session: options.initial_session,
				machine_label: options.machine_label,
				server_url: options.server_url,
				session_runtime: options.session_runtime,
				session_storage: options.session_storage,
			});
		this.#snapshot = projectLaunchSurfaceSnapshot(this.#shell.getSnapshot());
		this.#viewModel = resolveLaunchViewModel(this.#snapshot);
		this.#shell.subscribe((shellSnapshot) => {
			this.#sync(shellSnapshot);
		});
	}

	getSnapshot(): DesktopAgentLaunchSurfaceSnapshot {
		return cloneLaunchSnapshot(this.#snapshot);
	}

	getViewModel(): DesktopAgentLaunchViewModel {
		return cloneLaunchViewModel(this.#viewModel);
	}

	retry(): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		return this.#run(async () => await this.#shell.retry());
	}

	signOut(): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		return this.#run(async () => await this.#shell.signOut());
	}

	start(): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		return this.#run(async () => await this.#shell.start());
	}

	stop(): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		return this.#run(async () => await this.#shell.stop());
	}

	submitSession(session: DesktopAgentPersistedSession): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		return this.#run(async () => await this.#shell.submitSession(session));
	}

	subscribe(listener: DesktopAgentLaunchSurfaceListener): DesktopAgentLaunchSurfaceUnsubscribe {
		this.#listeners.add(listener);
		listener(this.getSnapshot(), this.getViewModel());

		return () => {
			this.#listeners.delete(listener);
		};
	}

	async #run(
		operation: () => Promise<DesktopAgentShellSnapshot>,
	): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		await operation();
		return this.getSnapshot();
	}

	#sync(shellSnapshot: DesktopAgentShellSnapshot): void {
		this.#snapshot = projectLaunchSurfaceSnapshot(shellSnapshot);
		this.#viewModel = resolveLaunchViewModel(this.#snapshot);
		this.#notifyListeners();
	}

	#notifyListeners(): void {
		if (this.#listeners.size === 0) {
			return;
		}

		const snapshot = this.getSnapshot();
		const viewModel = this.getViewModel();

		for (const listener of this.#listeners) {
			listener(snapshot, viewModel);
		}
	}
}

export function createDesktopAgentLaunchSurface(
	options: DesktopAgentLaunchSurfaceOptions,
): DesktopAgentLaunchSurface {
	return new DesktopAgentLaunchSurfaceImpl(options);
}
