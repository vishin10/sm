/**
 * UploadQueue - Simple file-based retry queue for uploads
 * Uses electron-store for persistence (no native SQLite needed)
 */
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
export declare class UploadQueue {
    private store;
    private baseUrl;
    private processing;
    private processInterval;
    private onSuccess?;
    private onFailure?;
    private retryDelays;
    private maxRetries;
    constructor(baseUrl: string);
    /**
     * Add a file to the upload queue
     */
    addToQueue(job: Omit<UploadJob, 'id' | 'retryCount' | 'createdAt' | 'nextRetryAt'>): void;
    /**
     * Start the processing loop
     */
    private startProcessing;
    /**
     * Process pending jobs
     */
    private processQueue;
    /**
     * Process a single upload job
     */
    private processJob;
    /**
     * Poll for upload processing completion
     */
    private pollForCompletion;
    /**
     * Set success callback
     */
    setOnSuccess(callback: (job: UploadJob, result: UploadResult) => void): void;
    /**
     * Set failure callback
     */
    setOnFailure(callback: (job: UploadJob, error: Error) => void): void;
    /**
     * Get queue statistics
     */
    getStats(): {
        pending: number;
        failed: number;
    };
    /**
     * Destroy the queue
     */
    destroy(): void;
}
export {};
//# sourceMappingURL=UploadQueue.d.ts.map