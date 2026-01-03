import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AnalyticsService } from '../services/AnalyticsService';

export class InsightController {
    static async getInsights(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;
            const { storeId } = req.query;

            const userStores = await prisma.store.findMany({ where: { userId } });
            const userStoreIds = userStores.map(s => s.id);

            if (userStores.length === 0) {
                return res.json({ insights: [] });
            }

            // If storeId provided, verify user owns it
            if (storeId && !userStoreIds.includes(storeId as string)) {
                return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied to this store' } });
            }

            // Generate fresh insights
            const insights = await AnalyticsService.generateInsights(userId);
            res.json(insights);
        } catch (error) {
            next(error);
        }
    }

    static async getTrends(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;
            const { storeId } = req.query;

            const userStores = await prisma.store.findMany({ where: { userId } });
            const userStoreIds = userStores.map(s => s.id);

            if (userStores.length === 0) {
                return res.json({ salesTrend: { labels: [], datasets: [] }, categoryBreakdown: { labels: [], data: [] } });
            }

            // If storeId provided, verify user owns it and use it; otherwise use first store
            let targetStoreId: string;
            if (storeId) {
                if (!userStoreIds.includes(storeId as string)) {
                    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied to this store' } });
                }
                targetStoreId = storeId as string;
            } else {
                targetStoreId = userStores[0].id;
            }

            const trends = await AnalyticsService.getTrends(targetStoreId);
            res.json(trends);
        } catch (error) {
            next(error);
        }
    }
}

