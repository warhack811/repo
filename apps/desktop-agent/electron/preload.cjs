"use strict";

// electron/preload.mts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("runaDesktop", {
  // Platform info
  platform: process.platform,
  // App info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  // Desktop agent connection status
  getAgentStatus: () => import_electron.ipcRenderer.invoke("agent:getStatus"),
  // Shell state
  getShellState: () => import_electron.ipcRenderer.invoke("shell:getState"),
  connect: () => import_electron.ipcRenderer.invoke("shell:connect"),
  disconnect: () => import_electron.ipcRenderer.invoke("shell:disconnect"),
  // Actions
  signIn: (sessionData) => import_electron.ipcRenderer.invoke("session:signIn", sessionData),
  signOut: () => import_electron.ipcRenderer.invoke("session:signOut"),
  // Event listeners
  onShellStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    import_electron.ipcRenderer.on("shell:stateChanged", listener);
    return () => {
      import_electron.ipcRenderer.removeListener("shell:stateChanged", listener);
    };
  }
});
//# sourceMappingURL=preload.cjs.map
