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
	getViewModel: () => ipcRenderer.invoke('shell:getViewModel'),
	invokeAction: (payload: unknown) => ipcRenderer.invoke('shell:invokeAction', payload),
	getShellState: () => ipcRenderer.invoke('shell:getState'),
	connect: () => ipcRenderer.invoke('shell:connect'),
	disconnect: () => ipcRenderer.invoke('shell:disconnect'),

	// Actions
	submitSession: (sessionData: unknown) => ipcRenderer.invoke('session:submit', sessionData),
	signIn: (sessionData: unknown) => ipcRenderer.invoke('session:signIn', sessionData),
	signOut: () => ipcRenderer.invoke('session:signOut'),

	// Event listeners
	onViewModelChange: (callback: (viewModel: unknown) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, viewModel: unknown) => callback(viewModel);
		ipcRenderer.on('shell:viewModel', listener);
		return () => {
			ipcRenderer.removeListener('shell:viewModel', listener);
		};
	},
	onShellStateChange: (callback: (state: unknown) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state);
		ipcRenderer.on('shell:stateChanged', listener);
		return () => {
			ipcRenderer.removeListener('shell:stateChanged', listener);
		};
	},
});
