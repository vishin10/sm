/**
 * FileWatcher - Monitors folders for new XML files
 * Uses chokidar with awaitWriteFinish for file stability
 */

import chokidar, { FSWatcher } from 'chokidar';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface FileReadyEvent {
    filePath: string;
    fileName: string;
    fileHash: string;
    fileSize: number;
    storeId: string;
}

export class FileWatcher extends EventEmitter {
    private watchers: Map<string, FSWatcher> = new Map();
    private processedHashes: Set<string> = new Set();

    constructor() {
        super();
    }

    /**
     * Start watching a folder for a specific store
     */
    startWatching(watchPath: string, storeId: string): boolean {
        if (this.watchers.has(watchPath)) {
            console.log(`Already watching: ${watchPath}`);
            return false;
        }

        if (!fs.existsSync(watchPath)) {
            console.error(`Watch path does not exist: ${watchPath}`);
            return false;
        }

        const watcher = chokidar.watch(watchPath, {
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
    stopWatching(watchPath: string): void {
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
    stopAll(): void {
        for (const [watchPath, watcher] of this.watchers) {
            watcher.close();
            console.log(`Stopped watching: ${watchPath}`);
        }
        this.watchers.clear();
    }

    /**
     * Handle a new or changed file
     */
    private async handleNewFile(filePath: string, storeId: string): Promise<void> {
        // Only process XML files
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.xml') {
            return;
        }

        try {
            const stats = fs.statSync(filePath);
            const fileHash = await this.calculateHash(filePath);

            // Skip if already processed
            if (this.processedHashes.has(fileHash)) {
                console.log(`Skipping already processed file: ${filePath}`);
                return;
            }

            const event: FileReadyEvent = {
                filePath,
                fileName: path.basename(filePath),
                fileHash,
                fileSize: stats.size,
                storeId
            };

            console.log(`New file ready: ${event.fileName} (${event.fileHash.substring(0, 8)}...)`);
            this.emit('fileReady', event);

        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            this.emit('error', { filePath, error });
        }
    }

    /**
     * Calculate SHA-256 hash of a file
     */
    private calculateHash(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Mark a file hash as uploaded (for duplicate detection)
     */
    markAsUploaded(fileHash: string): void {
        this.processedHashes.add(fileHash);
    }

    /**
     * Load previously uploaded hashes (for persistence across restarts)
     */
    loadUploadedHashes(hashes: string[]): void {
        for (const hash of hashes) {
            this.processedHashes.add(hash);
        }
    }

    /**
     * Get all uploaded hashes (for persistence)
     */
    getUploadedHashes(): string[] {
        return Array.from(this.processedHashes);
    }

    /**
     * Get list of watched paths
     */
    getWatchedPaths(): string[] {
        return Array.from(this.watchers.keys());
    }
}
