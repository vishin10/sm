/**
 * ApiClient - HTTP client for communicating with Silent Manager backend
 */
interface RegisterResponse {
    apiKey: string;
    storeId: string;
    storeName: string;
    uploadEndpoint: string;
}
interface UploadResponse {
    success: boolean;
    isNew: boolean;
    uploadId: string;
    status: string;
    shiftReportId?: string;
    message?: string;
    error?: string;
}
interface UploadStatusResponse {
    status: string;
    error?: string;
    shiftReportId?: string;
    processedAt?: string;
}
interface HeartbeatResponse {
    status: string;
    storeId: string;
    uploadsToday: number;
    lastUploadAt: string | null;
    pendingUploads: number;
}
export declare class ApiClient {
    private client;
    constructor(baseUrl: string, apiKey?: string);
    /**
     * Register agent with a PIN
     */
    register(pin: string, deviceName: string): Promise<RegisterResponse>;
    /**
     * Upload an XML file
     */
    uploadFile(filePath: string, fileHash: string, storeId: string): Promise<UploadResponse>;
    /**
     * Get upload status
     */
    getUploadStatus(uploadId: string): Promise<UploadStatusResponse>;
    /**
     * Heartbeat / health check
     */
    heartbeat(): Promise<HeartbeatResponse>;
    /**
     * Test connection to backend
     */
    testConnection(): Promise<boolean>;
}
export {};
//# sourceMappingURL=ApiClient.d.ts.map