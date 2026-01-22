"use strict";
/**
 * Silent Manager Agent - Main Electron Process
 * Manages file watching, uploads, system tray, and auto-updates
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const path_1 = __importDefault(require("path"));
const FileWatcher_1 = require("./FileWatcher");
const UploadQueue_1 = require("./UploadQueue");
const ConfigManager_1 = require("./ConfigManager");
const Notifier_1 = require("./Notifier");
const ApiClient_1 = require("./ApiClient");
class AgentApp {
    constructor() {
        this.tray = null;
        this.setupWindow = null;
        this.uploadQueue = null;
        this.isOnline = false;
        this.lastUploadAt = null;
        this.uploadsToday = 0;
        this.config = new ConfigManager_1.ConfigManager();
        this.notifier = new Notifier_1.Notifier();
        this.fileWatcher = new FileWatcher_1.FileWatcher();
        // Set up file watcher event handler
        this.fileWatcher.on('fileReady', (event) => {
            this.handleNewFile(event);
        });
        this.fileWatcher.on('error', (error) => {
            console.error('File watcher error:', error);
        });
    }
    async start() {
        const fs = require('fs');
        try {
            fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - AgentApp.start() called\n`);
            fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - Configured: ${this.config.isConfigured()}\n`);
            fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - Stores: ${JSON.stringify(this.config.getStores())}\n`);
        }
        catch (e) { }
        // Single instance lock
        const gotTheLock = electron_1.app.requestSingleInstanceLock();
        if (!gotTheLock) {
            electron_1.app.quit();
            return;
        }
        // Check if configured
        if (!this.config.isConfigured()) {
            this.showSetupWindow();
        }
        else {
            await this.startMonitoring();
        }
        this.createTray();
        this.setupIpcHandlers();
        this.checkForUpdates();
        // Auto-start with Windows
        if (this.config.getAutoStart()) {
            electron_1.app.setLoginItemSettings({
                openAtLogin: true,
                path: electron_1.app.getPath('exe')
            });
        }
    }
    /**
     * Start monitoring all configured stores
     */
    async startMonitoring() {
        const baseUrl = this.config.getBaseUrl();
        this.uploadQueue = new UploadQueue_1.UploadQueue(baseUrl);
        // Set up upload callbacks
        this.uploadQueue.setOnSuccess((job, result) => {
            this.fileWatcher.markAsUploaded(job.fileHash);
            this.config.addUploadedHash(job.fileHash);
            this.lastUploadAt = new Date();
            this.uploadsToday++;
            const store = this.config.getStore(job.storeId);
            if (this.config.getShowNotifications()) {
                this.notifier.uploadSuccess(job.fileName, store?.storeName || 'Unknown Store');
            }
            this.updateTrayMenu();
        });
        this.uploadQueue.setOnFailure((job, error) => {
            if (this.config.getShowNotifications()) {
                this.notifier.uploadFailed(job.fileName, error.message);
            }
        });
        // Load previously uploaded hashes
        this.fileWatcher.loadUploadedHashes(this.config.getUploadedHashes());
        // Start watching each configured store's folder
        const stores = this.config.getStores();
        for (const store of stores) {
            this.fileWatcher.startWatching(store.watchPath, store.storeId);
        }
        // Test connection
        await this.checkConnection();
        // Heartbeat every 5 minutes
        setInterval(() => this.checkConnection(), 5 * 60 * 1000);
    }
    /**
     * Handle new file detected
     */
    async handleNewFile(event) {
        // Skip if already uploaded locally
        if (this.config.isHashUploaded(event.fileHash)) {
            console.log(`Skipping already uploaded file: ${event.fileName}`);
            return;
        }
        // Get API key for this store
        const apiKey = this.config.getApiKey(event.storeId);
        if (!apiKey) {
            console.error(`No API key found for store ${event.storeId}`);
            return;
        }
        // Add to upload queue
        this.uploadQueue?.addToQueue({
            filePath: event.filePath,
            fileName: event.fileName,
            fileHash: event.fileHash,
            fileSize: event.fileSize,
            storeId: event.storeId,
            apiKey
        });
    }
    /**
     * Check connection to backend
     */
    async checkConnection() {
        const stores = this.config.getStores();
        if (stores.length === 0)
            return;
        try {
            const apiKey = this.config.getApiKey(stores[0].storeId);
            if (!apiKey) {
                this.isOnline = false;
                return;
            }
            const client = new ApiClient_1.ApiClient(this.config.getBaseUrl(), apiKey);
            const result = await client.heartbeat();
            this.isOnline = result.status === 'ok';
            this.uploadsToday = result.uploadsToday;
            if (result.lastUploadAt) {
                this.lastUploadAt = new Date(result.lastUploadAt);
            }
            this.updateTrayMenu();
        }
        catch (error) {
            this.isOnline = false;
            this.updateTrayMenu();
        }
    }
    /**
     * Create system tray
     */
    createTray() {
        const iconPath = path_1.default.join(__dirname, '../../assets/icon.png');
        const icon = electron_1.nativeImage.createFromPath(iconPath);
        this.tray = new electron_1.Tray(icon.resize({ width: 16, height: 16 }));
        this.tray.setToolTip('Silent Manager Agent');
        this.updateTrayMenu();
    }
    /**
     * Update tray menu with current status
     */
    updateTrayMenu() {
        if (!this.tray)
            return;
        const statusIcon = this.isOnline ? '🟢' : '🔴';
        const statusText = this.isOnline ? 'Connected' : 'Offline';
        const stores = this.config.getStores();
        const storeNames = stores.map(s => s.storeName).join(', ') || 'Not configured';
        const lastUpload = this.lastUploadAt
            ? `Last upload: ${this.lastUploadAt.toLocaleTimeString()}`
            : 'No uploads yet';
        const contextMenu = electron_1.Menu.buildFromTemplate([
            {
                label: `${statusIcon} ${statusText}`,
                enabled: false
            },
            {
                label: `Stores: ${storeNames}`,
                enabled: false
            },
            {
                label: `Uploads today: ${this.uploadsToday}`,
                enabled: false
            },
            {
                label: lastUpload,
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Add Store...',
                click: () => this.showSetupWindow()
            },
            {
                label: 'Settings',
                submenu: [
                    {
                        label: 'Start with Windows',
                        type: 'checkbox',
                        checked: this.config.getAutoStart(),
                        click: (item) => {
                            this.config.setAutoStart(item.checked);
                            electron_1.app.setLoginItemSettings({ openAtLogin: item.checked });
                        }
                    },
                    {
                        label: 'Show Notifications',
                        type: 'checkbox',
                        checked: this.config.getShowNotifications(),
                        click: (item) => {
                            this.config.setShowNotifications(item.checked);
                        }
                    }
                ]
            },
            {
                label: 'Check for Updates',
                click: () => this.checkForUpdates()
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    this.cleanup();
                    electron_1.app.quit();
                }
            }
        ]);
        this.tray.setContextMenu(contextMenu);
    }
    /**
     * Show setup window for PIN entry
     */
    showSetupWindow() {
        if (this.setupWindow) {
            this.setupWindow.focus();
            return;
        }
        this.setupWindow = new electron_1.BrowserWindow({
            width: 500,
            height: 600,
            resizable: false,
            frame: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path_1.default.join(__dirname, '../preload.js')
            }
        });
        this.setupWindow.loadFile(path_1.default.join(__dirname, '../renderer/setup.html'));
        this.setupWindow.on('closed', () => {
            this.setupWindow = null;
        });
    }
    /**
     * Set up IPC handlers for renderer communication
     */
    setupIpcHandlers() {
        // Register with PIN
        electron_1.ipcMain.handle('register', async (event, pin, deviceName, baseUrl) => {
            try {
                this.config.setBaseUrl(baseUrl);
                const client = new ApiClient_1.ApiClient(baseUrl);
                const result = await client.register(pin, deviceName);
                return { success: true, ...result };
            }
            catch (error) {
                return {
                    success: false,
                    error: error.response?.data?.error?.message || error.message
                };
            }
        });
        // Save store configuration
        electron_1.ipcMain.handle('saveStore', async (event, storeId, storeName, apiKey, watchPath) => {
            try {
                // Verify path exists
                const fs = require('fs');
                if (!fs.existsSync(watchPath)) {
                    return { success: false, error: 'Watch path does not exist' };
                }
                // Save store config (apiKey is stored encrypted with config)
                this.config.addStore({ storeId, storeName, watchPath, apiKey });
                // Start watching
                this.fileWatcher.startWatching(watchPath, storeId);
                // Initialize upload queue if needed
                if (!this.uploadQueue) {
                    await this.startMonitoring();
                }
                this.updateTrayMenu();
                if (this.config.getShowNotifications()) {
                    this.notifier.connected(storeName);
                }
                return { success: true };
            }
            catch (error) {
                return { success: false, error: error.message };
            }
        });
        // Select folder dialog
        electron_1.ipcMain.handle('selectFolder', async () => {
            const result = await electron_1.dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Select folder to watch for shift reports'
            });
            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }
            return result.filePaths[0];
        });
        // Get current config
        electron_1.ipcMain.handle('getConfig', () => {
            return {
                stores: this.config.getStores(),
                baseUrl: this.config.getBaseUrl()
            };
        });
    }
    /**
     * Check for updates
     */
    checkForUpdates() {
        electron_updater_1.autoUpdater.checkForUpdatesAndNotify().catch(console.error);
    }
    /**
     * Cleanup before exit
     */
    cleanup() {
        this.fileWatcher.stopAll();
        this.uploadQueue?.destroy();
    }
}
// Start the app
electron_1.app.whenReady().then(() => {
    const agent = new AgentApp();
    agent.start();
});
// Keep app running in system tray
electron_1.app.on('window-all-closed', (e) => {
    e.preventDefault();
});
//# sourceMappingURL=index.js.map