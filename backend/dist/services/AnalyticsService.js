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
exports.AnalyticsService = void 0;
const database_1 = require("../config/database");
class AnalyticsService {
    static detectAnomalies(shift) {
        return __awaiter(this, void 0, void 0, function* () {
            const alerts = []; // Alert create inputs
            // 1. Cash Variance Alerts
            const variance = Number(shift.cashVariance); // Ensure it's number
            if (Math.abs(variance) > 50) {
                alerts.push({
                    severity: 'critical',
                    type: 'cash_variance',
                    title: variance > 0 ? 'Cash Overage Detected' : 'Cash Shortage Detected',
                    message: `This shift is ${variance > 0 ? 'over' : 'short'} by $${Math.abs(variance).toFixed(2)}. Please verify register drawer and deposits.`,
                });
            }
            else if (Math.abs(variance) > 20) {
                alerts.push({
                    severity: 'warn',
                    type: 'cash_variance',
                    title: variance > 0 ? 'Minor Cash Overage' : 'Minor Cash Shortage',
                    message: `Cash variance: ${variance > 0 ? '+' : ''}$${variance.toFixed(2)}`,
                });
            }
            // 2. High Voids
            if (shift.voidCount > 10) {
                alerts.push({
                    severity: 'warn',
                    type: 'high_voids',
                    title: 'High Void Count',
                    message: `${shift.voidCount} voids in this shift. Check for training issues or fraud.`,
                });
            }
            // 3. High Refunds
            const refunds = Number(shift.refunds);
            if (refunds > 100) {
                alerts.push({
                    severity: 'warn',
                    type: 'high_refunds',
                    title: 'Unusual Refund Activity',
                    message: `$${refunds.toFixed(2)} in refunds. Verify refund policies are followed.`,
                });
            }
            return alerts;
        });
    }
    static generateInsights(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const insights = [];
            // Fetch last 7 days of shifts
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const shifts = yield database_1.prisma.shift.findMany({
                where: {
                    storeId,
                    startAt: { gte: sevenDaysAgo }
                },
                orderBy: { totalSales: 'desc' },
                include: { departments: true }
            });
            if (shifts.length === 0)
                return insights;
            // Best Shift
            const bestShift = shifts[0];
            insights.push({
                title: 'Top Performing Shift',
                message: `Your best shift this week was on ${bestShift.startAt ? new Date(bestShift.startAt).toLocaleDateString() : 'Unknown Date'} with $${Number(bestShift.totalSales).toFixed(2)} in sales.`,
                metricValue: `$${Number(bestShift.totalSales).toFixed(2)}`,
                periodLabel: 'Last 7 Days',
                severity: 'positive'
            });
            // Fuel/Inside Ratio
            const totalFuel = shifts.reduce((sum, s) => sum + Number(s.fuelSales), 0);
            const totalInside = shifts.reduce((sum, s) => sum + Number(s.nonFuelSales), 0);
            const total = totalFuel + totalInside;
            if (total > 0) {
                const ratio = (totalFuel / total * 100).toFixed(1);
                insights.push({
                    title: 'Fuel vs Inside Sales',
                    message: `Fuel accounts for ${ratio}% of your sales this week. ${Number(ratio) > 60 ? 'Consider promotions to boost inside sales.' : 'Great balance!'}`,
                    metricValue: `${ratio}%`,
                    periodLabel: 'Last 7 Days',
                    severity: Number(ratio) > 60 ? 'neutral' : 'positive'
                });
            }
            // Avg Cash Variance
            const avgVariance = shifts.reduce((sum, s) => sum + Number(s.cashVariance), 0) / shifts.length;
            insights.push({
                title: 'Cash Accuracy',
                message: `Average cash variance: ${avgVariance > 0 ? '+' : ''}$${avgVariance.toFixed(2)}. ${Math.abs(avgVariance) < 5 ? 'Excellent accuracy!' : 'Review counting procedures.'}`,
                metricValue: `${avgVariance > 0 ? '+' : ''}$${avgVariance.toFixed(2)}`,
                periodLabel: 'Last 7 Days',
                severity: Math.abs(avgVariance) < 5 ? 'positive' : 'neutral'
            });
            return insights;
        });
    }
    static getTrends(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const shifts = yield database_1.prisma.shift.findMany({
                where: {
                    storeId,
                    startAt: { gte: sevenDaysAgo }
                },
                orderBy: { startAt: 'asc' },
                select: {
                    startAt: true,
                    totalSales: true,
                    nonFuelSales: true,
                    fuelSales: true
                }
            });
            // 1. Sales Trend (Last 7 Days)
            const labels = shifts.map(s => s.startAt ? new Date(s.startAt).toLocaleDateString(undefined, { weekday: 'short' }) : 'N/A');
            const data = shifts.map(s => Number(s.totalSales));
            // 2. Category Breakdown (Aggregated)
            const totalFuel = shifts.reduce((sum, s) => sum + Number(s.fuelSales), 0);
            const totalInside = shifts.reduce((sum, s) => sum + Number(s.nonFuelSales), 0);
            return {
                salesTrend: {
                    labels,
                    datasets: [{ data }]
                },
                categoryBreakdown: {
                    labels: ['Fuel', 'Inside'],
                    data: [totalFuel, totalInside]
                }
            };
        });
    }
}
exports.AnalyticsService = AnalyticsService;
