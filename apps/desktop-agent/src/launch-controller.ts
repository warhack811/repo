import type { DesktopAgentPersistedSession, DesktopAgentSessionInputPayload } from './auth.js';
import type { DesktopAgentLaunchDocumentViewModel } from './launch-html.js';
import type {
	DesktopAgentLaunchSurface,
	DesktopAgentLaunchSurfaceOptions,
	DesktopAgentLaunchSurfaceSnapshot,
	DesktopAgentLaunchSurfaceStatus,
	DesktopAgentLaunchViewModel,
} from './launch-surface.js';
import type { DesktopAgentWindowActionEvent, DesktopAgentWindowHost } from './window-host.js';

import { normalizeDesktopAgentSessionInputPayload } from './auth.js';
import { renderDesktopAgentLaunchDocument } from './launch-html.js';
import { createDesktopAgentLaunchSurface } from './launch-surface.js';
import { maskDesktopPairingCode } from './protocol-handler.js';
import { createNoopDesktopAgentWindowHost } from './window-host.js';

export type DesktopAgentLaunchControllerStatus =
	| DesktopAgentLaunchSurfaceStatus
	| 'awaiting_session_input';

export interface DesktopAgentLaunchControllerSnapshot {
	readonly agent_id: string;
	readonly awaiting_session_input: boolean;
	readonly connected_at?: string;
	readonly machine_label?: string;
	readonly message?: string;
	readonly session_present: boolean;
	readonly status: DesktopAgentLaunchControllerStatus;
}

export interface DesktopAgentLaunchControllerViewModel extends DesktopAgentLaunchDocumentViewModel {
	readonly awaiting_session_input: boolean;
	readonly status: DesktopAgentLaunchControllerStatus;
}

export interface DesktopAgentLaunchController {
	getSnapshot(): DesktopAgentLaunchControllerSnapshot;
	getViewModel(): DesktopAgentLaunchControllerViewModel;
	handlePairingCode(code: string): Promise<DesktopAgentLaunchControllerSnapshot>;
	invokeAction(
		actionId: DesktopAgentLaunchControllerViewModel['primary_action']['id'],
	): Promise<DesktopAgentLaunchControllerSnapshot>;
	signOut(): Promise<DesktopAgentLaunchControllerSnapshot>;
	start(): Promise<DesktopAgentLaunchControllerSnapshot>;
	stop(): Promise<DesktopAgentLaunchControllerSnapshot>;
	submitSession(
		session: DesktopAgentSessionInputPayload,
	): Promise<DesktopAgentLaunchControllerSnapshot>;
}

export interface DesktopAgentLaunchControllerLogger {
	warn(message: string): void;
}

export interface DesktopAgentLaunchControllerOptions extends DesktopAgentLaunchSurfaceOptions {
	readonly host?: DesktopAgentWindowHost;
	readonly launch_surface?: DesktopAgentLaunchSurface;
	readonly logger?: DesktopAgentLaunchControllerLogger;
}

const noopLaunchControllerLogger: DesktopAgentLaunchControllerLogger = {
	warn: () => {},
};

function cloneControllerSnapshot(
	snapshot: DesktopAgentLaunchControllerSnapshot,
): DesktopAgentLaunchControllerSnapshot {
	return {
		...snapshot,
	};
}

function cloneControllerViewModel(
	viewModel: DesktopAgentLaunchControllerViewModel,
): DesktopAgentLaunchControllerViewModel {
	return {
		...viewModel,
		primary_action: {
			...viewModel.primary_action,
		},
		secondary_action: viewModel.secondary_action
			? {
					...viewModel.secondary_action,
				}
			: undefined,
		session_input: viewModel.session_input
			? {
					...viewModel.session_input,
				}
			: undefined,
	};
}

