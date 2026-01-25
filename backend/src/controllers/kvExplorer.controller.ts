import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
    KVPair,
    filterBySection,
    searchKVPairs,
    paginate,
    getSectionCounts,
    extractSummary,
    flattenWithSections
} from '../services/KVFlattenService';
import { Logger } from '../utils/logger';

const prisma = new PrismaClient();

function toNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'object' && typeof (value as any).toNumber === 'function') {
        return (value as any).toNumber();
    }
    return null;
}

function resolveKVPairs(report: { kvPairs?: any; fullExtraction?: string | null; parsedJson?: any }): KVPair[] {
    console.log('=== resolveKVPairs START ===');
    console.log('kvPairs type:', typeof report.kvPairs);
    console.log('kvPairs is array?', Array.isArray(report.kvPairs));
    console.log('kvPairs length:', Array.isArray(report.kvPairs) ? report.kvPairs.length : 'N/A');

    const kvPairs = report.kvPairs as unknown as KVPair[] | null;
    if (Array.isArray(kvPairs) && kvPairs.length > 0) {
        console.log('✓ Returning kvPairs directly, count:', kvPairs.length);
        return kvPairs;
    }

    console.log('✗ kvPairs not valid, trying fullExtraction...');

    if (report.fullExtraction) {
        try {
            const parsed = JSON.parse(report.fullExtraction as string);
            if (parsed && typeof parsed === 'object') {
                const { kvPairs: computed } = flattenWithSections(parsed);
                console.log('✓ Computed from fullExtraction, count:', computed.length);
                return computed;
            }
        } catch (e) {
            console.log('✗ fullExtraction parse failed:', e);
        }
    }

    console.log('✗ Trying parsedJson...');

    if (report.parsedJson && typeof report.parsedJson === 'object') {
        try {
            const { kvPairs: computed } = flattenWithSections(report.parsedJson);
            console.log('✓ Computed from parsedJson, count:', computed.length);
            return computed;
        } catch (e) {
            console.log('✗ parsedJson flatten failed:', e);
        }
    }

    console.log('✗ Returning empty array');
    return Array.isArray(kvPairs) ? kvPairs : [];
}

export class KVExplorerController {
    /**
     * GET /shift-reports/:id
     * Returns summary + section counts only (no full KV payload)
     * Uses stored sectionsIndex from summary to avoid loading kvPairs
     */
    static async getReport(req: Request, res: Response, next: NextFunction) {
        console.log('========================================');
        console.log('GET /shift-reports/:id called');
        console.log('Report ID:', req.params.id);
        console.log('========================================');
        try {
            const { id } = req.params;
            const userId = (req as any).user?.userId;
            console.log('User ID:', userId);

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
                    kvPairs: true,  // LOAD kvPairs for fallback
                    fullExtraction: true,
                    parsedJson: true,
                    extractionMethod: true,
                    createdAt: true,
                    grossSales: true,
                    netSales: true,
                    fuelSales: true,
                    insideSales: true,
                    totalTransactions: true,
                    cashVariance: true,
                    taxTotal: true,
                    refunds: true,
                    discounts: true,
                    fuelGallons: true,
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

            const summaryData = report.summary as any || {};
            const resolvedPairs = resolveKVPairs(report);
            console.log('Resolved pairs count:', resolvedPairs.length);

            const computedSummary = resolvedPairs.length > 0 ? extractSummary(resolvedPairs) : null;
            console.log('Computed summary:', computedSummary);

            let sections = summaryData.sectionsIndex || computedSummary?.sectionsIndex || [];
            let totalFields = summaryData.totalFields || computedSummary?.totalFields || 0;
            console.log('Sections count:', sections.length);
            console.log('Total fields:', totalFields);

            // FALLBACK: Compute sections from kvPairs if missing
            if (sections.length === 0 && resolvedPairs.length > 0) {
                console.log('Falling back to compute sections from kvPairs');
                const sectionCounts = getSectionCounts(resolvedPairs);
                console.log('Computed sections count:', sectionCounts.length);
                sections = sectionCounts;
                totalFields = resolvedPairs.length;
                console.log('Total fields:', totalFields);

                Logger.warn(`sectionsIndex missing for report ${id}, computed ${sections.length} sections from kvPairs`);
            }

            const summary = {
                grossSales: summaryData.grossSales ?? computedSummary?.grossSales ?? toNumber(report.grossSales),
                netSales: summaryData.netSales ?? computedSummary?.netSales ?? toNumber(report.netSales),
                fuelSales: summaryData.fuelSales ?? computedSummary?.fuelSales ?? toNumber(report.fuelSales),
                insideSales: summaryData.insideSales ?? computedSummary?.insideSales ?? toNumber(report.insideSales),
                totalTransactions: summaryData.totalTransactions ?? computedSummary?.totalTransactions ?? report.totalTransactions ?? null,
                cashVariance: summaryData.cashVariance ?? computedSummary?.cashVariance ?? toNumber(report.cashVariance),
                taxTotal: summaryData.taxTotal ?? computedSummary?.taxTotal ?? toNumber(report.taxTotal),
                refunds: summaryData.refunds ?? computedSummary?.refunds ?? toNumber(report.refunds),
                discounts: summaryData.discounts ?? computedSummary?.discounts ?? toNumber(report.discounts),
                fuelGallons: summaryData.fuelGallons ?? computedSummary?.fuelGallons ?? toNumber(report.fuelGallons),
            };

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
                summary,
                sections,
                totalFields,
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
                    kvPairs: true,
                    fullExtraction: true,
                    parsedJson: true,
                }
            });

            if (!report) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            const kvPairs = resolveKVPairs(report);
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
                    kvPairs: true,
                    fullExtraction: true,
                    parsedJson: true,
                }
            });

            if (!report) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            const kvPairs = resolveKVPairs(report);
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
     * Returns the full parsed JSON + rawText (DEPRECATED - use /raw-text or /raw-json instead)
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

    /**
     * GET /shift-reports/:id/raw-text
     * Returns only rawText (for debugging)
     */
    static async getRawText(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.userId;

            const report = await prisma.shiftReport.findFirst({
                where: {
                    id,
                    store: { userId }
                },
                select: {
                    rawText: true,
                }
            });

            if (!report) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            res.json({
                rawText: report.rawText,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/:id/raw-json
     * Returns only parsedJson (for debugging)
     */
    static async getRawJson(req: Request, res: Response, next: NextFunction) {
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
            });
        } catch (error) {
            next(error);
        }
    }
}

