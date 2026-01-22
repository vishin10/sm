"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Service = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const logger_1 = require("../utils/logger");
// Initialize S3 client (will fail gracefully if not configured)
const s3Client = process.env.AWS_ACCESS_KEY_ID ? new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
}) : null;
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'silent-manager-uploads';
const RETENTION_DAYS = 30;
class S3Service {
    /**
     * Check if S3 is configured
     */
    static isConfigured() {
        return s3Client !== null;
    }
    /**
     * Upload raw XML file to S3
     * Returns the S3 key
     */
    static uploadRawFile(buffer, storeId, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!s3Client) {
                logger_1.Logger.warn('S3 not configured, skipping file storage');
                return null;
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const key = `agent-uploads/${storeId}/${timestamp}_${fileName}`;
            try {
                yield s3Client.send(new client_s3_1.PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    Body: buffer,
                    ContentType: 'application/xml',
                    Metadata: {
                        storeId,
                        originalFileName: fileName,
                        uploadedAt: new Date().toISOString()
                    }
                }));
                logger_1.Logger.info(`Uploaded file to S3: ${key}`);
                return key;
            }
            catch (error) {
                logger_1.Logger.error('Failed to upload to S3:', error);
                throw error;
            }
        });
    }
    /**
     * Download file from S3
     */
    static downloadFile(key) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            if (!s3Client) {
                throw new Error('S3 not configured');
            }
            try {
                const response = yield s3Client.send(new client_s3_1.GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key
                }));
                const stream = response.Body;
                const chunks = [];
                try {
                    for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                        _c = stream_1_1.value;
                        _d = false;
                        const chunk = _c;
                        chunks.push(Buffer.from(chunk));
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                return Buffer.concat(chunks);
            }
            catch (error) {
                logger_1.Logger.error(`Failed to download from S3: ${key}`, error);
                throw error;
            }
        });
    }
    /**
     * Delete files older than retention period
     * Should be run as a cron job
     */
    static cleanupOldFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!s3Client) {
                return 0;
            }
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
            let deletedCount = 0;
            let continuationToken;
            try {
                do {
                    const listResponse = yield s3Client.send(new client_s3_1.ListObjectsV2Command({
                        Bucket: BUCKET_NAME,
                        Prefix: 'agent-uploads/',
                        ContinuationToken: continuationToken
                    }));
                    const oldObjects = (listResponse.Contents || [])
                        .filter((obj) => obj.LastModified && obj.LastModified < cutoffDate)
                        .map((obj) => ({ Key: obj.Key }));
                    if (oldObjects.length > 0) {
                        yield s3Client.send(new client_s3_1.DeleteObjectsCommand({
                            Bucket: BUCKET_NAME,
                            Delete: { Objects: oldObjects }
                        }));
                        deletedCount += oldObjects.length;
                    }
                    continuationToken = listResponse.NextContinuationToken;
                } while (continuationToken);
                logger_1.Logger.info(`S3 cleanup: deleted ${deletedCount} files older than ${RETENTION_DAYS} days`);
                return deletedCount;
            }
            catch (error) {
                logger_1.Logger.error('S3 cleanup failed:', error);
                throw error;
            }
        });
    }
}
exports.S3Service = S3Service;
