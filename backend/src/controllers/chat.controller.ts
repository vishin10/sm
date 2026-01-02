import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/ChatService';

export class ChatController {
    static async chat(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;
            const { message } = req.body;

            if (!message) {
                return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Message is required' } });
            }

            const reply = await ChatService.generateReply(userId, message);

            res.json({ reply });
        } catch (error) {
            next(error);
        }
    }
}
