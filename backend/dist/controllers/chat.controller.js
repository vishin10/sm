"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const GeneralChatService_1 = require("../services/GeneralChatService");
const ConversationService_1 = require("../services/ConversationService");
const logger_1 = require("../utils/logger");
class ChatController {
    /**
     * POST /chat
     * General chat with conversation storage
     */
    static chat(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
                logger_1.Logger.info(`Chat request from user ${userId}: "${message}"`);
                // Get or create conversation
                let conversation;
                let conversationHistory = [];
                if (conversationId) {
                    // Load existing conversation
                    conversation = yield ConversationService_1.ConversationService.getById(conversationId, userId);
                    // Build conversation history from messages
                    conversationHistory = conversation.messages.map((msg) => ({
                        role: msg.role,
                        content: msg.content,
                    }));
                }
                else {
                    // Create new conversation
                    conversation = yield ConversationService_1.ConversationService.create({
                        storeId,
                        firstQuestion: message,
                    });
                }
                // Save user message
                yield ConversationService_1.ConversationService.addMessage({
                    conversationId: conversation.id,
                    role: 'user',
                    content: message,
                });
                // Get AI response
                const response = yield GeneralChatService_1.GeneralChatService.askQuestion(storeId, message, conversationHistory);
                // Save assistant message
                yield ConversationService_1.ConversationService.addMessage({
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
            }
            catch (error) {
                logger_1.Logger.error('Chat error', error);
                next(error);
            }
        });
    }
    /**
     * GET /chat/conversations
     * List all conversations for current user's store
     */
    static listConversations(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId, search } = req.query;
                if (!storeId) {
                    return res.status(400).json({
                        error: { code: 'INVALID_INPUT', message: 'Store ID is required' }
                    });
                }
                const conversations = yield ConversationService_1.ConversationService.listByStore(storeId, {
                    limit: 50,
                    includeMessages: false,
                    searchQuery: search,
                });
                res.json({ conversations });
            }
            catch (error) {
                logger_1.Logger.error('List conversations error', error);
                next(error);
            }
        });
    }
    /**
     * GET /chat/conversations/:id
     * Get single conversation with all messages
     */
    static getConversation(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const { id } = req.params;
                const conversation = yield ConversationService_1.ConversationService.getById(id, userId);
                res.json({ conversation });
            }
            catch (error) {
                logger_1.Logger.error('Get conversation error', error);
                next(error);
            }
        });
    }
    /**
     * DELETE /chat/conversations/:id
     * Delete conversation
     */
    static deleteConversation(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                yield ConversationService_1.ConversationService.delete(id);
                res.json({ message: 'Conversation deleted' });
            }
            catch (error) {
                logger_1.Logger.error('Delete conversation error', error);
                next(error);
            }
        });
    }
    /**
     * PATCH /chat/conversations/:id/pin
     * Toggle pin status
     */
    static togglePin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const conversation = yield ConversationService_1.ConversationService.togglePin(id);
                res.json({ conversation });
            }
            catch (error) {
                logger_1.Logger.error('Toggle pin error', error);
                next(error);
            }
        });
    }
    /**
     * PATCH /chat/conversations/:id/rename
     * Rename conversation
     */
    static renameConversation(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { title } = req.body;
                if (!title) {
                    return res.status(400).json({
                        error: { code: 'INVALID_INPUT', message: 'Title is required' }
                    });
                }
                const conversation = yield ConversationService_1.ConversationService.rename(id, title);
                res.json({ conversation });
            }
            catch (error) {
                logger_1.Logger.error('Rename conversation error', error);
                next(error);
            }
        });
    }
    /**
     * POST /chat/conversations/:id/share
     * Share conversation - generate public link
     */
    static shareConversation(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { password, expiresInDays } = req.body;
                const result = yield ConversationService_1.ConversationService.share({
                    conversationId: id,
                    password,
                    expiresInDays,
                });
                res.json(result);
            }
            catch (error) {
                logger_1.Logger.error('Share conversation error', error);
                next(error);
            }
        });
    }
    /**
     * POST /chat/conversations/:id/unshare
     * Revoke share link
     */
    static unshareConversation(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                yield ConversationService_1.ConversationService.unshare(id);
                res.json({ message: 'Share link revoked' });
            }
            catch (error) {
                logger_1.Logger.error('Unshare conversation error', error);
                next(error);
            }
        });
    }
    /**
     * GET /chat/shared/:token
     * Get shared conversation (public access, no auth required)
     */
    static getSharedConversation(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { token } = req.params;
                const { password } = req.query;
                const conversation = yield ConversationService_1.ConversationService.getShared(token, password);
                res.json({ conversation });
            }
            catch (error) {
                logger_1.Logger.error('Get shared conversation error', error);
                next(error);
            }
        });
    }
}
exports.ChatController = ChatController;