function projectControllerSnapshot(
	snapshot: DesktopAgentLaunchSurfaceSnapshot,
	awaitingSessionInput: boolean,
	awaitingSessionMessage?: string,
): DesktopAgentLaunchControllerSnapshot {
	if (awaitingSessionInput) {
		return {
			agent_id: snapshot.agent_id,
			awaiting_session_input: true,
			machine_label: snapshot.machine_label,
			message: awaitingSessionMessage ?? 'Paste your session to continue connecting this computer.',
			session_present: snapshot.session_present,
			status: 'awaiting_session_input',
		};
	}

	return {
		agent_id: snapshot.agent_id,
		awaiting_session_input: false,
		connected_at: snapshot.connected_at,
		machine_label: snapshot.machine_label,
		message: snapshot.message,
		session_present: snapshot.session_present,
		status: snapshot.status,
	};
}

function resolvePrimaryAction(
	viewModel: DesktopAgentLaunchViewModel,
): DesktopAgentLaunchControllerViewModel['primary_action'] {
	switch (viewModel.status) {
		case 'needs_sign_in':
			return {
				id: 'sign_in',
				label: viewModel.primary_action.label,
			};
		case 'error':
			return {
				id: viewModel.session_present ? 'retry' : 'sign_in',
				label: viewModel.primary_action.label,
			};
		case 'bootstrapping':
		case 'connecting':
		case 'connected':
		case 'ready':
			return {
				id: 'connect',
				label: viewModel.primary_action.label,
			};
	}
}

function resolveSecondaryAction(
	viewModel: DesktopAgentLaunchViewModel,
	awaitingSessionInput: boolean,
): DesktopAgentLaunchControllerViewModel['secondary_action'] {
	if (awaitingSessionInput && viewModel.session_present) {
		return {
			id: 'sign_out',
			label: 'Sign out',
		};
	}

	if (!viewModel.secondary_action) {
		return undefined;
	}

	return {
		id: 'sign_out',
		label: viewModel.secondary_action.label,
	};
}

function projectControllerViewModel(
	snapshot: DesktopAgentLaunchSurfaceSnapshot,
	viewModel: DesktopAgentLaunchViewModel,
	awaitingSessionInput: boolean,
	awaitingSessionMessage?: string,
): DesktopAgentLaunchControllerViewModel {
	if (awaitingSessionInput) {
		return {
			agent_id: snapshot.agent_id,
			awaiting_session_input: true,
			machine_label: snapshot.machine_label,
			message: awaitingSessionMessage ?? 'Paste your session to continue connecting this computer.',
			primary_action: {
				id: 'submit_session',
				label: 'Continue',
			},
			session_present: snapshot.session_present,
			session_input: {
				access_token_label: 'Access token',
				refresh_token_label: 'Refresh token',
			},
			status: 'awaiting_session_input',
			title: 'Sign in required',
		};
	}

	return {
		agent_id: snapshot.agent_id,
		awaiting_session_input: false,
		connected_at: snapshot.connected_at,
		machine_label: snapshot.machine_label,
		message: viewModel.message,
		primary_action: resolvePrimaryAction(viewModel),
		secondary_action: resolveSecondaryAction(viewModel, false),
		session_present: snapshot.session_present,
		status: snapshot.status,
		title: viewModel.title,
	};
}

class DesktopAgentLaunchControllerImpl implements DesktopAgentLaunchController {
	readonly #host: DesktopAgentWindowHost;
	readonly #launchSurface: DesktopAgentLaunchSurface;
	readonly #logger: DesktopAgentLaunchControllerLogger;
	#awaitingSessionInput = false;
	#mounted = false;
	#started = false;
	#surfaceSnapshot: DesktopAgentLaunchSurfaceSnapshot;
	#surfaceViewModel: DesktopAgentLaunchViewModel;
	#sessionInputMessage: string | null = null;
	#snapshot: DesktopAgentLaunchControllerSnapshot;
	#surfaceUnsubscribe: (() => void) | null = null;
	#pendingPairingCode: string | null = null;
	#viewModel: DesktopAgentLaunchControllerViewModel;

