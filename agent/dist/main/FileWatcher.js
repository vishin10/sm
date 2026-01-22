"use strict";
/**
 * FileWatcher - Monitors folders for new XML files
 * Uses chokidar with awaitWriteFinish for file stability
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatcher = void 0;
const chokidar_1 = __importDefault(require("chokidar"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
class FileWatcher extends events_1.EventEmitter {
    constructor() {
        super();
        this.watchers = new Map();
        this.processedHashes = new Set();
    }
    /**
     * Start watching a folder for a specific store
     */
    startWatching(watchPath, storeId) {
        const fs = require('fs');
        try {
            fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - startWatching called for ${watchPath}\n`);
        }
        catch (e) { }
        if (this.watchers.has(watchPath)) {
            console.log(`Already watching: ${watchPath}`);
            return false;
        }
        if (!fs.existsSync(watchPath)) {
            console.error(`Watch path does not exist: ${watchPath}`);
            return false;
        }
        const watcher = chokidar_1.default.watch(watchPath, {
            ignored: /(^|[\/\\])\../, // ignore hidden files
            persistent: true,
            ignoreInitial: false, // Process existing files on start
            awaitWriteFinish: {
                stabilityThreshold: 2000, // Wait 2 seconds for file to stabilize
                pollInterval: 100
            },
            depth: 0 // Only watch immediate directory, not subdirs
        });
        watcher.on('add', (filePath) => {
            console.log(`[FileWatcher] ADD event: ${filePath}`);
            this.handleNewFile(filePath, storeId);
        });
        watcher.on('change', (filePath) => {
            console.log(`[FileWatcher] CHANGE event: ${filePath}`);
            this.handleNewFile(filePath, storeId);
        });
        watcher.on('error', (error) => {
            console.error(`Watcher error for ${watchPath}:`, error);
            this.emit('error', { watchPath, error });
        });
        watcher.on('ready', () => {
            console.log(`[FileWatcher] READY - Now watching: ${watchPath}`);
        });
        this.watchers.set(watchPath, watcher);
        console.log(`Started watching: ${watchPath} for store ${storeId}`);
        return true;
    }
    /**
     * Stop watching a folder
     */
    stopWatching(watchPath) {
        const watcher = this.watchers.get(watchPath);
        if (watcher) {
            watcher.close();
            this.watchers.delete(watchPath);
            console.log(`Stopped watching: ${watchPath}`);
        }
    }
    /**
     * Stop all watchers
     */
    stopAll() {
        for (const [watchPath, watcher] of this.watchers) {
            watcher.close();
            console.log(`Stopped watching: ${watchPath}`);
        }
        this.watchers.clear();
    }
    /**
     * Handle a new or changed file
     */
    async handleNewFile(filePath, storeId) {
        // Only process XML files
        const ext = path_1.default.extname(filePath).toLowerCase();
        if (ext !== '.xml') {
            return;
        }
        try {
            const stats = fs_1.default.statSync(filePath);
            const fileHash = await this.calculateHash(filePath);
            // Skip if already processed
            if (this.processedHashes.has(fileHash)) {
                console.log(`Skipping already processed file: ${filePath}`);
                return;
            }
            const event = {
                filePath,
                fileName: path_1.default.basename(filePath),
                fileHash,
                fileSize: stats.size,
                storeId
            };
            console.log(`New file ready: ${event.fileName} (${event.fileHash.substring(0, 8)}...)`);
            this.emit('fileReady', event);
        }
        catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            this.emit('error', { filePath, error });
        }
    }
    /**
     * Calculate SHA-256 hash of a file
     */
    calculateHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto_1.default.createHash('sha256');
            const stream = fs_1.default.createReadStream(filePath);
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    /**
     * Mark a file hash as uploaded (for duplicate detection)
     */
    markAsUploaded(fileHash) {
        this.processedHashes.add(fileHash);
    }
    /**
     * Load previously uploaded hashes (for persistence across restarts)
     */
    loadUploadedHashes(hashes) {
        for (const hash of hashes) {
            this.processedHashes.add(hash);
        }
    }
    /**
     * Get all uploaded hashes (for persistence)
     */
    getUploadedHashes() {
        return Array.from(this.processedHashes);
    }
    /**
     * Get list of watched paths
     */
    getWatchedPaths() {
        return Array.from(this.watchers.keys());
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=FileWatcher.js.map