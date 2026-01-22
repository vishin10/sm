/**
 * Silent Manager Agent - Main Electron Process
 * Manages file watching, uploads, system tray, and auto-updates
 */

import { app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { FileWatcher, FileReadyEvent } from './FileWatcher';
import { UploadQueue } from './UploadQueue';
import { ConfigManager } from './ConfigManager';
import { Notifier } from './Notifier';
import { ApiClient } from './ApiClient';

class AgentApp {
    private tray: Tray | null = null;
    private setupWindow: BrowserWindow | null = null;
    private fileWatcher: FileWatcher;
    private uploadQueue: UploadQueue | null = null;
    private config: ConfigManager;
    private notifier: Notifier;
    private isOnline: boolean = false;
    private lastUploadAt: Date | null = null;
    private uploadsToday: number = 0;

    constructor() {
        this.config = new ConfigManager();
        this.notifier = new Notifier();
        this.fileWatcher = new FileWatcher();

        // Set up file watcher event handler
        this.fileWatcher.on('fileReady', (event: FileReadyEvent) => {
            this.handleNewFile(event);
        });

        this.fileWatcher.on('error', (error) => {
            console.error('File watcher error:', error);
        });
    }

    async start(): Promise<void> {
        const fs = require('fs');
        try {
            fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - AgentApp.start() called\n`);
            fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - Configured: ${this.config.isConfigured()}\n`);
            fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - Stores: ${JSON.stringify(this.config.getStores())}\n`);
        } catch (e) { }

        // Single instance lock
        const gotTheLock = app.requestSingleInstanceLock();
        if (!gotTheLock) {
            app.quit();
            return;
        }

        // Check if configured
        if (!this.config.isConfigured()) {
            this.showSetupWindow();
        } else {
            await this.startMonitoring();
        }

        this.createTray();
        this.setupIpcHandlers();
        this.checkForUpdates();

        // Auto-start with Windows
        if (this.config.getAutoStart()) {
            app.setLoginItemSettings({
                openAtLogin: true,
                path: app.getPath('exe')
            });
        }
    }

    /**
     * Start monitoring all configured stores
     */
    private async startMonitoring(): Promise<void> {
        const baseUrl = this.config.getBaseUrl();
        this.uploadQueue = new UploadQueue(baseUrl);

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
    private async handleNewFile(event: FileReadyEvent): Promise<void> {
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
    private async checkConnection(): Promise<void> {
        const stores = this.config.getStores();
        if (stores.length === 0) return;

        try {
            const apiKey = this.config.getApiKey(stores[0].storeId);
            if (!apiKey) {
                this.isOnline = false;
                return;
            }

            const client = new ApiClient(this.config.getBaseUrl(), apiKey);
            const result = await client.heartbeat();

            this.isOnline = result.status === 'ok';
            this.uploadsToday = result.uploadsToday;

            if (result.lastUploadAt) {
                this.lastUploadAt = new Date(result.lastUploadAt);
            }

            this.updateTrayMenu();
        } catch (error) {
            this.isOnline = false;
            this.updateTrayMenu();
        }
    }

    /**
     * Create system tray
     */
    private createTray(): void {
        const iconPath = path.join(__dirname, '../../assets/icon.png');
        const icon = nativeImage.createFromPath(iconPath);

        this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
        this.tray.setToolTip('Silent Manager Agent');

        this.updateTrayMenu();
    }

    /**
     * Update tray menu with current status
     */
    private updateTrayMenu(): void {
        if (!this.tray) return;

        const statusIcon = this.isOnline ? '🟢' : '🔴';
        const statusText = this.isOnline ? 'Connected' : 'Offline';

        const stores = this.config.getStores();
        const storeNames = stores.map(s => s.storeName).join(', ') || 'Not configured';

        const lastUpload = this.lastUploadAt
            ? `Last upload: ${this.lastUploadAt.toLocaleTimeString()}`
            : 'No uploads yet';

        const contextMenu = Menu.buildFromTemplate([
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
                            app.setLoginItemSettings({ openAtLogin: item.checked });
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
                    app.quit();
                }
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    /**
     * Show setup window for PIN entry
     */
    private showSetupWindow(): void {
        if (this.setupWindow) {
            this.setupWindow.focus();
            return;
        }

        this.setupWindow = new BrowserWindow({
            width: 500,
            height: 600,
            resizable: false,
            frame: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload.js')
            }
        });

        this.setupWindow.loadFile(path.join(__dirname, '../renderer/setup.html'));

        this.setupWindow.on('closed', () => {
            this.setupWindow = null;
        });
    }

    /**
     * Set up IPC handlers for renderer communication
     */
    private setupIpcHandlers(): void {
        // Register with PIN
        ipcMain.handle('register', async (event, pin: string, deviceName: string, baseUrl: string) => {
            try {
                this.config.setBaseUrl(baseUrl);
                const client = new ApiClient(baseUrl);
                const result = await client.register(pin, deviceName);

                return { success: true, ...result };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.response?.data?.error?.message || error.message
                };
            }
        });

        // Save store configuration
        ipcMain.handle('saveStore', async (event, storeId: string, storeName: string, apiKey: string, watchPath: string) => {
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
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        // Select folder dialog
        ipcMain.handle('selectFolder', async () => {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Select folder to watch for shift reports'
            });

            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }

            return result.filePaths[0];
        });

        // Get current config
        ipcMain.handle('getConfig', () => {
            return {
                stores: this.config.getStores(),
                baseUrl: this.config.getBaseUrl()
            };
        });
    }

    /**
     * Check for updates
     */
    private checkForUpdates(): void {
        autoUpdater.checkForUpdatesAndNotify().catch(console.error);
    }

    /**
     * Cleanup before exit
     */
    private cleanup(): void {
        this.fileWatcher.stopAll();
        this.uploadQueue?.destroy();
    }
}

// Start the app
app.whenReady().then(() => {
    const agent = new AgentApp();
    agent.start();
});

// Keep app running in system tray
app.on('window-all-closed', (e: Event) => {
    e.preventDefault();
});
