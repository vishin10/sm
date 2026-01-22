import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Logger } from '../utils/logger';

const prisma = new PrismaClient();

export class AgentService {
    /**
     * Generate a 6-digit setup PIN for agent registration
     * PIN expires in 15 minutes
     */
    static async generateSetupPin(storeId: string): Promise<{ pin: string; expiresAt: Date }> {
        // Generate random 6-digit PIN
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        // Expires in 15 minutes
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Invalidate any existing unused PINs for this store
        await prisma.agentSetupPin.updateMany({
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
        await prisma.agentSetupPin.create({
            data: {
                storeId,
                pin,
                expiresAt
            }
        });

        Logger.info(`Generated setup PIN for store ${storeId}, expires at ${expiresAt.toISOString()}`);

        return { pin, expiresAt };
    }

    /**
     * Register an agent using a setup PIN
     * Returns API key (only shown once)
     */
    static async registerAgent(
        pin: string,
        deviceName: string
    ): Promise<{ apiKey: string; storeId: string; storeName: string }> {
        // Find valid PIN
        const pinRecord = await prisma.agentSetupPin.findFirst({
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
        const randomPart = crypto.randomBytes(24).toString('base64url');
        const apiKey = `sk_agent_${randomPart}`;
        const keyPrefix = apiKey.substring(0, 16) + '...';

        // Hash the API key for storage
        const keyHash = await bcrypt.hash(apiKey, 10);

        // Create API key record
        await prisma.agentApiKey.create({
            data: {
                storeId: pinRecord.storeId,
                keyHash,
                keyPrefix,
                deviceName,
                status: 'ACTIVE'
            }
        });

        // Mark PIN as used
        await prisma.agentSetupPin.update({
            where: { id: pinRecord.id },
            data: { usedAt: new Date() }
        });

        Logger.info(`Agent registered for store ${pinRecord.storeId}: ${deviceName}`);

        return {
            apiKey,
            storeId: pinRecord.storeId,
            storeName: pinRecord.store.name
        };
    }

    /**
     * Validate an API key and return associated store info
     */
    static async validateApiKey(apiKey: string): Promise<{ storeId: string; keyId: string } | null> {
        // Get all active keys (we need to compare hashes)
        const activeKeys = await prisma.agentApiKey.findMany({
            where: { status: 'ACTIVE' }
        });

        for (const key of activeKeys) {
            const matches = await bcrypt.compare(apiKey, key.keyHash);
            if (matches) {
                // Update last seen
                await prisma.agentApiKey.update({
                    where: { id: key.id },
                    data: { lastSeenAt: new Date() }
                });

                return { storeId: key.storeId, keyId: key.id };
            }
        }

        return null;
    }

    /**
     * Check for duplicate file hash
     */
    static async checkDuplicateUpload(
        storeId: string,
        fileHash: string
    ): Promise<{ isDuplicate: boolean; existingUploadId?: string; shiftReportId?: string }> {
        const existing = await prisma.agentUpload.findUnique({
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
    }

    /**
     * Create a new upload record (status: PENDING)
     */
    static async createUploadRecord(
        storeId: string,
        fileName: string,
        fileHash: string,
        fileSize: number,
        s3Key?: string
    ): Promise<string> {
        const upload = await prisma.agentUpload.create({
            data: {
                storeId,
                fileName,
                fileHash,
                fileSize,
                s3Key,
                status: 'PENDING'
            }
        });

        Logger.info(`Created upload record ${upload.id} for ${fileName}`);
        return upload.id;
    }

    /**
     * Get upload status
     */
    static async getUploadStatus(uploadId: string): Promise<{
        status: string;
        error?: string;
        shiftReportId?: string;
        processedAt?: Date;
    } | null> {
        const upload = await prisma.agentUpload.findUnique({
            where: { id: uploadId }
        });

        if (!upload) return null;

        return {
            status: upload.status,
            error: upload.error || undefined,
            shiftReportId: upload.shiftReportId || undefined,
            processedAt: upload.processedAt || undefined
        };
    }

    /**
     * Get agent stats for heartbeat
     */
    static async getAgentStats(storeId: string): Promise<{
        uploadsToday: number;
        lastUploadAt: Date | null;
        pendingUploads: number;
    }> {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [uploadsToday, lastUpload, pendingUploads] = await Promise.all([
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
            lastUploadAt: lastUpload?.uploadedAt || null,
            pendingUploads
        };
    }

    /**
     * List API keys for a store
     */
    static async listApiKeys(storeId: string): Promise<Array<{
        id: string;
        keyPrefix: string;
        deviceName: string;
        status: string;
        lastSeenAt: Date | null;
        createdAt: Date;
    }>> {
        const keys = await prisma.agentApiKey.findMany({
            where: { storeId },
            orderBy: { createdAt: 'desc' }
        });

        return keys.map((k: any) => ({
            id: k.id,
            keyPrefix: k.keyPrefix,
            deviceName: k.deviceName,
            status: k.status,
            lastSeenAt: k.lastSeenAt,
            createdAt: k.createdAt
        }));
    }

    /**
     * Revoke an API key
     */
    static async revokeApiKey(keyId: string, storeId: string): Promise<boolean> {
        const key = await prisma.agentApiKey.findFirst({
            where: { id: keyId, storeId }
        });

        if (!key) return false;

        await prisma.agentApiKey.update({
            where: { id: keyId },
            data: {
                status: 'REVOKED',
                revokedAt: new Date()
            }
        });

        Logger.info(`Revoked API key ${keyId} for store ${storeId}`);
        return true;
    }
}
