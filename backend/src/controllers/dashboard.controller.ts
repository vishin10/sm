import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/DashboardService';
import { Logger } from '../utils/logger';

export class DashboardController {
    /**
     * GET /dashboard/today
     */
    static async getTodayStats(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId } = req.query;

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'INVALID_INPUT', message: 'Store ID is required' }
                });
            }

            const stats = await DashboardService.getTodayStats(storeId as string);

            if (!stats) {
                return res.json({
                    stats: null,
                    message: 'No data available',
                });
            }

            const alerts = await DashboardService.getAlerts(storeId as string);

            res.json({
                stats,
                alerts,
            });

        } catch (error) {
            Logger.error('Dashboard stats error', error);
            next(error);
        }
    }
}