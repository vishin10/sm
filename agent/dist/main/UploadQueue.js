"use strict";
/**
 * UploadQueue - Simple file-based retry queue for uploads
 * Uses electron-store for persistence (no native SQLite needed)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadQueue = void 0;
const electron_store_1 = __importDefault(require("electron-store"));
const ApiClient_1 = require("./ApiClient");
class UploadQueue {
    constructor(baseUrl) {
        this.processing = false;
        this.processInterval = null;
        // Retry delays in ms: 5s, 30s, 2min
        this.retryDelays = [5000, 30000, 120000];
        this.maxRetries = 3;
        this.baseUrl = baseUrl;
        this.store = new electron_store_1.default({
            name: 'upload-queue',
            defaults: {
                pendingJobs: [],
                failedJobs: []
            }
        });
        // Start processing loop
        this.startProcessing();
    }
    /**
     * Add a file to the upload queue
     */
    addToQueue(job) {
        const fullJob = {
            ...job,
            id: `${job.fileHash}_${Date.now()}`,
            retryCount: 0,
            createdAt: new Date().toISOString(),
            nextRetryAt: new Date().toISOString()
        };
        const jobs = this.store.get('pendingJobs');
        jobs.push(fullJob);
        this.store.set('pendingJobs', jobs);
        console.log(`Added to queue: ${job.fileName}`);
    }
    /**
     * Start the processing loop
     */
    startProcessing() {
        // Process every 5 seconds
        this.processInterval = setInterval(() => {
            this.processQueue();
        }, 5000);
        // Process immediately
        this.processQueue();
    }
    /**
     * Process pending jobs
     */
    async processQueue() {
        if (this.processing)
            return;
        this.processing = true;
        try {
            const jobs = this.store.get('pendingJobs');
            const now = new Date();
            for (let i = 0; i < jobs.length; i++) {
                const job = jobs[i];
                // Check if ready for retry
                if (new Date(job.nextRetryAt) > now)
                    continue;
                try {
                    const result = await this.processJob(job);
                    // Success - remove from queue
                    jobs.splice(i, 1);
                    i--;
                    this.store.set('pendingJobs', jobs);
                    const fs = require('fs');
                    fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - Upload Success: ${job.fileName}\n`);
                    if (this.onSuccess) {
                        this.onSuccess(job, result);
                    }
                }
                catch (error) {
                    const fs = require('fs');
                    fs.appendFileSync('c:\\dev\\sm\\agent\\agent_debug.log', `${new Date().toISOString()} - Upload FAILED: ${job.fileName} - ${error.message}\n`);
                    console.error(`Upload failed: ${job.fileName}`, error.message);
                    job.retryCount++;
                    if (job.retryCount >= this.maxRetries) {
                        // Move to failed queue
                        jobs.splice(i, 1);
                        i--;
                        const failedJobs = this.store.get('failedJobs');
                        failedJobs.push(job);
                        this.store.set('failedJobs', failedJobs);
                        if (this.onFailure) {
                            this.onFailure(job, error);
                        }
                    }
                    else {
                        // Schedule retry
                        const delay = this.retryDelays[Math.min(job.retryCount - 1, this.retryDelays.length - 1)];
                        job.nextRetryAt = new Date(Date.now() + delay).toISOString();
                        jobs[i] = job;
                    }
                    this.store.set('pendingJobs', jobs);
                }
            }
        }
        finally {
            this.processing = false;
        }
    }
    /**
     * Process a single upload job
     */
    async processJob(job) {
        const client = new ApiClient_1.ApiClient(this.baseUrl, job.apiKey);
        // Upload the file
        const result = await client.uploadFile(job.filePath, job.fileHash, job.storeId);
        if (!result.success) {
            throw new Error(result.error || 'Upload failed');
        }
        // If processing is async, poll for status
        if (result.status === 'PENDING' && result.uploadId) {
            return await this.pollForCompletion(client, result.uploadId, result);
        }
        return result;
    }
    /**
     * Poll for upload processing completion
     */
    async pollForCompletion(client, uploadId, initialResult, maxAttempts = 30, intervalMs = 2000) {
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            const status = await client.getUploadStatus(uploadId);
            if (status.status === 'PROCESSED') {
                return {
                    ...initialResult,
                    success: true,
                    shiftReportId: status.shiftReportId
                };
            }
            if (status.status === 'FAILED') {
                throw new Error(status.error || 'Processing failed');
            }
        }
        throw new Error('Processing timeout');
    }
    /**
     * Set success callback
     */
    setOnSuccess(callback) {
        this.onSuccess = callback;
    }
    /**
     * Set failure callback
     */
    setOnFailure(callback) {
        this.onFailure = callback;
    }
    /**
     * Get queue statistics
     */
    getStats() {
        return {
            pending: this.store.get('pendingJobs').length,
            failed: this.store.get('failedJobs').length
        };
    }
    /**
     * Destroy the queue
     */
    destroy() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
        }
        console.log('Upload queue destroyed');
    }
}
exports.UploadQueue = UploadQueue;
//# sourceMappingURL=UploadQueue.js.map