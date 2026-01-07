import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { Logger } from '../utils/logger';
import { ShiftReportExtract, ShiftReportSummary } from '../types/shiftReportExtract.types';

const prisma = new PrismaClient();

export interface SaveResult {
    id: string;
    status: 'created' | 'replaced_duplicate' | 'quality_upgrade';
    uploadCount: number;
}

/**
 * Enhanced ShiftReportStorage with universal AI extraction support
 * Stores complete extraction data for natural language chat queries
 */
export class ShiftReportStorage {

    /**
     * Save or update extracted shift report to database
     * Stores both standard fields AND complete AI extraction
     */
    static async save(
        storeId: string,
        extract: ShiftReportExtract,
        rawExtraction?: any // Complete AI extraction for chat queries
    ): Promise<SaveResult> {
        // Generate receipt hash for deduplication
        const receiptHash = crypto
            .createHash('sha256')
            .update(extract.rawText)
            .digest('hex');

        // Check for existing
        const existing = await prisma.shiftReport.findUnique({
            where: { receiptHash }
        });

        // Determine report date
        // Determine BUSINESS report date (important for night shifts)
        let reportDate = new Date();

        try {
            if (extract.storeMetadata?.shiftEnd) {
                // Night shifts belong to the day they END
                reportDate = new Date(extract.storeMetadata.shiftEnd);
            } else if (extract.storeMetadata?.reportPrintedAt) {
                reportDate = new Date(extract.storeMetadata.reportPrintedAt);
            } else if (extract.storeMetadata?.reportDate) {
                reportDate = new Date(extract.storeMetadata.reportDate);
            }
        } catch {
            reportDate = new Date();
        }

        // Normalize to date-only (avoid timezone edge cases)
        reportDate = new Date(
            reportDate.getFullYear(),
            reportDate.getMonth(),
            reportDate.getDate()
        );


        // Build the data object (shared between create and update)
        const reportData = {
            storeId,
            receiptHash,
            registerId: extract.storeMetadata?.registerId,
            operatorId: extract.storeMetadata?.operatorId,
            tillId: extract.storeMetadata?.tillId,
            reportDate,
            shiftStart: extract.storeMetadata?.shiftStart ? new Date(extract.storeMetadata.shiftStart) : null,
            shiftEnd: extract.storeMetadata?.shiftEnd ? new Date(extract.storeMetadata.shiftEnd) : null,
            printedAt: extract.storeMetadata?.reportPrintedAt ? new Date(extract.storeMetadata.reportPrintedAt) : null,

            // Balances
            beginningBalance: extract.balances?.beginningBalance,
            endingBalance: extract.balances?.endingBalance,
            closingAccountability: extract.balances?.closingAccountability,
            cashierCounted: extract.balances?.cashierCounted,
            cashVariance: extract.balances?.cashVariance,

            // Sales
            grossSales: extract.salesSummary?.grossSales,
            netSales: extract.salesSummary?.netSales,
            refunds: extract.salesSummary?.refunds,
            discounts: extract.salesSummary?.discounts,
            taxTotal: extract.salesSummary?.taxTotal,
            totalTransactions: extract.salesSummary?.totalTransactions,

            // Fuel
            fuelSales: extract.fuel?.fuelSales,
            fuelGross: extract.fuel?.fuelGross,
            fuelGallons: extract.fuel?.fuelGallons,

            // Inside
            insideSales: extract.insideSales?.insideSales,
            merchandiseSales: extract.insideSales?.merchandiseSales,
            prepaysInitiated: extract.insideSales?.prepaysInitiated,
            prepaysPumped: extract.insideSales?.prepaysPumped,

            // Tenders
            cashCount: extract.tenders?.cash?.count,
            cashAmount: extract.tenders?.cash?.amount,
            creditCount: extract.tenders?.credit?.count,
            creditAmount: extract.tenders?.credit?.amount,
            debitCount: extract.tenders?.debit?.count,
            debitAmount: extract.tenders?.debit?.amount,
            checkCount: extract.tenders?.check?.count,
            checkAmount: extract.tenders?.check?.amount,
            ebtCount: extract.tenders?.ebt?.count,
            ebtAmount: extract.tenders?.ebt?.amount,
            otherTenderCount: extract.tenders?.other?.count,
            otherTenderAmount: extract.tenders?.other?.amount,
            totalTenders: extract.tenders?.totalTenders,

            // Safe activity
            safeDropCount: extract.safeActivity?.safeDropCount,
            safeDropAmount: extract.safeActivity?.safeDropAmount,
            safeLoanCount: extract.safeActivity?.safeLoanCount,
            safeLoanAmount: extract.safeActivity?.safeLoanAmount,
            paidInCount: extract.safeActivity?.paidInCount,
            paidInAmount: extract.safeActivity?.paidInAmount,
            paidOutCount: extract.safeActivity?.paidOutCount,
            paidOutAmount: extract.safeActivity?.paidOutAmount,

            // Metadata
            rawText: extract.rawText,
            extractionMethod: extract.extractionMethod,
            extractionConfidence: extract.extractionConfidence,
            lastUploadedAt: new Date(),

            // 🔥 NEW: Store complete AI extraction for natural language queries
            fullExtraction: rawExtraction ? JSON.stringify(rawExtraction) : null,
        };

        if (existing) {
            // UPSERT: Update existing record
            const newUploadCount = (existing as any).uploadCount + 1 || 2;
            const isQualityUpgrade = extract.extractionConfidence > (existing.extractionConfidence || 0);
            const uploadReason = isQualityUpgrade ? 'quality-upgrade' : 'duplicate-replace';

            Logger.info(`Duplicate detected, replacing: ${existing.id} (upload #${newUploadCount}, reason: ${uploadReason})`);

            // Delete old child records first (they will be recreated)
            await prisma.shiftReportDepartment.deleteMany({ where: { shiftReportId: existing.id } });
            await prisma.shiftReportItem.deleteMany({ where: { shiftReportId: existing.id } });
            await prisma.shiftReportException.deleteMany({ where: { shiftReportId: existing.id } });

            // Update the main record
            const report = await prisma.shiftReport.update({
                where: { id: existing.id },
                data: {
                    ...reportData,
                    uploadCount: newUploadCount,
                    lastUploadReason: uploadReason,
                    departments: {
                        create: extract.departmentSales.map(d => ({
                            departmentName: d.departmentName,
                            quantity: d.quantity,
                            amount: d.amount,
                        }))
                    },
                    items: {
                        create: extract.itemSales.map(i => ({
                            itemName: i.itemName,
                            sku: i.sku,
                            quantity: i.quantity,
                            amount: i.amount,
                        }))
                    },
                    exceptions: {
                        create: extract.exceptions.map(e => ({
                            type: e.type,
                            count: e.count,
                            amount: e.amount,
                        }))
                    }
                },
                include: {
                    departments: true,
                    items: true,
                    exceptions: true,
                }
            });

            return {
                id: report.id,
                status: isQualityUpgrade ? 'quality_upgrade' : 'replaced_duplicate',
                uploadCount: newUploadCount
            };
        }

        // CREATE: New record
        const report = await prisma.shiftReport.create({
            data: {
                ...reportData,
                uploadCount: 1,
                lastUploadReason: 'initial',
                departments: {
                    create: extract.departmentSales.map(d => ({
                        departmentName: d.departmentName,
                        quantity: d.quantity,
                        amount: d.amount,
                    }))
                },
                items: {
                    create: extract.itemSales.map(i => ({
                        itemName: i.itemName,
                        sku: i.sku,
                        quantity: i.quantity,
                        amount: i.amount,
                    }))
                },
                exceptions: {
                    create: extract.exceptions.map(e => ({
                        type: e.type,
                        count: e.count,
                        amount: e.amount,
                    }))
                }
            },
            include: {
                departments: true,
                items: true,
                exceptions: true,
            }
        });

        Logger.info(`Created shift report: ${report.id}`);
        return { id: report.id, status: 'created', uploadCount: 1 };
    }

