import type { DesktopAgentLaunchControllerViewModel } from './launch-controller.js';
import type {
	DesktopAgentWindowActionHandler,
	DesktopAgentWindowDocument,
	DesktopAgentWindowHost,
} from './window-host.js';

export interface ElectronWindowHostWebContents {
	send(channel: 'shell:viewModel', viewModel: DesktopAgentLaunchControllerViewModel): void;
	send(channel: 'shell:stateChanged', shellState: ElectronWindowHostLegacyShellState): void;
}

export interface ElectronWindowHostBrowserWindow {
	readonly webContents: ElectronWindowHostWebContents;
}

export interface ElectronWindowHostTray {
	setToolTip(toolTip: string): void;
}

export interface ElectronDesktopAgentWindowHostOptions {
	readonly insecureStorageWarning?: boolean;
	readonly mainWindow: ElectronWindowHostBrowserWindow | null;
	readonly tray: ElectronWindowHostTray | null;
}

export type ElectronWindowHostLegacyShellState = Readonly<{
	agentConnected: boolean;
	errorMessage?: string;
	sessionValid: boolean;
	status: 'connected' | 'connecting' | 'error' | 'needs_sign_in' | 'stopped';
}>;

const TOOLTIP_BY_STATUS: Record<DesktopAgentLaunchControllerViewModel['status'], string> = {
	awaiting_session_input: 'Runa Desktop - Sign in required',
	bootstrapping: 'Runa Desktop - Checking session...',
	connected: 'Runa Desktop - Connected',
	connecting: 'Runa Desktop - Connecting...',
	error: 'Runa Desktop - Connection needs attention',
	needs_sign_in: 'Runa Desktop - Sign in required',
	ready: 'Runa Desktop - Ready',
};

function cloneViewModel(
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

function projectLegacyShellState(
	viewModel: DesktopAgentLaunchControllerViewModel,
): ElectronWindowHostLegacyShellState {
	switch (viewModel.status) {
		case 'bootstrapping':
		case 'connecting':
			return {
				agentConnected: false,
				sessionValid: viewModel.session_present,
				status: 'connecting',
			};
		case 'connected':
			return {
				agentConnected: true,
				sessionValid: true,
				status: 'connected',
			};
		case 'error':
			return {
				agentConnected: false,
				errorMessage: viewModel.message,
				sessionValid: viewModel.session_present,
				status: 'error',
			};
		case 'awaiting_session_input':
		case 'needs_sign_in':
			return {
				agentConnected: false,
				sessionValid: false,
				status: 'needs_sign_in',
			};
		case 'ready':
			return {
				agentConnected: false,
				sessionValid: true,
				status: 'stopped',
			};
	}
}

class ElectronDesktopAgentWindowHost implements DesktopAgentWindowHost {
	readonly #options: ElectronDesktopAgentWindowHostOptions;
	#disposed = false;

	constructor(options: ElectronDesktopAgentWindowHostOptions) {
		this.#options = options;
	}

	dispose(): void {
		this.#disposed = true;
	}

	mount(
		_document: DesktopAgentWindowDocument,
		viewModel?: DesktopAgentLaunchControllerViewModel,
	): void {
		this.#publish(viewModel);
	}

	setActionHandler(_handler: DesktopAgentWindowActionHandler): void {
		this.#disposed = false;
	}

	update(
		_document: DesktopAgentWindowDocument,
		viewModel?: DesktopAgentLaunchControllerViewModel,
	): void {
		this.#publish(viewModel);
	}

	#publish(viewModel?: DesktopAgentLaunchControllerViewModel): void {
		if (this.#disposed || !viewModel) {
			return;
		}

		const clonedViewModel = cloneViewModel(viewModel);
		this.#options.mainWindow?.webContents.send('shell:viewModel', clonedViewModel);
		this.#options.mainWindow?.webContents.send(
			'shell:stateChanged',
			projectLegacyShellState(clonedViewModel),
		);
		const toolTip = this.#options.insecureStorageWarning
			? `${TOOLTIP_BY_STATUS[clonedViewModel.status]} - insecure storage`
			: TOOLTIP_BY_STATUS[clonedViewModel.status];
		this.#options.tray?.setToolTip(toolTip);
	}
}

export function createElectronDesktopAgentWindowHost(
	options: ElectronDesktopAgentWindowHostOptions,
): DesktopAgentWindowHost {
	return new ElectronDesktopAgentWindowHost(options);
}
