/**
 * Runa Desktop Agent - Electron Preload Script
 *
 * Secure IPC bridge between main process and renderer.
 * Exposes minimal, safe APIs to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';

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

	// Desktop agent connection status
	getAgentStatus: () => ipcRenderer.invoke('agent:getStatus'),

	// Shell state
	getShellState: () => ipcRenderer.invoke('shell:getState'),

	// Actions
	signIn: (sessionData: unknown) => ipcRenderer.invoke('session:signIn', sessionData),
	signOut: () => ipcRenderer.invoke('session:signOut'),

	// Event listeners
	onShellStateChange: (callback: (state: unknown) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state);
		ipcRenderer.on('shell:stateChanged', listener);
		return () => {
			ipcRenderer.removeListener('shell:stateChanged', listener);
		};
	},
});