    /**
     * Get shift report by ID with all relations
     */
    static async getById(id: string) {
        return prisma.shiftReport.findUnique({
            where: { id },
            include: {
                departments: true,
                items: true,
                exceptions: true,
                store: { select: { name: true } }
            }
        });
    }

    /**
     * 🔥 NEW: Get full extraction data for chat queries
     */
    static async getFullExtraction(reportId: string): Promise<any> {
        const report = await prisma.shiftReport.findUnique({
            where: { id: reportId },
            select: { fullExtraction: true }
        });

        if (!report?.fullExtraction) return null;

        try {
            return JSON.parse(report.fullExtraction as string);
        } catch {
            return null;
        }
    }

    /**
     * 🔥 NEW: Get report with all data prepared for chat context
     */
    static async getForChat(reportId: string) {
        const report = await prisma.shiftReport.findUnique({
            where: { id: reportId },
            include: {
                departments: { orderBy: { amount: 'desc' } },
                items: { orderBy: { amount: 'desc' } },
                exceptions: true,
                store: { select: { name: true } }
            }
        });

        if (!report) return null;

        // Parse full extraction if available
        let fullExtraction = null;
        if (report.fullExtraction) {
            try {
                fullExtraction = JSON.parse(report.fullExtraction as string);
            } catch { }
        }

        return {
            ...report,
            fullExtraction
        };
    }

