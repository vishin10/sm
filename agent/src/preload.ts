/**
 * Preload script - Exposes safe IPC methods to renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Register with PIN
    register: (pin: string, deviceName: string, baseUrl: string) =>
        ipcRenderer.invoke('register', pin, deviceName, baseUrl),

    // Save store configuration
    saveStore: (storeId: string, storeName: string, apiKey: string, watchPath: string) =>
        ipcRenderer.invoke('saveStore', storeId, storeName, apiKey, watchPath),

    // Select folder dialog
    selectFolder: () => ipcRenderer.invoke('selectFolder'),

    // Get current configuration
    getConfig: () => ipcRenderer.invoke('getConfig')
});
