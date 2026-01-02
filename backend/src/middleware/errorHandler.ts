import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    Logger.error(err.stack || err.message);

    const status = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message,
        }
    });
};
