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
class ShiftReportStorage {
    /**
     * Save extracted shift report to database
     */
    static save(storeId, extract) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33;
            // Generate receipt hash for deduplication
            const receiptHash = crypto_1.default
                .createHash('sha256')
                .update(extract.rawText)
                .digest('hex');
            // Check for existing
            const existing = yield prisma.shiftReport.findUnique({
                where: { receiptHash }
            });
            if (existing) {
                logger_1.Logger.info(`Duplicate shift report detected: ${existing.id}`);
                return { id: existing.id, isDuplicate: true };
            }
            // Determine report date
            let reportDate = new Date();
            if ((_a = extract.storeMetadata) === null || _a === void 0 ? void 0 : _a.reportDate) {
                try {
                    reportDate = new Date(extract.storeMetadata.reportDate);
                }
                catch (_34) { }
            }
            // Create the shift report
            const report = yield prisma.shiftReport.create({
                data: {
                    storeId,
                    receiptHash,
                    registerId: (_b = extract.storeMetadata) === null || _b === void 0 ? void 0 : _b.registerId,
                    operatorId: (_c = extract.storeMetadata) === null || _c === void 0 ? void 0 : _c.operatorId,
                    tillId: (_d = extract.storeMetadata) === null || _d === void 0 ? void 0 : _d.tillId,
                    reportDate,
                    shiftStart: ((_e = extract.storeMetadata) === null || _e === void 0 ? void 0 : _e.shiftStart) ? new Date(extract.storeMetadata.shiftStart) : null,
                    shiftEnd: ((_f = extract.storeMetadata) === null || _f === void 0 ? void 0 : _f.shiftEnd) ? new Date(extract.storeMetadata.shiftEnd) : null,
                    printedAt: ((_g = extract.storeMetadata) === null || _g === void 0 ? void 0 : _g.reportPrintedAt) ? new Date(extract.storeMetadata.reportPrintedAt) : null,
                    // Balances
                    beginningBalance: (_h = extract.balances) === null || _h === void 0 ? void 0 : _h.beginningBalance,
                    endingBalance: (_j = extract.balances) === null || _j === void 0 ? void 0 : _j.endingBalance,
                    closingAccountability: (_k = extract.balances) === null || _k === void 0 ? void 0 : _k.closingAccountability,
                    cashierCounted: (_l = extract.balances) === null || _l === void 0 ? void 0 : _l.cashierCounted,
                    cashVariance: (_m = extract.balances) === null || _m === void 0 ? void 0 : _m.cashVariance,
                    // Sales
                    grossSales: (_o = extract.salesSummary) === null || _o === void 0 ? void 0 : _o.grossSales,
                    netSales: (_p = extract.salesSummary) === null || _p === void 0 ? void 0 : _p.netSales,
                    refunds: (_q = extract.salesSummary) === null || _q === void 0 ? void 0 : _q.refunds,
                    discounts: (_r = extract.salesSummary) === null || _r === void 0 ? void 0 : _r.discounts,
                    taxTotal: (_s = extract.salesSummary) === null || _s === void 0 ? void 0 : _s.taxTotal,
                    totalTransactions: (_t = extract.salesSummary) === null || _t === void 0 ? void 0 : _t.totalTransactions,
                    // Fuel
                    fuelSales: (_u = extract.fuel) === null || _u === void 0 ? void 0 : _u.fuelSales,
                    fuelGross: (_v = extract.fuel) === null || _v === void 0 ? void 0 : _v.fuelGross,
                    fuelGallons: (_w = extract.fuel) === null || _w === void 0 ? void 0 : _w.fuelGallons,
                    // Inside
                    insideSales: (_x = extract.insideSales) === null || _x === void 0 ? void 0 : _x.insideSales,
                    merchandiseSales: (_y = extract.insideSales) === null || _y === void 0 ? void 0 : _y.merchandiseSales,
                    prepaysInitiated: (_z = extract.insideSales) === null || _z === void 0 ? void 0 : _z.prepaysInitiated,
                    prepaysPumped: (_0 = extract.insideSales) === null || _0 === void 0 ? void 0 : _0.prepaysPumped,
                    // Tenders
                    cashCount: (_2 = (_1 = extract.tenders) === null || _1 === void 0 ? void 0 : _1.cash) === null || _2 === void 0 ? void 0 : _2.count,
                    cashAmount: (_4 = (_3 = extract.tenders) === null || _3 === void 0 ? void 0 : _3.cash) === null || _4 === void 0 ? void 0 : _4.amount,
                    creditCount: (_6 = (_5 = extract.tenders) === null || _5 === void 0 ? void 0 : _5.credit) === null || _6 === void 0 ? void 0 : _6.count,
                    creditAmount: (_8 = (_7 = extract.tenders) === null || _7 === void 0 ? void 0 : _7.credit) === null || _8 === void 0 ? void 0 : _8.amount,
                    debitCount: (_10 = (_9 = extract.tenders) === null || _9 === void 0 ? void 0 : _9.debit) === null || _10 === void 0 ? void 0 : _10.count,
                    debitAmount: (_12 = (_11 = extract.tenders) === null || _11 === void 0 ? void 0 : _11.debit) === null || _12 === void 0 ? void 0 : _12.amount,
                    checkCount: (_14 = (_13 = extract.tenders) === null || _13 === void 0 ? void 0 : _13.check) === null || _14 === void 0 ? void 0 : _14.count,
                    checkAmount: (_16 = (_15 = extract.tenders) === null || _15 === void 0 ? void 0 : _15.check) === null || _16 === void 0 ? void 0 : _16.amount,
                    ebtCount: (_18 = (_17 = extract.tenders) === null || _17 === void 0 ? void 0 : _17.ebt) === null || _18 === void 0 ? void 0 : _18.count,
                    ebtAmount: (_20 = (_19 = extract.tenders) === null || _19 === void 0 ? void 0 : _19.ebt) === null || _20 === void 0 ? void 0 : _20.amount,
                    otherTenderCount: (_22 = (_21 = extract.tenders) === null || _21 === void 0 ? void 0 : _21.other) === null || _22 === void 0 ? void 0 : _22.count,
                    otherTenderAmount: (_24 = (_23 = extract.tenders) === null || _23 === void 0 ? void 0 : _23.other) === null || _24 === void 0 ? void 0 : _24.amount,
                    totalTenders: (_25 = extract.tenders) === null || _25 === void 0 ? void 0 : _25.totalTenders,
                    // Safe activity
                    safeDropCount: (_26 = extract.safeActivity) === null || _26 === void 0 ? void 0 : _26.safeDropCount,
                    safeDropAmount: (_27 = extract.safeActivity) === null || _27 === void 0 ? void 0 : _27.safeDropAmount,
                    safeLoanCount: (_28 = extract.safeActivity) === null || _28 === void 0 ? void 0 : _28.safeLoanCount,
                    safeLoanAmount: (_29 = extract.safeActivity) === null || _29 === void 0 ? void 0 : _29.safeLoanAmount,
                    paidInCount: (_30 = extract.safeActivity) === null || _30 === void 0 ? void 0 : _30.paidInCount,
                    paidInAmount: (_31 = extract.safeActivity) === null || _31 === void 0 ? void 0 : _31.paidInAmount,
                    paidOutCount: (_32 = extract.safeActivity) === null || _32 === void 0 ? void 0 : _32.paidOutCount,
                    paidOutAmount: (_33 = extract.safeActivity) === null || _33 === void 0 ? void 0 : _33.paidOutAmount,
                    // Metadata
                    rawText: extract.rawText,
                    extractionMethod: extract.extractionMethod,
                    extractionConfidence: extract.extractionConfidence,
                    // Child records
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
            logger_1.Logger.info(`Saved shift report: ${report.id}`);
            return { id: report.id, isDuplicate: false };
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
}
exports.ShiftReportStorage = ShiftReportStorage;
