/**
 * ConfigManager - Manages agent configuration using electron-store
 * Stores: API keys per store, watched folders, settings
 * Note: Using electron-store for API key storage (encrypted at rest)
 */

import Store from 'electron-store';

interface StoreConfig {
    storeId: string;
    storeName: string;
    watchPath: string;
    apiKey: string; // Stored encrypted by electron-store
}

interface AppConfig {
    stores: StoreConfig[];
    baseUrl: string;
    uploadedHashes: string[];
    autoStart: boolean;
    showNotifications: boolean;
}

const defaults: AppConfig = {
    stores: [],
    baseUrl: 'http://localhost:3000',
    uploadedHashes: [],
    autoStart: true,
    showNotifications: true
};

export class ConfigManager {
    private store: Store<AppConfig>;

    constructor() {
        this.store = new Store<AppConfig>({
            name: 'config',
            defaults,
            encryptionKey: 'silent-manager-agent-key' // Encrypts the config file
        });
    }

    // ==========================================
    // API Key Management
    // ==========================================

    /**
     * Get API key for a store
     */
    getApiKey(storeId: string): string | null {
        const store = this.store.get('stores').find(s => s.storeId === storeId);
        return store?.apiKey || null;
    }

    // ==========================================
    // Store Configuration
    // ==========================================

    /**
     * Add a new store configuration
     */
    addStore(config: StoreConfig): void {
        const stores = this.store.get('stores');
        const existing = stores.findIndex(s => s.storeId === config.storeId);

        if (existing >= 0) {
            stores[existing] = config;
        } else {
            stores.push(config);
        }

        this.store.set('stores', stores);
    }

    /**
     * Remove a store configuration
     */
    removeStore(storeId: string): void {
        const stores = this.store.get('stores');
        this.store.set('stores', stores.filter(s => s.storeId !== storeId));
    }

    /**
     * Get all store configurations
     */
    getStores(): StoreConfig[] {
        return this.store.get('stores');
    }

    /**
     * Get a specific store configuration
     */
    getStore(storeId: string): StoreConfig | undefined {
        return this.store.get('stores').find(s => s.storeId === storeId);
    }

    // ==========================================
    // General Settings
    // ==========================================

    getBaseUrl(): string {
        return this.store.get('baseUrl');
    }

    setBaseUrl(url: string): void {
        this.store.set('baseUrl', url);
    }

    getAutoStart(): boolean {
        return this.store.get('autoStart');
    }

    setAutoStart(enabled: boolean): void {
        this.store.set('autoStart', enabled);
    }

    getShowNotifications(): boolean {
        return this.store.get('showNotifications');
    }

    setShowNotifications(enabled: boolean): void {
        this.store.set('showNotifications', enabled);
    }

    // ==========================================
    // Upload Hash Tracking (for deduplication)
    // ==========================================

    getUploadedHashes(): string[] {
        return this.store.get('uploadedHashes');
    }

    addUploadedHash(hash: string): void {
        const hashes = this.store.get('uploadedHashes');
        if (!hashes.includes(hash)) {
            // Keep only last 10000 hashes
            if (hashes.length >= 10000) {
                hashes.shift();
            }
            hashes.push(hash);
            this.store.set('uploadedHashes', hashes);
        }
    }

    isHashUploaded(hash: string): boolean {
        return this.store.get('uploadedHashes').includes(hash);
    }

    // ==========================================
    // Check if agent is configured
    // ==========================================

    isConfigured(): boolean {
        return this.store.get('stores').length > 0;
    }
}
