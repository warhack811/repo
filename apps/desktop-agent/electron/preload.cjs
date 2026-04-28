/**
 * Runa Desktop Agent - Electron Preload Script
 *
 * Secure IPC bridge between main process and renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('runaDesktop', {
	// Platform info
	platform: process.platform,

	// App info
	versions: {
		node: process.versions.node,
		chrome: process.versions.chrome,
		electron: process.versions.electron,
	},

	// Shell state
	getShellState: () => {
		return {
			status: 'needs_sign_in',
			agentConnected: false,
			sessionValid: false,
		};
	},

	// Event listeners
	onShellStateChange: (callback) => {
		const listener = (_event, state) => callback(state);
		ipcRenderer.on('shell:stateChanged', listener);
		return () => {
			ipcRenderer.removeListener('shell:stateChanged', listener);
		};
	},
});
