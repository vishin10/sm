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
exports.ShiftReportStorage = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
/**
 * Enhanced ShiftReportStorage with universal AI extraction support
 * Stores complete extraction data for natural language chat queries
 */
class ShiftReportStorage {
    /**
     * Save or update extracted shift report to database
     * Stores both standard fields AND complete AI extraction
     */
    static save(storeId, extract, rawExtraction // Complete AI extraction for chat queries
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40;
            // Generate receipt hash for deduplication
            // Generate receipt hash using unique identifiers
            const hashData = [
                storeId,
                ((_a = extract.storeMetadata) === null || _a === void 0 ? void 0 : _a.reportDate) || new Date().toISOString(),
                ((_b = extract.storeMetadata) === null || _b === void 0 ? void 0 : _b.shiftStart) || '',
                ((_c = extract.storeMetadata) === null || _c === void 0 ? void 0 : _c.shiftEnd) || '',
                ((_d = extract.storeMetadata) === null || _d === void 0 ? void 0 : _d.registerId) || '',
                ((_e = extract.storeMetadata) === null || _e === void 0 ? void 0 : _e.tillId) || '',
            ].join('|');
            const receiptHash = crypto_1.default
                .createHash('sha256')
                .update(hashData)
                .digest('hex');
            // Check for existing
            const existing = yield prisma.shiftReport.findUnique({
                where: { receiptHash }
            });
            // Determine report date
            // Determine BUSINESS report date (important for night shifts)
            let reportDate = new Date();
            try {
                if ((_f = extract.storeMetadata) === null || _f === void 0 ? void 0 : _f.shiftEnd) {
                    // Night shifts belong to the day they END
                    reportDate = new Date(extract.storeMetadata.shiftEnd);
                }
                else if ((_g = extract.storeMetadata) === null || _g === void 0 ? void 0 : _g.reportPrintedAt) {
                    reportDate = new Date(extract.storeMetadata.reportPrintedAt);
                }
                else if ((_h = extract.storeMetadata) === null || _h === void 0 ? void 0 : _h.reportDate) {
                    reportDate = new Date(extract.storeMetadata.reportDate);
                }
            }
            catch (_41) {
                reportDate = new Date();
            }
            // Normalize to date-only (avoid timezone edge cases)
            reportDate = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
            // Build the data object (shared between create and update)
            const reportData = {
                storeId,
                receiptHash,
                registerId: (_j = extract.storeMetadata) === null || _j === void 0 ? void 0 : _j.registerId,
                operatorId: (_k = extract.storeMetadata) === null || _k === void 0 ? void 0 : _k.operatorId,
                tillId: (_l = extract.storeMetadata) === null || _l === void 0 ? void 0 : _l.tillId,
                reportDate,
                shiftStart: ((_m = extract.storeMetadata) === null || _m === void 0 ? void 0 : _m.shiftStart) ? new Date(extract.storeMetadata.shiftStart) : null,
                shiftEnd: ((_o = extract.storeMetadata) === null || _o === void 0 ? void 0 : _o.shiftEnd) ? new Date(extract.storeMetadata.shiftEnd) : null,
                printedAt: ((_p = extract.storeMetadata) === null || _p === void 0 ? void 0 : _p.reportPrintedAt) ? new Date(extract.storeMetadata.reportPrintedAt) : null,
                // Balances
                beginningBalance: (_q = extract.balances) === null || _q === void 0 ? void 0 : _q.beginningBalance,
                endingBalance: (_r = extract.balances) === null || _r === void 0 ? void 0 : _r.endingBalance,
                closingAccountability: (_s = extract.balances) === null || _s === void 0 ? void 0 : _s.closingAccountability,
                cashierCounted: (_t = extract.balances) === null || _t === void 0 ? void 0 : _t.cashierCounted,
                cashVariance: (_u = extract.balances) === null || _u === void 0 ? void 0 : _u.cashVariance,
                // Sales
                grossSales: (_v = extract.salesSummary) === null || _v === void 0 ? void 0 : _v.grossSales,
                netSales: (_w = extract.salesSummary) === null || _w === void 0 ? void 0 : _w.netSales,
                refunds: (_x = extract.salesSummary) === null || _x === void 0 ? void 0 : _x.refunds,
                discounts: (_y = extract.salesSummary) === null || _y === void 0 ? void 0 : _y.discounts,
                taxTotal: (_z = extract.salesSummary) === null || _z === void 0 ? void 0 : _z.taxTotal,
                totalTransactions: (_0 = extract.salesSummary) === null || _0 === void 0 ? void 0 : _0.totalTransactions,
                // Fuel
                fuelSales: (_1 = extract.fuel) === null || _1 === void 0 ? void 0 : _1.fuelSales,
                fuelGross: (_2 = extract.fuel) === null || _2 === void 0 ? void 0 : _2.fuelGross,
                fuelGallons: (_3 = extract.fuel) === null || _3 === void 0 ? void 0 : _3.fuelGallons,
                // Inside
                insideSales: (_4 = extract.insideSales) === null || _4 === void 0 ? void 0 : _4.insideSales,
                merchandiseSales: (_5 = extract.insideSales) === null || _5 === void 0 ? void 0 : _5.merchandiseSales,
                prepaysInitiated: (_6 = extract.insideSales) === null || _6 === void 0 ? void 0 : _6.prepaysInitiated,
                prepaysPumped: (_7 = extract.insideSales) === null || _7 === void 0 ? void 0 : _7.prepaysPumped,
                // Tenders
                cashCount: (_9 = (_8 = extract.tenders) === null || _8 === void 0 ? void 0 : _8.cash) === null || _9 === void 0 ? void 0 : _9.count,
                cashAmount: (_11 = (_10 = extract.tenders) === null || _10 === void 0 ? void 0 : _10.cash) === null || _11 === void 0 ? void 0 : _11.amount,
                creditCount: (_13 = (_12 = extract.tenders) === null || _12 === void 0 ? void 0 : _12.credit) === null || _13 === void 0 ? void 0 : _13.count,
                creditAmount: (_15 = (_14 = extract.tenders) === null || _14 === void 0 ? void 0 : _14.credit) === null || _15 === void 0 ? void 0 : _15.amount,
                debitCount: (_17 = (_16 = extract.tenders) === null || _16 === void 0 ? void 0 : _16.debit) === null || _17 === void 0 ? void 0 : _17.count,
                debitAmount: (_19 = (_18 = extract.tenders) === null || _18 === void 0 ? void 0 : _18.debit) === null || _19 === void 0 ? void 0 : _19.amount,
                checkCount: (_21 = (_20 = extract.tenders) === null || _20 === void 0 ? void 0 : _20.check) === null || _21 === void 0 ? void 0 : _21.count,
                checkAmount: (_23 = (_22 = extract.tenders) === null || _22 === void 0 ? void 0 : _22.check) === null || _23 === void 0 ? void 0 : _23.amount,
                ebtCount: (_25 = (_24 = extract.tenders) === null || _24 === void 0 ? void 0 : _24.ebt) === null || _25 === void 0 ? void 0 : _25.count,
                ebtAmount: (_27 = (_26 = extract.tenders) === null || _26 === void 0 ? void 0 : _26.ebt) === null || _27 === void 0 ? void 0 : _27.amount,
                otherTenderCount: (_29 = (_28 = extract.tenders) === null || _28 === void 0 ? void 0 : _28.other) === null || _29 === void 0 ? void 0 : _29.count,
                otherTenderAmount: (_31 = (_30 = extract.tenders) === null || _30 === void 0 ? void 0 : _30.other) === null || _31 === void 0 ? void 0 : _31.amount,
                totalTenders: (_32 = extract.tenders) === null || _32 === void 0 ? void 0 : _32.totalTenders,
                // Safe activity
                safeDropCount: (_33 = extract.safeActivity) === null || _33 === void 0 ? void 0 : _33.safeDropCount,
                safeDropAmount: (_34 = extract.safeActivity) === null || _34 === void 0 ? void 0 : _34.safeDropAmount,
                safeLoanCount: (_35 = extract.safeActivity) === null || _35 === void 0 ? void 0 : _35.safeLoanCount,
                safeLoanAmount: (_36 = extract.safeActivity) === null || _36 === void 0 ? void 0 : _36.safeLoanAmount,
                paidInCount: (_37 = extract.safeActivity) === null || _37 === void 0 ? void 0 : _37.paidInCount,
                paidInAmount: (_38 = extract.safeActivity) === null || _38 === void 0 ? void 0 : _38.paidInAmount,
                paidOutCount: (_39 = extract.safeActivity) === null || _39 === void 0 ? void 0 : _39.paidOutCount,
                paidOutAmount: (_40 = extract.safeActivity) === null || _40 === void 0 ? void 0 : _40.paidOutAmount,
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
                const newUploadCount = existing.uploadCount + 1 || 2;
                const isQualityUpgrade = extract.extractionConfidence > (existing.extractionConfidence || 0);
                const uploadReason = isQualityUpgrade ? 'quality-upgrade' : 'duplicate-replace';
                logger_1.Logger.info(`Duplicate detected, replacing: ${existing.id} (upload #${newUploadCount}, reason: ${uploadReason})`);
                // Delete old child records first (they will be recreated)
                yield prisma.shiftReportDepartment.deleteMany({ where: { shiftReportId: existing.id } });
                yield prisma.shiftReportItem.deleteMany({ where: { shiftReportId: existing.id } });
                yield prisma.shiftReportException.deleteMany({ where: { shiftReportId: existing.id } });
                // Update the main record
                const report = yield prisma.shiftReport.update({
                    where: { id: existing.id },
                    data: Object.assign(Object.assign({}, reportData), { uploadCount: newUploadCount, lastUploadReason: uploadReason, departments: {
                            create: extract.departmentSales.map(d => ({
                                departmentName: d.departmentName,
                                quantity: d.quantity,
                                amount: d.amount,
                            }))
                        }, items: {
                            create: extract.itemSales.map(i => ({
                                itemName: i.itemName,
                                sku: i.sku,
                                quantity: i.quantity,
                                amount: i.amount,
                            }))
                        }, exceptions: {
                            create: extract.exceptions.map(e => ({
                                type: e.type,
                                count: e.count,
                                amount: e.amount,
                            }))
                        } }),
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
            const report = yield prisma.shiftReport.create({
                data: Object.assign(Object.assign({}, reportData), { uploadCount: 1, lastUploadReason: 'initial', departments: {
                        create: extract.departmentSales.map(d => ({
                            departmentName: d.departmentName,
                            quantity: d.quantity,
                            amount: d.amount,
                        }))
                    }, items: {
                        create: extract.itemSales.map(i => ({
                            itemName: i.itemName,
                            sku: i.sku,
                            quantity: i.quantity,
                            amount: i.amount,
                        }))
                    }, exceptions: {
                        create: extract.exceptions.map(e => ({
                            type: e.type,
                            count: e.count,
                            amount: e.amount,
                        }))
                    } }),
                include: {
                    departments: true,
                    items: true,
                    exceptions: true,
                }
            });
            logger_1.Logger.info(`Created shift report: ${report.id}`);
            return { id: report.id, status: 'created', uploadCount: 1 };
        });
    }
    /**
     * Get shift report by ID with all relations
     */
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.shiftReport.findUnique({
                where: { id },
                include: {
                    departments: true,
                    items: true,
                    exceptions: true,
                    store: { select: { name: true } }
                }
            });
        });
    }
    /**
     * 🔥 NEW: Get full extraction data for chat queries
     */
    static getFullExtraction(reportId) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield prisma.shiftReport.findUnique({
                where: { id: reportId },
                select: { fullExtraction: true }
            });
            if (!(report === null || report === void 0 ? void 0 : report.fullExtraction))
                return null;
            try {
                return JSON.parse(report.fullExtraction);
            }
            catch (_a) {
                return null;
            }
        });
    }
    /**
     * 🔥 NEW: Get report with all data prepared for chat context
     */
    static getForChat(reportId) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield prisma.shiftReport.findUnique({
                where: { id: reportId },
                include: {
                    departments: { orderBy: { amount: 'desc' } },
                    items: { orderBy: { amount: 'desc' } },
                    exceptions: true,
                    store: { select: { name: true } }
                }
            });
            if (!report)
                return null;
            // Parse full extraction if available
            let fullExtraction = null;
            if (report.fullExtraction) {
                try {
                    fullExtraction = JSON.parse(report.fullExtraction);
                }
                catch (_a) { }
            }
            return Object.assign(Object.assign({}, report), { fullExtraction });
        });
    }
    /**
     * List shift reports for a store
     */
    static listByStore(storeId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.shiftReport.findMany({
                where: {
                    storeId,
                    reportDate: {
                        gte: options === null || options === void 0 ? void 0 : options.startDate,
                        lte: options === null || options === void 0 ? void 0 : options.endDate,
                    }
                },
                orderBy: { reportDate: 'desc' },
                take: (options === null || options === void 0 ? void 0 : options.limit) || 50,
                skip: (options === null || options === void 0 ? void 0 : options.offset) || 0,
                include: {
                    departments: true,
                }
            });
        });
    }
    /**
     * Get compact summary for AI chat
     */
    static getSummary(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const report = yield prisma.shiftReport.findUnique({
                where: { id },
                include: {
                    departments: { orderBy: { amount: 'desc' }, take: 5 },
                    items: { orderBy: { amount: 'desc' }, take: 5 },
                }
            });
            if (!report)
                return null;
            return {
                id: report.id,
                reportDate: report.reportDate.toISOString(),
                shiftStart: (_a = report.shiftStart) === null || _a === void 0 ? void 0 : _a.toISOString(),
                shiftEnd: (_b = report.shiftEnd) === null || _b === void 0 ? void 0 : _b.toISOString(),
                grossSales: (_c = report.grossSales) === null || _c === void 0 ? void 0 : _c.toNumber(),
                netSales: (_d = report.netSales) === null || _d === void 0 ? void 0 : _d.toNumber(),
                fuelSales: (_e = report.fuelSales) === null || _e === void 0 ? void 0 : _e.toNumber(),
                insideSales: (_f = report.insideSales) === null || _f === void 0 ? void 0 : _f.toNumber(),
                cashVariance: (_g = report.cashVariance) === null || _g === void 0 ? void 0 : _g.toNumber(),
                topDepartments: report.departments.map(d => ({
                    name: d.departmentName,
                    amount: d.amount.toNumber(),
                })),
                topItems: report.items.map(i => ({
                    name: i.itemName,
                    amount: i.amount.toNumber(),
                })),
                tenderBreakdown: [
                    { type: 'cash', amount: ((_h = report.cashAmount) === null || _h === void 0 ? void 0 : _h.toNumber()) || 0 },
                    { type: 'credit', amount: ((_j = report.creditAmount) === null || _j === void 0 ? void 0 : _j.toNumber()) || 0 },
                    { type: 'debit', amount: ((_k = report.debitAmount) === null || _k === void 0 ? void 0 : _k.toNumber()) || 0 },
                ].filter(t => t.amount > 0),
            };
        });
    }
    /**
     * Analytics: Top items by date range
     */
    static getTopItems(storeId_1, startDate_1, endDate_1) {
        return __awaiter(this, arguments, void 0, function* (storeId, startDate, endDate, limit = 10) {
            const items = yield prisma.shiftReportItem.groupBy({
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
            return items.map(i => {
                var _a;
                return ({
                    itemName: i.itemName,
                    totalAmount: ((_a = i._sum.amount) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0,
                    totalQuantity: i._sum.quantity || 0,
                });
            });
        });
    }
    /**
     * Analytics: Top departments by date range
     */
    static getTopDepartments(storeId_1, startDate_1, endDate_1) {
        return __awaiter(this, arguments, void 0, function* (storeId, startDate, endDate, limit = 10) {
            const depts = yield prisma.shiftReportDepartment.groupBy({
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
            return depts.map(d => {
                var _a;
                return ({
                    departmentName: d.departmentName,
                    totalAmount: ((_a = d._sum.amount) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0,
                    totalQuantity: d._sum.quantity || 0,
                });
            });
        });
    }
    /**
     * Analytics: Days with cash variance
     */
    static getCashVarianceDays(storeId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const reports = yield prisma.shiftReport.findMany({
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
            return reports.map(r => {
                var _a;
                return ({
                    date: r.reportDate.toISOString().split('T')[0],
                    cashVariance: ((_a = r.cashVariance) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0,
                });
            });
        });
    }
    /**
     * Analytics: Fuel vs Inside sales by date
     */
    static getFuelVsInside(storeId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const reports = yield prisma.shiftReport.findMany({
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
            return reports.map(r => {
                var _a, _b;
                return ({
                    date: r.reportDate.toISOString().split('T')[0],
                    fuelSales: ((_a = r.fuelSales) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0,
                    insideSales: ((_b = r.insideSales) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0,
                });
            });
        });
    }
    /**
     * Delete a single shift report and all related data
     * Returns true if deleted, false if not found
     */
    static delete(reportId, storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify ownership
            const report = yield prisma.shiftReport.findFirst({
                where: { id: reportId, storeId }
            });
            if (!report) {
                return false;
            }
            // Delete related records first (cascade)
            yield prisma.shiftReportDepartment.deleteMany({ where: { shiftReportId: reportId } });
            yield prisma.shiftReportItem.deleteMany({ where: { shiftReportId: reportId } });
            yield prisma.shiftReportException.deleteMany({ where: { shiftReportId: reportId } });
            // Delete the main report
            yield prisma.shiftReport.delete({ where: { id: reportId } });
            logger_1.Logger.info(`Deleted shift report: ${reportId}`);
            return true;
        });
    }
    /**
     * Delete multiple shift reports (bulk delete)
     * Returns count of deleted reports
     */
    static deleteMany(reportIds, storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify ownership of all reports
            const reports = yield prisma.shiftReport.findMany({
                where: {
                    id: { in: reportIds },
                    storeId
                },
                select: { id: true }
            });
            const validIds = reports.map(r => r.id);
            if (validIds.length === 0) {
                return 0;
            }
            // Delete related records first (cascade)
            yield prisma.shiftReportDepartment.deleteMany({
                where: { shiftReportId: { in: validIds } }
            });
            yield prisma.shiftReportItem.deleteMany({
                where: { shiftReportId: { in: validIds } }
            });
            yield prisma.shiftReportException.deleteMany({
                where: { shiftReportId: { in: validIds } }
            });
            // Delete the main reports
            const result = yield prisma.shiftReport.deleteMany({
                where: { id: { in: validIds } }
            });
            logger_1.Logger.info(`Bulk deleted ${result.count} shift reports`);
            return result.count;
        });
    }
}
exports.ShiftReportStorage = ShiftReportStorage;
