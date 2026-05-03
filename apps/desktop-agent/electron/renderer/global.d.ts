/**
 * Global type declarations for Runa Desktop Agent renderer.
 */

import type {
	DesktopAgentLaunchControllerViewModel,
	DesktopAgentSessionInputPayload,
} from '../../src/index.js';

interface RunaDesktopShellInvokeActionPayload {
	readonly actionId: DesktopAgentLaunchControllerViewModel['primary_action']['id'];
}

interface RunaDesktopAPI {
	platform: string;
	versions: {
		node: string;
		chrome: string;
		electron: string;
	};

	getAgentStatus(): Promise<unknown>;
	getShellState(): Promise<unknown>;
	getViewModel(): Promise<DesktopAgentLaunchControllerViewModel>;
	invokeAction(
		payload: RunaDesktopShellInvokeActionPayload,
	): Promise<DesktopAgentLaunchControllerViewModel>;

	connect(): Promise<unknown>;
	disconnect(): Promise<unknown>;
	submitSession(
		sessionData: DesktopAgentSessionInputPayload,
	): Promise<DesktopAgentLaunchControllerViewModel>;
	signIn(sessionData: DesktopAgentSessionInputPayload): Promise<unknown>;
	signOut(): Promise<unknown>;

	onViewModelChange(
		callback: (viewModel: DesktopAgentLaunchControllerViewModel) => void,
	): () => void;
	onShellStateChange(callback: (state: unknown) => void): () => void;
}

declare global {
	interface Window {
		runaDesktop: RunaDesktopAPI;
	}
}
