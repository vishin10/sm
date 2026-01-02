import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AnalyticsService } from '../services/AnalyticsService';

export class InsightController {
    static async getInsights(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;

            const userStores = await prisma.store.findMany({ where: { userId } });

            // For now, generate insights on the fly for the first store found (MVP limitation/simplification)
            // In real app, might aggregate or ask for storeId
            if (userStores.length === 0) {
                return res.json({ insights: [] });
            }

            const storeId = userStores[0].id; // Primary store

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
            // For MVP, just picking the first store for the user context
            const userStores = await prisma.store.findMany({ where: { userId }, take: 1 });
            if (userStores.length === 0) {
                return res.json({ salesTrend: { labels: [], datasets: [] }, categoryBreakdown: { labels: [], data: [] } });
            }

            const trends = await AnalyticsService.getTrends(userStores[0].id);
            res.json(trends);
        } catch (error) {
            next(error);
        }
    }
}
