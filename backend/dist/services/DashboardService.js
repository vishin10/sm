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
exports.DashboardService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class DashboardService {
    /**
     * Get today's aggregated stats for a store
     */
    static getTodayStats(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            // Get all reports from today
            const todayReports = yield prisma.shiftReport.findMany({
                where: {
                    storeId,
                    reportDate: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
                orderBy: { reportDate: 'asc' },
            });
            if (todayReports.length === 0) {
                // Fallback to most recent report
                const lastReport = yield prisma.shiftReport.findFirst({
                    where: { storeId },
                    orderBy: { reportDate: 'desc' },
                });
                if (!lastReport)
                    return null;
                const avgStats = yield this.get7DayAverage(storeId);
                const monthlySales = yield this.getMonthlyTotal(storeId);
                return {
                    date: lastReport.reportDate.toISOString().split('T')[0],
                    shiftCount: 1,
                    totalSales: ((_a = lastReport.grossSales) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0,
                    fuelSales: ((_b = lastReport.fuelSales) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0,
                    insideSales: ((_c = lastReport.insideSales) === null || _c === void 0 ? void 0 : _c.toNumber()) || 0,
                    customerCount: lastReport.totalTransactions || 0,
                    cashVariance: ((_d = lastReport.cashVariance) === null || _d === void 0 ? void 0 : _d.toNumber()) || 0,
                    monthlySales,
                    averageChange: {
                        sales: avgStats.sales > 0
                            ? ((((_e = lastReport.grossSales) === null || _e === void 0 ? void 0 : _e.toNumber()) || 0) - avgStats.sales) / avgStats.sales * 100
                            : 0,
                        customers: avgStats.customers > 0
                            ? ((lastReport.totalTransactions || 0) - avgStats.customers) / avgStats.customers * 100
                            : 0,
                    },
                };
            }
            // Aggregate today's reports
            const totalSales = todayReports.reduce((sum, r) => { var _a; return sum + (((_a = r.grossSales) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
            const fuelSales = todayReports.reduce((sum, r) => { var _a; return sum + (((_a = r.fuelSales) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
            const insideSales = todayReports.reduce((sum, r) => { var _a; return sum + (((_a = r.insideSales) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
            const customerCount = todayReports.reduce((sum, r) => sum + (r.totalTransactions || 0), 0);
            const cashVariance = todayReports.reduce((sum, r) => { var _a; return sum + (((_a = r.cashVariance) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
            const avgStats = yield this.get7DayAverage(storeId);
            const monthlySales = yield this.getMonthlyTotal(storeId);
            return {
                date: today.toISOString().split('T')[0],
                shiftCount: todayReports.length,
                totalSales,
                fuelSales,
                insideSales,
                customerCount,
                cashVariance,
                monthlySales,
                averageChange: {
                    sales: avgStats.sales > 0 ? (totalSales - avgStats.sales) / avgStats.sales * 100 : 0,
                    customers: avgStats.customers > 0 ? (customerCount - avgStats.customers) / avgStats.customers * 100 : 0,
                },
            };
        });
    }
    /**
     * Get 7-day average for comparison
     */
    static get7DayAverage(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const reports = yield prisma.shiftReport.findMany({
                where: {
                    storeId,
                    reportDate: { gte: sevenDaysAgo },
                },
            });
            if (reports.length === 0) {
                return { sales: 0, customers: 0 };
            }
            const totalSales = reports.reduce((sum, r) => { var _a; return sum + (((_a = r.grossSales) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
            const totalCustomers = reports.reduce((sum, r) => sum + (r.totalTransactions || 0), 0);
            return {
                sales: totalSales / reports.length,
                customers: totalCustomers / reports.length,
            };
        });
    }
    /**
     * Get current month's total sales
     */
    static getMonthlyTotal(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const reports = yield prisma.shiftReport.findMany({
                where: {
                    storeId,
                    reportDate: { gte: firstOfMonth },
                },
            });
            return reports.reduce((sum, r) => { var _a; return sum + (((_a = r.grossSales) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
        });
    }
    /**
     * Get alerts for the store
     */
    static getAlerts(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.alert.findMany({
                where: {
                    storeId,
                    resolvedAt: null,
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
            });
        });
    }
}
exports.DashboardService = DashboardService;
