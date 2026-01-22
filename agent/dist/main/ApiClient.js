"use strict";
/**
 * ApiClient - HTTP client for communicating with Silent Manager backend
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
class ApiClient {
    constructor(baseUrl, apiKey) {
        this.client = axios_1.default.create({
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
    async register(pin, deviceName) {
        const response = await this.client.post('/agent/register', {
            pin,
            deviceName
        });
        return response.data;
    }
    /**
     * Upload an XML file
     */
    async uploadFile(filePath, fileHash, storeId) {
        const formData = new form_data_1.default();
        formData.append('file', fs_1.default.createReadStream(filePath));
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
    async getUploadStatus(uploadId) {
        const response = await this.client.get(`/agent/upload/${uploadId}/status`);
        return response.data;
    }
    /**
     * Heartbeat / health check
     */
    async heartbeat() {
        const response = await this.client.get('/agent/heartbeat');
        return response.data;
    }
    /**
     * Test connection to backend
     */
    async testConnection() {
        try {
            await this.heartbeat();
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=ApiClient.js.map