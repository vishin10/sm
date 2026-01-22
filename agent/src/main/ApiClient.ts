/**
 * ApiClient - HTTP client for communicating with Silent Manager backend
 */

import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import FormData from 'form-data';

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

export class ApiClient {
    private client: AxiosInstance;

    constructor(baseUrl: string, apiKey?: string) {
        this.client = axios.create({
            baseURL: baseUrl,
            timeout: 60000, // 60 second timeout for uploads
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (apiKey) {
            this.client.defaults.headers.common['X-API-Key'] = apiKey;
        }
    }

    /**
     * Register agent with a PIN
     */
    async register(pin: string, deviceName: string): Promise<RegisterResponse> {
        const response = await this.client.post('/agent/register', {
            pin,
            deviceName
        });
        return response.data;
    }

    /**
     * Upload an XML file
     */
    async uploadFile(
        filePath: string,
        fileHash: string,
        storeId: string
    ): Promise<UploadResponse> {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('fileHash', fileHash);
        formData.append('storeId', storeId);

        const response = await this.client.post('/agent/upload', formData, {
            headers: {
                ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return response.data;
    }

    /**
     * Get upload status
     */
    async getUploadStatus(uploadId: string): Promise<UploadStatusResponse> {
        const response = await this.client.get(`/agent/upload/${uploadId}/status`);
        return response.data;
    }

    /**
     * Heartbeat / health check
     */
    async heartbeat(): Promise<HeartbeatResponse> {
        const response = await this.client.get('/agent/heartbeat');
        return response.data;
    }

    /**
     * Test connection to backend
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.heartbeat();
            return true;
        } catch (error) {
            return false;
        }
    }
}
