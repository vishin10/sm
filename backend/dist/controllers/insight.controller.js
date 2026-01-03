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
exports.InsightController = void 0;
const database_1 = require("../config/database");
const AnalyticsService_1 = require("../services/AnalyticsService");
class InsightController {
    static getInsights(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { storeId } = req.query;
                const userStores = yield database_1.prisma.store.findMany({ where: { userId } });
                const userStoreIds = userStores.map(s => s.id);
                if (userStores.length === 0) {
                    return res.json({ insights: [] });
                }
                // If storeId provided, verify user owns it
                if (storeId && !userStoreIds.includes(storeId)) {
                    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied to this store' } });
                }
                // Generate fresh insights
                const insights = yield AnalyticsService_1.AnalyticsService.generateInsights(userId);
                res.json(insights);
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getTrends(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { storeId } = req.query;
                const userStores = yield database_1.prisma.store.findMany({ where: { userId } });
                const userStoreIds = userStores.map(s => s.id);
                if (userStores.length === 0) {
                    return res.json({ salesTrend: { labels: [], datasets: [] }, categoryBreakdown: { labels: [], data: [] } });
                }
                // If storeId provided, verify user owns it and use it; otherwise use first store
                let targetStoreId;
                if (storeId) {
                    if (!userStoreIds.includes(storeId)) {
                        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied to this store' } });
                    }
                    targetStoreId = storeId;
                }
                else {
                    targetStoreId = userStores[0].id;
                }
                const trends = yield AnalyticsService_1.AnalyticsService.getTrends(targetStoreId);
                res.json(trends);
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.InsightController = InsightController;
