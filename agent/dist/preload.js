"use strict";
/**
 * Preload script - Exposes safe IPC methods to renderer
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Register with PIN
    register: (pin, deviceName, baseUrl) => electron_1.ipcRenderer.invoke('register', pin, deviceName, baseUrl),
    // Save store configuration
    saveStore: (storeId, storeName, apiKey, watchPath) => electron_1.ipcRenderer.invoke('saveStore', storeId, storeName, apiKey, watchPath),
    // Select folder dialog
    selectFolder: () => electron_1.ipcRenderer.invoke('selectFolder'),
    // Get current configuration
    getConfig: () => electron_1.ipcRenderer.invoke('getConfig')
});
//# sourceMappingURL=preload.js.map