	constructor(options: DesktopAgentLaunchControllerOptions) {
		this.#host = options.host ?? createNoopDesktopAgentWindowHost();
		this.#logger = options.logger ?? noopLaunchControllerLogger;
		this.#launchSurface =
			options.launch_surface ??
			createDesktopAgentLaunchSurface({
				agent_id: options.agent_id,
				auth_fetch: options.auth_fetch,
				bridge_factory: options.bridge_factory,
				initial_session: options.initial_session,
				machine_label: options.machine_label,
				server_url: options.server_url,
				session_runtime: options.session_runtime,
				session_storage: options.session_storage,
				shell: options.shell,
			});
		this.#surfaceSnapshot = this.#launchSurface.getSnapshot();
		this.#surfaceViewModel = this.#launchSurface.getViewModel();
		this.#snapshot = projectControllerSnapshot(this.#surfaceSnapshot, false);
		this.#viewModel = projectControllerViewModel(
			this.#surfaceSnapshot,
			this.#surfaceViewModel,
			false,
		);
	}

	getSnapshot(): DesktopAgentLaunchControllerSnapshot {
		return cloneControllerSnapshot(this.#snapshot);
	}

	getViewModel(): DesktopAgentLaunchControllerViewModel {
		return cloneControllerViewModel(this.#viewModel);
	}

	async handlePairingCode(code: string): Promise<DesktopAgentLaunchControllerSnapshot> {
		this.#pendingPairingCode = code;
		this.#awaitingSessionInput = true;
		this.#sessionInputMessage = `Pairing code received, exchanging ${maskDesktopPairingCode(
			code,
		)}.`;
		this.#syncFromSurface();
		await this.#render('update');
		return this.getSnapshot();
	}

	async invokeAction(
		actionId: DesktopAgentLaunchControllerViewModel['primary_action']['id'],
	): Promise<DesktopAgentLaunchControllerSnapshot> {
		if (actionId === 'submit_session') {
			this.#awaitingSessionInput = true;
			this.#sessionInputMessage = null;
			this.#syncFromSurface();
			await this.#render('update');
			return this.getSnapshot();
		}

		await this.#handleAction({ id: actionId });
		return this.getSnapshot();
	}

	signOut(): Promise<DesktopAgentLaunchControllerSnapshot> {
		this.#awaitingSessionInput = false;
		this.#sessionInputMessage = null;
		return this.#run(async () => await this.#launchSurface.signOut());
	}

	async start(): Promise<DesktopAgentLaunchControllerSnapshot> {
		if (this.#started) {
			return this.getSnapshot();
		}

		this.#started = true;
		await this.#host.setActionHandler(async (event) => {
			await this.#handleAction(event);
		});
		this.#surfaceUnsubscribe = this.#launchSurface.subscribe((snapshot, viewModel) => {
			this.#surfaceSnapshot = snapshot;
			this.#surfaceViewModel = viewModel;
			this.#syncAwaitingSessionInputFromSurface();
			this.#syncFromSurface();

			if (this.#mounted) {
				void this.#render('update');
			}
		});
		await this.#render('mount');
		this.#mounted = true;
		this.#surfaceSnapshot = await this.#launchSurface.start();
		this.#surfaceViewModel = this.#launchSurface.getViewModel();
		this.#syncAwaitingSessionInputFromSurface();
		this.#syncFromSurface();
		await this.#render('update');
		return this.getSnapshot();
	}

	async stop(): Promise<DesktopAgentLaunchControllerSnapshot> {
		if (!this.#started) {
			return this.getSnapshot();
		}

		this.#awaitingSessionInput = false;
		this.#sessionInputMessage = null;
		await this.#launchSurface.stop();
		this.#surfaceUnsubscribe?.();
		this.#surfaceUnsubscribe = null;
		this.#mounted = false;
		await this.#host.dispose();
		this.#started = false;
		return this.getSnapshot();
	}

	async submitSession(
		session: DesktopAgentSessionInputPayload,
	): Promise<DesktopAgentLaunchControllerSnapshot> {
		await this.#handleSessionSubmit(session);
		return this.getSnapshot();
	}

	async #handleAction(event: DesktopAgentWindowActionEvent): Promise<void> {
		switch (event.id) {
			case 'connect':
				await this.#launchSurface.start();
				return;
			case 'connecting':
				return;
			case 'retry':
				await this.#launchSurface.retry();
				return;
			case 'sign_out':
				this.#awaitingSessionInput = false;
				this.#sessionInputMessage = null;
				await this.#launchSurface.signOut();
				return;
			case 'sign_in':
				this.#awaitingSessionInput = true;
				this.#sessionInputMessage = null;
				this.#syncFromSurface();
				await this.#render('update');
				return;
			case 'submit_session':
				await this.#handleSessionSubmit(event.payload);
				return;
		}
	}

	async #run(
		operation: () => Promise<DesktopAgentLaunchSurfaceSnapshot>,
	): Promise<DesktopAgentLaunchControllerSnapshot> {
		this.#surfaceSnapshot = await operation();
		this.#surfaceViewModel = this.#launchSurface.getViewModel();
		this.#syncAwaitingSessionInputFromSurface();
		this.#syncFromSurface();

		if (this.#started) {
			await this.#render('update');
		}

		return this.getSnapshot();
	}

	async #render(mode: 'mount' | 'update'): Promise<void> {
		const viewModel = this.getViewModel();
		const document = renderDesktopAgentLaunchDocument(viewModel);

		if (mode === 'mount') {
			await this.#host.mount(document, viewModel);
			return;
		}

		await this.#host.update(document, viewModel);
	}

	#syncFromSurface(): void {
		this.#snapshot = projectControllerSnapshot(
			this.#surfaceSnapshot,
			this.#awaitingSessionInput,
			this.#sessionInputMessage ?? undefined,
		);
		this.#viewModel = projectControllerViewModel(
			this.#surfaceSnapshot,
			this.#surfaceViewModel,
			this.#awaitingSessionInput,
			this.#sessionInputMessage ?? undefined,
		);
	}

	#syncAwaitingSessionInputFromSurface(): void {
		if (
			!this.#surfaceSnapshot.session_present &&
			this.#surfaceSnapshot.status === 'needs_sign_in'
		) {
			this.#awaitingSessionInput = true;
			this.#sessionInputMessage = null;
		}
	}

	async #handleSessionSubmit(payload: DesktopAgentSessionInputPayload): Promise<void> {
		this.#awaitingSessionInput = true;

		if (this.#pendingPairingCode) {
			// TODO(Task #3): exchange the pairing code for a desktop session via the auth API.
			this.#logger.warn('Desktop pairing code exchange is not implemented yet.');
			this.#sessionInputMessage = 'Pairing code exchange is not available in this build yet.';
			this.#syncFromSurface();
			await this.#render('update');
			return;
		}

		let normalizedSession: DesktopAgentPersistedSession;

		try {
			normalizedSession = normalizeDesktopAgentSessionInputPayload(payload);
		} catch (error: unknown) {
			this.#sessionInputMessage = this.#resolveSessionInputMessage(error);
			this.#syncFromSurface();
			await this.#render('update');
			return;
		}

		this.#sessionInputMessage = null;
		this.#awaitingSessionInput = false;
		await this.#run(async () => await this.#launchSurface.submitSession(normalizedSession));
	}

	#resolveSessionInputMessage(error: unknown): string {
		if (error instanceof Error) {
			const message = error.message.trim();

			if (message.length > 0) {
				return message;
			}
		}

		return 'Paste a valid session to continue.';
	}
}

export function createDesktopAgentLaunchController(
	options: DesktopAgentLaunchControllerOptions,
): DesktopAgentLaunchController {
	return new DesktopAgentLaunchControllerImpl(options);
}
