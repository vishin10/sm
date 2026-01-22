/**
 * ConfigManager - Manages agent configuration using electron-store
 * Stores: API keys per store, watched folders, settings
 * Note: Using electron-store for API key storage (encrypted at rest)
 */
interface StoreConfig {
    storeId: string;
    storeName: string;
    watchPath: string;
    apiKey: string;
}
export declare class ConfigManager {
    private store;
    constructor();
    /**
     * Get API key for a store
     */
    getApiKey(storeId: string): string | null;
    /**
     * Add a new store configuration
     */
    addStore(config: StoreConfig): void;
    /**
     * Remove a store configuration
     */
    removeStore(storeId: string): void;
    /**
     * Get all store configurations
     */
    getStores(): StoreConfig[];
    /**
     * Get a specific store configuration
     */
    getStore(storeId: string): StoreConfig | undefined;
    getBaseUrl(): string;
    setBaseUrl(url: string): void;
    getAutoStart(): boolean;
    setAutoStart(enabled: boolean): void;
    getShowNotifications(): boolean;
    setShowNotifications(enabled: boolean): void;
    getUploadedHashes(): string[];
    addUploadedHash(hash: string): void;
    isHashUploaded(hash: string): boolean;
    isConfigured(): boolean;
}
export {};
//# sourceMappingURL=ConfigManager.d.ts.map