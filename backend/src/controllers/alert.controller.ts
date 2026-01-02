import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export class AlertController {
    static async getAlerts(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;
            const { severity, resolved, limit = 20 } = req.query;

            const userStores = await prisma.store.findMany({ where: { userId }, select: { id: true } });
            const storeIds = userStores.map(s => s.id);

            const where: any = {
                storeId: { in: storeIds },
            };

            if (severity) where.severity = severity;

            if (resolved === 'false') {
                where.resolvedAt = null;
            } else if (resolved === 'true') {
                where.resolvedAt = { not: null };
            }

            const alerts = await prisma.alert.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
            });

            res.json({ alerts });
        } catch (error) {
            next(error);
        }
    }

    static async resolveAlert(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = (req as any).user.id;

            const alert = await prisma.alert.findUnique({
                where: { id },
                include: { store: true }
            });

            if (!alert) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
            if (alert.store.userId !== userId) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });

            const updated = await prisma.alert.update({
                where: { id },
                data: { resolvedAt: new Date() }
            });

            res.json({ alert: updated });
        } catch (error) {
            next(error);
        }
    }
}
