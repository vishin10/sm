import { Request, Response, NextFunction } from 'express';
import { GeneralChatService } from '../services/GeneralChatService';
import { ConversationService } from '../services/ConversationService';
import { Logger } from '../utils/logger';

export class ChatController {
    /**
     * POST /chat
     * General chat with conversation storage
     */
    static async chat(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.id;
            const { message, storeId, conversationId } = req.body;

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

            // Get or create conversation
            let conversation;
            let conversationHistory: Array<{ role: string; content: string }> = [];

            if (conversationId) {
                // Load existing conversation
                conversation = await ConversationService.getById(conversationId, userId);

                // Build conversation history from messages
                conversationHistory = conversation.messages.map((msg: any) => ({
                    role: msg.role,
                    content: msg.content,
                }));
            } else {
                // Create new conversation
                conversation = await ConversationService.create({
                    storeId,
                    firstQuestion: message,
                });
            }

            // Save user message
            await ConversationService.addMessage({
                conversationId: conversation.id,
                role: 'user',
                content: message,
            });

            // Get AI response
            const response = await GeneralChatService.askQuestion(
                storeId,
                message,
                conversationHistory
            );

            // Save assistant message
            await ConversationService.addMessage({
                conversationId: conversation.id,
                role: 'assistant',
                content: response.answer,
                reportsUsed: response.reportsUsed,
            });

            res.json({
                conversationId: conversation.id,
                reply: response.answer,
                suggestions: response.suggestions,
                reportsUsed: response.reportsUsed,
            });

        } catch (error) {
            Logger.error('Chat error', error);
            next(error);
        }
    }

    /**
     * GET /chat/conversations
     * List all conversations for current user's store
     */
    static async listConversations(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId, search } = req.query;

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'INVALID_INPUT', message: 'Store ID is required' }
                });
            }

            const conversations = await ConversationService.listByStore(storeId as string, {
                limit: 50,
                includeMessages: false,
                searchQuery: search as string | undefined,
            });

            res.json({ conversations });
        } catch (error) {
            Logger.error('List conversations error', error);
            next(error);
        }
    }

    /**
     * GET /chat/conversations/:id
     * Get single conversation with all messages
     */
    static async getConversation(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.id;
            const { id } = req.params;

            const conversation = await ConversationService.getById(id, userId);

            res.json({ conversation });
        } catch (error) {
            Logger.error('Get conversation error', error);
            next(error);
        }
    }

    /**
     * DELETE /chat/conversations/:id
     * Delete conversation
     */
    static async deleteConversation(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            await ConversationService.delete(id);

            res.json({ message: 'Conversation deleted' });
        } catch (error) {
            Logger.error('Delete conversation error', error);
            next(error);
        }
    }

    /**
     * PATCH /chat/conversations/:id/pin
     * Toggle pin status
     */
    static async togglePin(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const conversation = await ConversationService.togglePin(id);

            res.json({ conversation });
        } catch (error) {
            Logger.error('Toggle pin error', error);
            next(error);
        }
    }

    /**
     * PATCH /chat/conversations/:id/rename
     * Rename conversation
     */
    static async renameConversation(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { title } = req.body;

            if (!title) {
                return res.status(400).json({
                    error: { code: 'INVALID_INPUT', message: 'Title is required' }
                });
            }

            const conversation = await ConversationService.rename(id, title);

            res.json({ conversation });
        } catch (error) {
            Logger.error('Rename conversation error', error);
            next(error);
        }
    }

    /**
     * POST /chat/conversations/:id/share
     * Share conversation - generate public link
     */
    static async shareConversation(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { password, expiresInDays } = req.body;

            const result = await ConversationService.share({
                conversationId: id,
                password,
                expiresInDays,
            });

            res.json(result);
        } catch (error) {
            Logger.error('Share conversation error', error);
            next(error);
        }
    }

    /**
     * POST /chat/conversations/:id/unshare
     * Revoke share link
     */
    static async unshareConversation(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            await ConversationService.unshare(id);

            res.json({ message: 'Share link revoked' });
        } catch (error) {
            Logger.error('Unshare conversation error', error);
            next(error);
        }
    }

    /**
     * GET /chat/shared/:token
     * Get shared conversation (public access, no auth required)
     */
    static async getSharedConversation(req: Request, res: Response, next: NextFunction) {
        try {
            const { token } = req.params;
            const { password } = req.query;

            const conversation = await ConversationService.getShared(
                token,
                password as string | undefined
            );

            res.json({ conversation });
        } catch (error) {
            Logger.error('Get shared conversation error', error);
            next(error);
        }
    }
}