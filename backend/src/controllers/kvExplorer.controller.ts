import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
    KVPair,
    filterBySection,
    searchKVPairs,
    paginate,
    getSectionCounts
} from '../services/KVFlattenService';
import { Logger } from '../utils/logger';

const prisma = new PrismaClient();

export class KVExplorerController {
    /**
     * GET /shift-reports/:id
     * Returns summary + section counts only (no full KV payload)
     */
    static async getReport(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.userId;

            const report = await prisma.shiftReport.findFirst({
                where: {
                    id,
                    store: { userId }
                },
                select: {
                    id: true,
                    storeId: true,
                    reportDate: true,
                    shiftStart: true,
                    shiftEnd: true,
                    businessDate: true,
                    shiftId: true,
                    timezone: true,
                    vendorType: true,
                    summary: true,
                    kvPairs: true,
                    extractionMethod: true,
                    createdAt: true,
                    store: {
                        select: { name: true, timezone: true }
                    }
                }
            });

            if (!report) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            // Calculate section counts from kvPairs
            const kvPairs = (report.kvPairs as KVPair[]) || [];
            const sections = getSectionCounts(kvPairs);

            res.json({
                id: report.id,
                storeId: report.storeId,
                storeName: report.store?.name,
                reportDate: report.reportDate,
                shiftStart: report.shiftStart,
                shiftEnd: report.shiftEnd,
                businessDate: report.businessDate,
                shiftId: report.shiftId,
                timezone: report.timezone || report.store?.timezone,
                vendorType: report.vendorType,
                extractionMethod: report.extractionMethod,
                createdAt: report.createdAt,
                summary: report.summary,
                sections,
                totalFields: kvPairs.length,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/:id/section/:section
     * Returns paginated KV pairs for a specific section
     */
    static async getSection(req: Request, res: Response, next: NextFunction) {
        try {
            const { id, section } = req.params;
            const page = parseInt(req.query.page as string) || 1;
            const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
            const userId = (req as any).user?.userId;

            const report = await prisma.shiftReport.findFirst({
                where: {
                    id,
                    store: { userId }
                },
                select: {
                    kvPairs: true
                }
            });

            if (!report) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            const kvPairs = (report.kvPairs as KVPair[]) || [];
            const sectionPairs = filterBySection(kvPairs, section);
            const result = paginate(sectionPairs, page, pageSize);

            res.json({
                section,
                ...result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/:id/search
     * Server-side search across all KV pairs
     */
    static async search(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const query = (req.query.q as string) || '';
            const page = parseInt(req.query.page as string) || 1;
            const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
            const userId = (req as any).user?.userId;

            if (!query || query.length < 2) {
                return res.status(400).json({
                    error: { code: 'QUERY_TOO_SHORT', message: 'Search query must be at least 2 characters' }
                });
            }

            const report = await prisma.shiftReport.findFirst({
                where: {
                    id,
                    store: { userId }
                },
                select: {
                    kvPairs: true
                }
            });

            if (!report) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            const kvPairs = (report.kvPairs as KVPair[]) || [];
            const searchResults = searchKVPairs(kvPairs, query);
            const result = paginate(searchResults, page, pageSize);

            res.json({
                query,
                ...result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/:id/raw
     * Returns the full parsed JSON (for debugging/export)
     */
    static async getRaw(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.userId;

            const report = await prisma.shiftReport.findFirst({
                where: {
                    id,
                    store: { userId }
                },
                select: {
                    parsedJson: true,
                    rawText: true,
                    vendorType: true,
                }
            });

            if (!report) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            res.json({
                vendorType: report.vendorType,
                parsedJson: report.parsedJson,
                rawText: report.rawText,
            });
        } catch (error) {
            next(error);
        }
    }
}
