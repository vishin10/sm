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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const AgentService_1 = require("../services/AgentService");
const S3Service_1 = require("../services/S3Service");
const XMLParserService_1 = require("../services/XMLParserService");
const logger_1 = require("../utils/logger");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const xmlParser = new XMLParserService_1.XMLParserService();
class AgentController {
    /**
     * POST /agent/generate-pin
     * Generate a 6-digit PIN for agent setup (requires JWT auth)
     */
    static generatePin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { storeId } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                if (!storeId) {
                    return res.status(400).json({
                        error: { code: 'MISSING_STORE_ID', message: 'storeId is required' }
                    });
                }
                // Verify user owns this store
                const store = yield prisma.store.findFirst({
                    where: { id: storeId, userId }
                });
                if (!store) {
                    return res.status(403).json({
                        error: { code: 'FORBIDDEN', message: 'You do not own this store' }
                    });
                }
                const { pin, expiresAt } = yield AgentService_1.AgentService.generateSetupPin(storeId);
                res.json({
                    pin,
                    expiresAt: expiresAt.toISOString(),
                    storeName: store.name
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * POST /agent/register
     * Register an agent using a setup PIN (no auth required)
     */
    static register(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { pin, deviceName } = req.body;
                if (!pin || !deviceName) {
                    return res.status(400).json({
                        error: {
                            code: 'MISSING_FIELDS',
                            message: 'pin and deviceName are required'
                        }
                    });
                }
                const result = yield AgentService_1.AgentService.registerAgent(pin, deviceName);
                res.json({
                    apiKey: result.apiKey,
                    storeId: result.storeId,
                    storeName: result.storeName,
                    uploadEndpoint: '/agent/upload'
                });
            }
            catch (error) {
                if (error.message === 'Invalid or expired PIN') {
                    return res.status(401).json({
                        error: { code: 'INVALID_PIN', message: error.message }
                    });
                }
                next(error);
            }
        });
    }
    /**
     * POST /agent/upload
     * Upload an XML file for processing (requires API key auth)
     */
    static upload(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId } = req.agent;
                const file = req.file;
                const { fileHash } = req.body;
                if (!file) {
                    return res.status(400).json({
                        error: { code: 'MISSING_FILE', message: 'No file uploaded' }
                    });
                }
                if (!fileHash) {
                    return res.status(400).json({
                        error: { code: 'MISSING_HASH', message: 'fileHash is required' }
                    });
                }
                // Check for duplicate
                const duplicateCheck = yield AgentService_1.AgentService.checkDuplicateUpload(storeId, fileHash);
                if (duplicateCheck.isDuplicate) {
                    return res.json({
                        success: true,
                        isNew: false,
                        uploadId: duplicateCheck.existingUploadId,
                        shiftReportId: duplicateCheck.shiftReportId,
                        message: 'File already uploaded'
                    });
                }
                // Upload to S3 if configured
                let s3Key = null;
                if (S3Service_1.S3Service.isConfigured()) {
                    s3Key = yield S3Service_1.S3Service.uploadRawFile(file.buffer, storeId, file.originalname);
                }
                // Create upload record
                const uploadId = yield AgentService_1.AgentService.createUploadRecord(storeId, file.originalname, fileHash, file.size, s3Key || undefined);
                // Process immediately (async in background)
                AgentController.processUploadAsync(uploadId, storeId, file.buffer);
                res.json({
                    success: true,
                    isNew: true,
                    uploadId,
                    status: 'PENDING',
                    message: 'File received, processing started'
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Background processing of uploaded XML
     */
    static processUploadAsync(uploadId, storeId, fileBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Update status to PROCESSING
                yield prisma.agentUpload.update({
                    where: { id: uploadId },
                    data: { status: 'PROCESSING' }
                });
                // Parse XML
                const xmlContent = fileBuffer.toString('utf-8');
                const parsedData = yield xmlParser.parseShiftXML(xmlContent);
                // Create ShiftReport using existing storage service
                // Generate a receipt hash from the parsed data for deduplication
                const receiptHash = `agent_${uploadId}`;
                const shiftReport = yield prisma.shiftReport.create({
                    data: {
                        storeId,
                        receiptHash,
                        registerId: parsedData.registerId,
                        operatorId: parsedData.operatorId,
                        reportDate: parsedData.startAt ? new Date(parsedData.startAt) : new Date(),
                        shiftStart: parsedData.startAt ? new Date(parsedData.startAt) : null,
                        shiftEnd: parsedData.endAt ? new Date(parsedData.endAt) : null,
                        grossSales: parsedData.totalSales,
                        netSales: parsedData.totalSales - parsedData.refunds,
                        refunds: parsedData.refunds,
                        discounts: parsedData.discountTotal,
                        taxTotal: parsedData.taxTotal,
                        fuelSales: parsedData.fuelSales,
                        insideSales: parsedData.nonFuelSales,
                        cashVariance: parsedData.cashVariance,
                        totalTransactions: parsedData.customerCount,
                        rawText: xmlContent.substring(0, 5000), // Store first 5KB for debugging
                        extractionMethod: 'agent_xml',
                        extractionConfidence: 1.0,
                        departments: {
                            create: parsedData.departments.map(d => ({
                                departmentName: d.departmentName,
                                amount: d.amount
                            }))
                        }
                    }
                });
                // Update upload record with success
                yield prisma.agentUpload.update({
                    where: { id: uploadId },
                    data: {
                        status: 'PROCESSED',
                        processedAt: new Date(),
                        shiftReportId: shiftReport.id
                    }
                });
                logger_1.Logger.info(`Agent upload ${uploadId} processed successfully, created ShiftReport ${shiftReport.id}`);
            }
            catch (error) {
                logger_1.Logger.error(`Failed to process agent upload ${uploadId}:`, error);
                // Update with error
                yield prisma.agentUpload.update({
                    where: { id: uploadId },
                    data: {
                        status: 'FAILED',
                        error: error.message || 'Unknown error',
                        retryCount: { increment: 1 }
                    }
                });
            }
        });
    }
    /**
     * GET /agent/upload/:id/status
     * Check status of an upload (requires API key auth)
     */
    static getUploadStatus(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const status = yield AgentService_1.AgentService.getUploadStatus(id);
                if (!status) {
                    return res.status(404).json({
                        error: { code: 'NOT_FOUND', message: 'Upload not found' }
                    });
                }
                res.json(status);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /agent/heartbeat
     * Health check and stats (requires API key auth)
     */
    static heartbeat(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId } = req.agent;
                const stats = yield AgentService_1.AgentService.getAgentStats(storeId);
                res.json(Object.assign({ status: 'ok', storeId }, stats));
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /agent/keys
     * List API keys for a store (requires JWT auth)
     */
    static listKeys(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { storeId } = req.query;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                if (!storeId) {
                    return res.status(400).json({
                        error: { code: 'MISSING_STORE_ID', message: 'storeId query param required' }
                    });
                }
                // Verify user owns this store
                const store = yield prisma.store.findFirst({
                    where: { id: String(storeId), userId }
                });
                if (!store) {
                    return res.status(403).json({
                        error: { code: 'FORBIDDEN', message: 'You do not own this store' }
                    });
                }
                const keys = yield AgentService_1.AgentService.listApiKeys(String(storeId));
                res.json({ keys });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * DELETE /agent/keys/:id
     * Revoke an API key (requires JWT auth)
     */
    static revokeKey(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const { storeId } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                if (!storeId) {
                    return res.status(400).json({
                        error: { code: 'MISSING_STORE_ID', message: 'storeId is required' }
                    });
                }
                // Verify user owns this store
                const store = yield prisma.store.findFirst({
                    where: { id: storeId, userId }
                });
                if (!store) {
                    return res.status(403).json({
                        error: { code: 'FORBIDDEN', message: 'You do not own this store' }
                    });
                }
                const success = yield AgentService_1.AgentService.revokeApiKey(id, storeId);
                if (!success) {
                    return res.status(404).json({
                        error: { code: 'NOT_FOUND', message: 'API key not found' }
                    });
                }
                res.json({ success: true });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.AgentController = AgentController;
