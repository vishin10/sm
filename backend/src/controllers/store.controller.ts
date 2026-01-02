import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { prisma } from '../config/database';
import { CryptoUtils } from '../utils/crypto';

export const storeSetupValidation = [
    body('name').notEmpty().withMessage('Store name is required'),
    body('timezone').optional().isString(),
];

export class StoreController {
    static async setup(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;
            const { name, timezone } = req.body;

            const store = await prisma.store.create({
                data: {
                    userId,
                    name,
                    timezone: timezone || 'America/New_York',
                    deviceKey: CryptoUtils.generateDeviceKey(),
                },
            });

            res.status(201).json({ store });
        } catch (error) {
            next(error);
        }
    }

    static async getStores(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;
            const stores = await prisma.store.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
            });

            res.json({ stores });
        } catch (error) {
            next(error);
        }
    }
}