    /**
     * List shift reports for a store
     */
    static async listByStore(storeId: string, options?: {
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }) {
        return prisma.shiftReport.findMany({
            where: {
                storeId,
                reportDate: {
                    gte: options?.startDate,
                    lte: options?.endDate,
                }
            },
            orderBy: { reportDate: 'desc' },
            take: options?.limit || 50,
            skip: options?.offset || 0,
            include: {
                departments: true,
            }
        });
    }

    /**
     * Get compact summary for AI chat
     */
    static async getSummary(id: string): Promise<ShiftReportSummary | null> {
        const report = await prisma.shiftReport.findUnique({
            where: { id },
            include: {
                departments: { orderBy: { amount: 'desc' }, take: 5 },
                items: { orderBy: { amount: 'desc' }, take: 5 },
            }
        });

        if (!report) return null;

        return {
            id: report.id,
            reportDate: report.reportDate.toISOString(),
            shiftStart: report.shiftStart?.toISOString(),
            shiftEnd: report.shiftEnd?.toISOString(),
            grossSales: report.grossSales?.toNumber(),
            netSales: report.netSales?.toNumber(),
            fuelSales: report.fuelSales?.toNumber(),
            insideSales: report.insideSales?.toNumber(),
            cashVariance: report.cashVariance?.toNumber(),
            topDepartments: report.departments.map(d => ({
                name: d.departmentName,
                amount: d.amount.toNumber(),
            })),
            topItems: report.items.map(i => ({
                name: i.itemName,
                amount: i.amount.toNumber(),
            })),
            tenderBreakdown: [
                { type: 'cash', amount: report.cashAmount?.toNumber() || 0 },
                { type: 'credit', amount: report.creditAmount?.toNumber() || 0 },
                { type: 'debit', amount: report.debitAmount?.toNumber() || 0 },
            ].filter(t => t.amount > 0),
        };
    }

    /**
     * Analytics: Top items by date range
     */
    static async getTopItems(storeId: string, startDate: Date, endDate: Date, limit = 10) {
        const items = await prisma.shiftReportItem.groupBy({
            by: ['itemName'],
            where: {
                shiftReport: {
                    storeId,
                    reportDate: { gte: startDate, lte: endDate }
                }
            },
            _sum: { amount: true, quantity: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: limit,
        });

        return items.map(i => ({
            itemName: i.itemName,
            totalAmount: i._sum.amount?.toNumber() || 0,
            totalQuantity: i._sum.quantity || 0,
        }));
    }

    /**
     * Analytics: Top departments by date range
     */
    static async getTopDepartments(storeId: string, startDate: Date, endDate: Date, limit = 10) {
        const depts = await prisma.shiftReportDepartment.groupBy({
            by: ['departmentName'],
            where: {
                shiftReport: {
                    storeId,
                    reportDate: { gte: startDate, lte: endDate }
                }
            },
            _sum: { amount: true, quantity: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: limit,
        });

        return depts.map(d => ({
            departmentName: d.departmentName,
            totalAmount: d._sum.amount?.toNumber() || 0,
            totalQuantity: d._sum.quantity || 0,
        }));
    }

    /**
     * Analytics: Days with cash variance
     */
    static async getCashVarianceDays(storeId: string, startDate: Date, endDate: Date) {
        const reports = await prisma.shiftReport.findMany({
            where: {
                storeId,
                reportDate: { gte: startDate, lte: endDate },
                NOT: { cashVariance: null },
            },
            select: {
                reportDate: true,
                cashVariance: true,
            },
            orderBy: { reportDate: 'desc' },
        });

        return reports.map(r => ({
            date: r.reportDate.toISOString().split('T')[0],
            cashVariance: r.cashVariance?.toNumber() || 0,
        }));
    }

    /**
     * Analytics: Fuel vs Inside sales by date
     */
    static async getFuelVsInside(storeId: string, startDate: Date, endDate: Date) {
        const reports = await prisma.shiftReport.findMany({
            where: {
                storeId,
                reportDate: { gte: startDate, lte: endDate },
            },
            select: {
                reportDate: true,
                fuelSales: true,
                insideSales: true,
            },
            orderBy: { reportDate: 'asc' },
        });

        return reports.map(r => ({
            date: r.reportDate.toISOString().split('T')[0],
            fuelSales: r.fuelSales?.toNumber() || 0,
            insideSales: r.insideSales?.toNumber() || 0,
        }));
    }
}