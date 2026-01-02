import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export class ShiftController {
    static async getShifts(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;
            const { startDate, endDate, limit = 20, offset = 0 } = req.query;

            // Ensure user owns the stores
            const userStores = await prisma.store.findMany({ where: { userId }, select: { id: true } });
            const storeIds = userStores.map(s => s.id);

            const where: any = {
                storeId: { in: storeIds },
            };

            if (startDate && endDate) {
                where.startAt = {
                    gte: new Date(startDate as string),
                    lte: new Date(endDate as string),
                };
            }

            const [shifts, total] = await Promise.all([
                prisma.shift.findMany({
                    where,
                    include: { store: { select: { name: true } } },
                    orderBy: { startAt: 'desc' },
                    take: Number(limit),
                    skip: Number(offset),
                }),
                prisma.shift.count({ where }),
            ]);

            res.json({ shifts, total });
        } catch (error) {
            next(error);
        }
    }

    static async getShiftById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = (req as any).user.id;

            const shift = await prisma.shift.findUnique({
                where: { id },
                include: {
                    departments: true,
                    alerts: true,
                    store: true
                }
            });

            if (!shift) {
                return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });
            }

            if (shift.store.userId !== userId) {
                return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
            }

            res.json({ shift });
        } catch (error) {
            next(error);
        }
    }

    static async deleteShift(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = (req as any).user.id;

            const shift = await prisma.shift.findUnique({ where: { id }, include: { store: true } });
            if (!shift) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });
            if (shift.store.userId !== userId) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });

            await prisma.shift.delete({ where: { id } });
            res.json({ deleted: true });
        } catch (error) {
            next(error);
        }
    }
}
