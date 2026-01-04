import { Request, Response, NextFunction } from 'express';
import { GeneralChatService } from '../services/GeneralChatService';
import { Logger } from '../utils/logger';

export class ChatController {
    /**
     * POST /chat
     * General chat about shift reports - handles single or multiple reports
     */
    static async chat(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.id;
            const { message, storeId, conversationHistory } = req.body;

            if (!message) {
                return res.status(400).json({
                    error: { code: 'INVALID_INPUT', message: 'Message is required' }
                });
            }

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'INVALID_INPUT', message: 'Store ID is required' }
                });
            }

            Logger.info(`Chat request from user ${userId}: "${message}"`);

            const response = await GeneralChatService.askQuestion(
                storeId,
                message,
                conversationHistory
            );

            res.json({
                reply: response.answer,
                suggestions: response.suggestions,
                reportsUsed: response.reportsUsed
            });

        } catch (error) {
            Logger.error('Chat error', error);
            next(error);
        }
    }
}