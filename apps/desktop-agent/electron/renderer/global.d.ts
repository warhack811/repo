/**
 * Global type declarations for Runa Desktop Agent renderer
 */

interface RunaDesktopAPI {
	platform: string;
	versions: {
		node: string;
		chrome: string;
		electron: string;
	};

	getAgentStatus(): Promise<unknown>;
	getShellState(): Promise<unknown>;

	signIn(sessionData: unknown): Promise<unknown>;
	signOut(): Promise<unknown>;

	onShellStateChange(callback: (state: unknown) => void): () => void;
}

declare global {
	interface Window {
		runaDesktop: RunaDesktopAPI;
	}
}

export {};
