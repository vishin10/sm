/**
 * FileWatcher - Monitors folders for new XML files
 * Uses chokidar with awaitWriteFinish for file stability
 */
import { EventEmitter } from 'events';
export interface FileReadyEvent {
    filePath: string;
    fileName: string;
    fileHash: string;
    fileSize: number;
    storeId: string;
}
export declare class FileWatcher extends EventEmitter {
    private watchers;
    private processedHashes;
    constructor();
    /**
     * Start watching a folder for a specific store
     */
    startWatching(watchPath: string, storeId: string): boolean;
    /**
     * Stop watching a folder
     */
    stopWatching(watchPath: string): void;
    /**
     * Stop all watchers
     */
    stopAll(): void;
    /**
     * Handle a new or changed file
     */
    private handleNewFile;
    /**
     * Calculate SHA-256 hash of a file
     */
    private calculateHash;
    /**
     * Mark a file hash as uploaded (for duplicate detection)
     */
    markAsUploaded(fileHash: string): void;
    /**
     * Load previously uploaded hashes (for persistence across restarts)
     */
    loadUploadedHashes(hashes: string[]): void;
    /**
     * Get all uploaded hashes (for persistence)
     */
    getUploadedHashes(): string[];
    /**
     * Get list of watched paths
     */
    getWatchedPaths(): string[];
}
//# sourceMappingURL=FileWatcher.d.ts.map