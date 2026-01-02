import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export const requireDeviceKey = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Device key required' } });
    }

    const deviceKey = authHeader.split(' ')[1];

    try {
        const store = await prisma.store.findUnique({ where: { deviceKey } });

        if (!store) {
            return res.status(401).json({ error: { code: 'INVALID_KEY', message: 'Invalid device key' } });
        }

        (req as any).store = store;
        next();
    } catch (err) {
        next(err);
    }
};
