import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/TokenService';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = TokenService.verifyToken(token);
        (req as any).user = decoded; // Attach user to request
        next();
    } catch (err) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
};
