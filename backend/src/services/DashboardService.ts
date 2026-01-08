import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface TodayStats {
    date: string;
    shiftCount: number;
    totalSales: number;
    fuelSales: number;
    insideSales: number;
    customerCount: number;
    cashVariance: number;
    monthlySales: number;
    averageChange: {
        sales: number;
        customers: number;
    };
}

export class DashboardService {
    /**
     * Get today's aggregated stats for a store
     */
    static async getTodayStats(storeId: string): Promise<TodayStats | null> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get all reports from today
        const todayReports = await prisma.shiftReport.findMany({
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
            const lastReport = await prisma.shiftReport.findFirst({
                where: { storeId },
                orderBy: { reportDate: 'desc' },
            });

            if (!lastReport) return null;

            const avgStats = await this.get7DayAverage(storeId);
            const monthlySales = await this.getMonthlyTotal(storeId);

            return {
                date: lastReport.reportDate.toISOString().split('T')[0],
                shiftCount: 1,
                totalSales: lastReport.grossSales?.toNumber() || 0,
                fuelSales: lastReport.fuelSales?.toNumber() || 0,
                insideSales: lastReport.insideSales?.toNumber() || 0,
                customerCount: lastReport.totalTransactions || 0,
                cashVariance: lastReport.cashVariance?.toNumber() || 0,
                monthlySales,
                averageChange: {
                    sales: avgStats.sales > 0
                        ? ((lastReport.grossSales?.toNumber() || 0) - avgStats.sales) / avgStats.sales * 100
                        : 0,
                    customers: avgStats.customers > 0
                        ? ((lastReport.totalTransactions || 0) - avgStats.customers) / avgStats.customers * 100
                        : 0,
                },
            };
        }

        // Aggregate today's reports
        const totalSales = todayReports.reduce((sum, r) => sum + (r.grossSales?.toNumber() || 0), 0);
        const fuelSales = todayReports.reduce((sum, r) => sum + (r.fuelSales?.toNumber() || 0), 0);
        const insideSales = todayReports.reduce((sum, r) => sum + (r.insideSales?.toNumber() || 0), 0);
        const customerCount = todayReports.reduce((sum, r) => sum + (r.totalTransactions || 0), 0);
        const cashVariance = todayReports.reduce((sum, r) => sum + (r.cashVariance?.toNumber() || 0), 0);

        const avgStats = await this.get7DayAverage(storeId);
        const monthlySales = await this.getMonthlyTotal(storeId);

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
    }

    /**
     * Get 7-day average for comparison
     */
    private static async get7DayAverage(storeId: string): Promise<{ sales: number; customers: number }> {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const reports = await prisma.shiftReport.findMany({
            where: {
                storeId,
                reportDate: { gte: sevenDaysAgo },
            },
        });

        if (reports.length === 0) {
            return { sales: 0, customers: 0 };
        }

        const totalSales = reports.reduce((sum, r) => sum + (r.grossSales?.toNumber() || 0), 0);
        const totalCustomers = reports.reduce((sum, r) => sum + (r.totalTransactions || 0), 0);

        return {
            sales: totalSales / reports.length,
            customers: totalCustomers / reports.length,
        };
    }

    /**
     * Get current month's total sales
     */
    private static async getMonthlyTotal(storeId: string): Promise<number> {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const reports = await prisma.shiftReport.findMany({
            where: {
                storeId,
                reportDate: { gte: firstOfMonth },
            },
        });

        return reports.reduce((sum, r) => sum + (r.grossSales?.toNumber() || 0), 0);
    }

    /**
     * Get alerts for the store
     */
    static async getAlerts(storeId: string) {
        return prisma.alert.findMany({
            where: {
                storeId,
                resolvedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
    }
}