import { Request, Response, NextFunction } from 'express';
import { AgentService } from '../services/AgentService';

/**
 * Middleware to authenticate agent requests using X-API-Key header
 */
export const authenticateAgent = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
        return res.status(401).json({
            error: {
                code: 'MISSING_API_KEY',
                message: 'X-API-Key header is required'
            }
        });
    }

    if (!apiKey.startsWith('sk_agent_')) {
        return res.status(401).json({
            error: {
                code: 'INVALID_API_KEY_FORMAT',
                message: 'Invalid API key format'
            }
        });
    }

    try {
        const result = await AgentService.validateApiKey(apiKey);

        if (!result) {
            return res.status(401).json({
                error: {
                    code: 'INVALID_API_KEY',
                    message: 'API key is invalid or revoked'
                }
            });
        }

        // Attach store info to request
        (req as any).agent = {
            storeId: result.storeId,
            keyId: result.keyId
        };

        next();
    } catch (err) {
        return res.status(500).json({
            error: {
                code: 'AUTH_ERROR',
                message: 'Failed to validate API key'
            }
        });
    }
};
