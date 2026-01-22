/**
 * UploadQueue - Simple file-based retry queue for uploads
 * Uses electron-store for persistence (no native SQLite needed)
 */

import Store from 'electron-store';
import { ApiClient } from './ApiClient';

interface UploadJob {
    id: string;
    filePath: string;
    fileName: string;
    fileHash: string;
    fileSize: number;
    storeId: string;
    apiKey: string;
    retryCount: number;
    createdAt: string;
    nextRetryAt: string;
}

interface UploadResult {
    success: boolean;
    uploadId?: string;
    shiftReportId?: string;
    isNew?: boolean;
    error?: string;
}

interface QueueStore {
    pendingJobs: UploadJob[];
    failedJobs: UploadJob[];
}

export class UploadQueue {
    private store: Store<QueueStore>;
    private baseUrl: string;
    private processing: boolean = false;
    private processInterval: NodeJS.Timeout | null = null;
    private onSuccess?: (job: UploadJob, result: UploadResult) => void;
    private onFailure?: (job: UploadJob, error: Error) => void;

    // Retry delays in ms: 5s, 30s, 2min
    private retryDelays = [5000, 30000, 120000];
    private maxRetries = 3;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.store = new Store<QueueStore>({
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
    addToQueue(job: Omit<UploadJob, 'id' | 'retryCount' | 'createdAt' | 'nextRetryAt'>): void {
        const fullJob: UploadJob = {
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
    private startProcessing(): void {
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
    private async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        try {
            const jobs = this.store.get('pendingJobs');
            const now = new Date();

            for (let i = 0; i < jobs.length; i++) {
                const job = jobs[i];

                // Check if ready for retry
                if (new Date(job.nextRetryAt) > now) continue;

                try {
                    const result = await this.processJob(job);

                    // Success - remove from queue
                    jobs.splice(i, 1);
                    i--;
                    this.store.set('pendingJobs', jobs);

                    if (this.onSuccess) {
                        this.onSuccess(job, result);
                    }
                } catch (error: any) {
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
                    } else {
                        // Schedule retry
                        const delay = this.retryDelays[Math.min(job.retryCount - 1, this.retryDelays.length - 1)];
                        job.nextRetryAt = new Date(Date.now() + delay).toISOString();
                        jobs[i] = job;
                    }

                    this.store.set('pendingJobs', jobs);
                }
            }
        } finally {
            this.processing = false;
        }
    }

    /**
     * Process a single upload job
     */
    private async processJob(job: UploadJob): Promise<UploadResult> {
        const client = new ApiClient(this.baseUrl, job.apiKey);

        // Upload the file
        const result = await client.uploadFile(
            job.filePath,
            job.fileHash,
            job.storeId
        );

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
    private async pollForCompletion(
        client: ApiClient,
        uploadId: string,
        initialResult: UploadResult,
        maxAttempts: number = 30,
        intervalMs: number = 2000
    ): Promise<UploadResult> {
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
    setOnSuccess(callback: (job: UploadJob, result: UploadResult) => void): void {
        this.onSuccess = callback;
    }

    /**
     * Set failure callback
     */
    setOnFailure(callback: (job: UploadJob, error: Error) => void): void {
        this.onFailure = callback;
    }

    /**
     * Get queue statistics
     */
    getStats(): { pending: number; failed: number } {
        return {
            pending: this.store.get('pendingJobs').length,
            failed: this.store.get('failedJobs').length
        };
    }

    /**
     * Destroy the queue
     */
    destroy(): void {
        if (this.processInterval) {
            clearInterval(this.processInterval);
        }
        console.log('Upload queue destroyed');
    }
}
