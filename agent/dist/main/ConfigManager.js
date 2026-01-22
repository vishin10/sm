"use strict";
/**
 * ConfigManager - Manages agent configuration using electron-store
 * Stores: API keys per store, watched folders, settings
 * Note: Using electron-store for API key storage (encrypted at rest)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const electron_store_1 = __importDefault(require("electron-store"));
const defaults = {
    stores: [],
    baseUrl: 'http://localhost:3000',
    uploadedHashes: [],
    autoStart: true,
    showNotifications: true
};
class ConfigManager {
    constructor() {
        this.store = new electron_store_1.default({
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
    getApiKey(storeId) {
        const store = this.store.get('stores').find(s => s.storeId === storeId);
        return store?.apiKey || null;
    }
    // ==========================================
    // Store Configuration
    // ==========================================
    /**
     * Add a new store configuration
     */
    addStore(config) {
        const stores = this.store.get('stores');
        const existing = stores.findIndex(s => s.storeId === config.storeId);
        if (existing >= 0) {
            stores[existing] = config;
        }
        else {
            stores.push(config);
        }
        this.store.set('stores', stores);
    }
    /**
     * Remove a store configuration
     */
    removeStore(storeId) {
        const stores = this.store.get('stores');
        this.store.set('stores', stores.filter(s => s.storeId !== storeId));
    }
    /**
     * Get all store configurations
     */
    getStores() {
        return this.store.get('stores');
    }
    /**
     * Get a specific store configuration
     */
    getStore(storeId) {
        return this.store.get('stores').find(s => s.storeId === storeId);
    }
    // ==========================================
    // General Settings
    // ==========================================
    getBaseUrl() {
        return this.store.get('baseUrl');
    }
    setBaseUrl(url) {
        this.store.set('baseUrl', url);
    }
    getAutoStart() {
        return this.store.get('autoStart');
    }
    setAutoStart(enabled) {
        this.store.set('autoStart', enabled);
    }
    getShowNotifications() {
        return this.store.get('showNotifications');
    }
    setShowNotifications(enabled) {
        this.store.set('showNotifications', enabled);
    }
    // ==========================================
    // Upload Hash Tracking (for deduplication)
    // ==========================================
    getUploadedHashes() {
        return this.store.get('uploadedHashes');
    }
    addUploadedHash(hash) {
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
    isHashUploaded(hash) {
        return this.store.get('uploadedHashes').includes(hash);
    }
    // ==========================================
    // Check if agent is configured
    // ==========================================
    isConfigured() {
        return this.store.get('stores').length > 0;
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=ConfigManager.js.map