import { Request, Response, NextFunction } from 'express';
import { AgentService } from '../services/AgentService';
import { S3Service } from '../services/S3Service';
import { XMLParserService } from '../services/XMLParserService';
import { ShiftReportStorage } from '../services/ShiftReportStorage';
import { Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const xmlParser = new XMLParserService();

export class AgentController {
    /**
     * POST /agent/generate-pin
     * Generate a 6-digit PIN for agent setup (requires JWT auth)
     */
    static async generatePin(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId } = req.body;
            const userId = (req as any).user?.userId;

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'MISSING_STORE_ID', message: 'storeId is required' }
                });
            }

            // Verify user owns this store
            const store = await prisma.store.findFirst({
                where: { id: storeId, userId }
            });

            if (!store) {
                return res.status(403).json({
                    error: { code: 'FORBIDDEN', message: 'You do not own this store' }
                });
            }

            const { pin, expiresAt } = await AgentService.generateSetupPin(storeId);

            res.json({
                pin,
                expiresAt: expiresAt.toISOString(),
                storeName: store.name
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /agent/register
     * Register an agent using a setup PIN (no auth required)
     */
    static async register(req: Request, res: Response, next: NextFunction) {
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

            const result = await AgentService.registerAgent(pin, deviceName);

            res.json({
                apiKey: result.apiKey,
                storeId: result.storeId,
                storeName: result.storeName,
                uploadEndpoint: '/agent/upload'
            });
        } catch (error: any) {
            if (error.message === 'Invalid or expired PIN') {
                return res.status(401).json({
                    error: { code: 'INVALID_PIN', message: error.message }
                });
            }
            next(error);
        }
    }

    /**
     * POST /agent/upload
     * Upload an XML file for processing (requires API key auth)
     */
    static async upload(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId } = (req as any).agent;
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
            const duplicateCheck = await AgentService.checkDuplicateUpload(storeId, fileHash);
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
            let s3Key: string | null = null;
            if (S3Service.isConfigured()) {
                s3Key = await S3Service.uploadRawFile(file.buffer, storeId, file.originalname);
            }

            // Create upload record
            const uploadId = await AgentService.createUploadRecord(
                storeId,
                file.originalname,
                fileHash,
                file.size,
                s3Key || undefined
            );

            // Process immediately (async in background)
            AgentController.processUploadAsync(uploadId, storeId, file.buffer);

            res.json({
                success: true,
                isNew: true,
                uploadId,
                status: 'PENDING',
                message: 'File received, processing started'
            });
        } catch (error: any) {
            Logger.error('Agent upload error:', error);
            next(error);
        }
    }

    /**
     * Background processing of uploaded XML
     */
    private static async processUploadAsync(
        uploadId: string,
        storeId: string,
        fileBuffer: Buffer
    ) {
        try {
            // Update status to PROCESSING
            await prisma.agentUpload.update({
                where: { id: uploadId },
                data: { status: 'PROCESSING' }
            });

            // Fetch store timezone for proper date handling
            const store = await prisma.store.findUnique({
                where: { id: storeId },
                select: { timezone: true }
            });
            const storeTimezone = store?.timezone || 'America/New_York';

            // Parse XML with new KV explorer approach
            const xmlContent = fileBuffer.toString('utf-8');
            const result = await xmlParser.parseShiftXML(xmlContent);
            const { parsedJson, kvPairs, summary, vendorType, metadata, legacy } = result;

            // Generate a receipt hash from the upload for deduplication
            const receiptHash = `agent_${uploadId}`;

            const shiftReport = await prisma.shiftReport.create({
                data: {
                    storeId,
                    receiptHash,

                    // KV Explorer columns (dynamic schema)
                    parsedJson,
                    kvPairs,
                    summary,
                    vendorType,

                    // Report metadata for daily/weekly analysis
                    businessDate: metadata.businessDate,
                    shiftId: metadata.shiftId,
                    timezone: metadata.xmlTimezone || storeTimezone,

                    // Metadata from legacy extraction
                    registerId: legacy.registerId,
                    operatorId: legacy.operatorId,
                    reportDate: legacy.startAt ? new Date(legacy.startAt) : new Date(),
                    shiftStart: legacy.startAt ? new Date(legacy.startAt) : null,
                    shiftEnd: legacy.endAt ? new Date(legacy.endAt) : null,

                    // Legacy columns for dashboard queries
                    grossSales: summary.grossSales,
                    netSales: summary.netSales,
                    refunds: summary.refunds,
                    discounts: summary.discounts,
                    taxTotal: summary.taxTotal,
                    totalTransactions: summary.totalTransactions,
                    fuelSales: summary.fuelSales,
                    fuelGallons: summary.fuelGallons,
                    insideSales: summary.insideSales,
                    cashVariance: summary.cashVariance,

                    // Extraction metadata
                    rawText: xmlContent.substring(0, 5000),
                    extractionMethod: 'agent_xml_kv',
                    extractionConfidence: 1.0,

                    // Related data (legacy tables for backward compat)
                    departments: {
                        create: legacy.departments.map(d => ({
                            departmentName: d.departmentName,
                            amount: d.amount,
                        }))
                    },
                }
            });

            // Update upload record with success
            await prisma.agentUpload.update({
                where: { id: uploadId },
                data: {
                    status: 'PROCESSED',
                    processedAt: new Date(),
                    shiftReportId: shiftReport.id
                }
            });

            Logger.info(`Agent upload ${uploadId} processed successfully, created ShiftReport ${shiftReport.id} with ${kvPairs.length} KV pairs`);
        } catch (error: any) {
            Logger.error(`Failed to process agent upload ${uploadId}:`, error);

            // Update with error
            await prisma.agentUpload.update({
                where: { id: uploadId },
                data: {
                    status: 'FAILED',
                    error: error.message || 'Unknown error',
                    retryCount: { increment: 1 }
                }
            });
        }
    }

    /**
     * GET /agent/upload/:id/status
     * Check status of an upload (requires API key auth)
     */
    static async getUploadStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const status = await AgentService.getUploadStatus(id);

            if (!status) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Upload not found' }
                });
            }

            res.json(status);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /agent/heartbeat
     * Health check and stats (requires API key auth)
     */
    static async heartbeat(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId } = (req as any).agent;
            const stats = await AgentService.getAgentStats(storeId);

            res.json({
                status: 'ok',
                storeId,
                ...stats
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /agent/keys
     * List API keys for a store (requires JWT auth)
     */
    static async listKeys(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId } = req.query;
            const userId = (req as any).user?.userId;

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'MISSING_STORE_ID', message: 'storeId query param required' }
                });
            }

            // Verify user owns this store
            const store = await prisma.store.findFirst({
                where: { id: String(storeId), userId }
            });

            if (!store) {
                return res.status(403).json({
                    error: { code: 'FORBIDDEN', message: 'You do not own this store' }
                });
            }

            const keys = await AgentService.listApiKeys(String(storeId));
            res.json({ keys });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /agent/keys/:id
     * Revoke an API key (requires JWT auth)
     */
    static async revokeKey(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { storeId } = req.body;
            const userId = (req as any).user?.userId;

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'MISSING_STORE_ID', message: 'storeId is required' }
                });
            }

            // Verify user owns this store
            const store = await prisma.store.findFirst({
                where: { id: storeId, userId }
            });

            if (!store) {
                return res.status(403).json({
                    error: { code: 'FORBIDDEN', message: 'You do not own this store' }
                });
            }

            const success = await AgentService.revokeApiKey(id, storeId);

            if (!success) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'API key not found' }
                });
            }

            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}
