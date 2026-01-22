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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
class AgentService {
    /**
     * Generate a 6-digit setup PIN for agent registration
     * PIN expires in 15 minutes
     */
    static generateSetupPin(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate random 6-digit PIN
            const pin = Math.floor(100000 + Math.random() * 900000).toString();
            // Expires in 15 minutes
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            // Invalidate any existing unused PINs for this store
            yield prisma.agentSetupPin.updateMany({
                where: {
                    storeId,
                    usedAt: null,
                    expiresAt: { gt: new Date() }
                },
                data: {
                    expiresAt: new Date() // Expire immediately
                }
            });
            // Create new PIN
            yield prisma.agentSetupPin.create({
                data: {
                    storeId,
                    pin,
                    expiresAt
                }
            });
            logger_1.Logger.info(`Generated setup PIN for store ${storeId}, expires at ${expiresAt.toISOString()}`);
            return { pin, expiresAt };
        });
    }
    /**
     * Register an agent using a setup PIN
     * Returns API key (only shown once)
     */
    static registerAgent(pin, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find valid PIN
            const pinRecord = yield prisma.agentSetupPin.findFirst({
                where: {
                    pin,
                    usedAt: null,
                    expiresAt: { gt: new Date() }
                },
                include: {
                    store: true
                }
            });
            if (!pinRecord) {
                throw new Error('Invalid or expired PIN');
            }
            // Generate API key: sk_agent_<32 random chars>
            const randomPart = crypto_1.default.randomBytes(24).toString('base64url');
            const apiKey = `sk_agent_${randomPart}`;
            const keyPrefix = apiKey.substring(0, 16) + '...';
            // Hash the API key for storage
            const keyHash = yield bcrypt_1.default.hash(apiKey, 10);
            // Create API key record
            yield prisma.agentApiKey.create({
                data: {
                    storeId: pinRecord.storeId,
                    keyHash,
                    keyPrefix,
                    deviceName,
                    status: 'ACTIVE'
                }
            });
            // Mark PIN as used
            yield prisma.agentSetupPin.update({
                where: { id: pinRecord.id },
                data: { usedAt: new Date() }
            });
            logger_1.Logger.info(`Agent registered for store ${pinRecord.storeId}: ${deviceName}`);
            return {
                apiKey,
                storeId: pinRecord.storeId,
                storeName: pinRecord.store.name
            };
        });
    }
    /**
     * Validate an API key and return associated store info
     */
    static validateApiKey(apiKey) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get all active keys (we need to compare hashes)
            const activeKeys = yield prisma.agentApiKey.findMany({
                where: { status: 'ACTIVE' }
            });
            for (const key of activeKeys) {
                const matches = yield bcrypt_1.default.compare(apiKey, key.keyHash);
                if (matches) {
                    // Update last seen
                    yield prisma.agentApiKey.update({
                        where: { id: key.id },
                        data: { lastSeenAt: new Date() }
                    });
                    return { storeId: key.storeId, keyId: key.id };
                }
            }
            return null;
        });
    }
    /**
     * Check for duplicate file hash
     */
    static checkDuplicateUpload(storeId, fileHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield prisma.agentUpload.findUnique({
                where: {
                    fileHash_storeId: { fileHash, storeId }
                }
            });
            if (existing) {
                return {
                    isDuplicate: true,
                    existingUploadId: existing.id,
                    shiftReportId: existing.shiftReportId || undefined
                };
            }
            return { isDuplicate: false };
        });
    }
    /**
     * Create a new upload record (status: PENDING)
     */
    static createUploadRecord(storeId, fileName, fileHash, fileSize, s3Key) {
        return __awaiter(this, void 0, void 0, function* () {
            const upload = yield prisma.agentUpload.create({
                data: {
                    storeId,
                    fileName,
                    fileHash,
                    fileSize,
                    s3Key,
                    status: 'PENDING'
                }
            });
            logger_1.Logger.info(`Created upload record ${upload.id} for ${fileName}`);
            return upload.id;
        });
    }
    /**
     * Get upload status
     */
    static getUploadStatus(uploadId) {
        return __awaiter(this, void 0, void 0, function* () {
            const upload = yield prisma.agentUpload.findUnique({
                where: { id: uploadId }
            });
            if (!upload)
                return null;
            return {
                status: upload.status,
                error: upload.error || undefined,
                shiftReportId: upload.shiftReportId || undefined,
                processedAt: upload.processedAt || undefined
            };
        });
    }
    /**
     * Get agent stats for heartbeat
     */
    static getAgentStats(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const [uploadsToday, lastUpload, pendingUploads] = yield Promise.all([
                prisma.agentUpload.count({
                    where: {
                        storeId,
                        uploadedAt: { gte: todayStart }
                    }
                }),
                prisma.agentUpload.findFirst({
                    where: { storeId },
                    orderBy: { uploadedAt: 'desc' }
                }),
                prisma.agentUpload.count({
                    where: {
                        storeId,
                        status: { in: ['PENDING', 'PROCESSING'] }
                    }
                })
            ]);
            return {
                uploadsToday,
                lastUploadAt: (lastUpload === null || lastUpload === void 0 ? void 0 : lastUpload.uploadedAt) || null,
                pendingUploads
            };
        });
    }
    /**
     * List API keys for a store
     */
    static listApiKeys(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = yield prisma.agentApiKey.findMany({
                where: { storeId },
                orderBy: { createdAt: 'desc' }
            });
            return keys.map((k) => ({
                id: k.id,
                keyPrefix: k.keyPrefix,
                deviceName: k.deviceName,
                status: k.status,
                lastSeenAt: k.lastSeenAt,
                createdAt: k.createdAt
            }));
        });
    }
    /**
     * Revoke an API key
     */
    static revokeApiKey(keyId, storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = yield prisma.agentApiKey.findFirst({
                where: { id: keyId, storeId }
            });
            if (!key)
                return false;
            yield prisma.agentApiKey.update({
                where: { id: keyId },
                data: {
                    status: 'REVOKED',
                    revokedAt: new Date()
                }
            });
            logger_1.Logger.info(`Revoked API key ${keyId} for store ${storeId}`);
            return true;
        });
    }
}
exports.AgentService = AgentService;
