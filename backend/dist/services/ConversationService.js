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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
class ConversationService {
    /**
     * Create a new conversation
     */
    static create(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const title = params.firstQuestion
                ? yield this.generateTitle(params.firstQuestion)
                : 'New Chat';
            return prisma.conversation.create({
                data: {
                    storeId: params.storeId,
                    title,
                    lastMessageAt: new Date(),
                },
            });
        });
    }
    /**
     * Generate conversation title from first question using AI
     */
    static generateTitle(firstQuestion) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const prompt = `Generate a short, descriptive title (max 50 chars) for a conversation that starts with this question:

"${firstQuestion}"

Rules:
- Be specific and descriptive
- Include key topics (dates, metrics, etc.)
- Max 50 characters
- No quotes or special characters

Examples:
"What was yesterday's fuel sales?" → "Yesterday's Fuel Sales"
"Compare Feb 15 to Jan 3" → "Feb 15 vs Jan 3 Comparison"
"Cash variance issue on Monday" → "Monday Cash Variance"

Title:`;
                const response = yield this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 20,
                });
                const title = ((_a = response.choices[0].message.content) === null || _a === void 0 ? void 0 : _a.trim()) || 'New Chat';
                return title.substring(0, 50);
            }
            catch (error) {
                logger_1.Logger.error('Failed to generate title', error);
                return 'New Chat';
            }
        });
    }
    /**
     * Add message to conversation
     */
    static addMessage(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = yield prisma.conversationMessage.create({
                data: {
                    conversationId: params.conversationId,
                    role: params.role,
                    content: params.content,
                    reportsUsed: params.reportsUsed || [],
                },
            });
            // Update conversation's lastMessageAt
            yield prisma.conversation.update({
                where: { id: params.conversationId },
                data: { lastMessageAt: new Date() },
            });
            return message;
        });
    }
    /**
     * List conversations for a store
     */
    static listByStore(storeId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = { storeId };
            // Simple text search
            if (options === null || options === void 0 ? void 0 : options.searchQuery) {
                where.OR = [
                    { title: { contains: options.searchQuery, mode: 'insensitive' } },
                    {
                        messages: {
                            some: {
                                content: { contains: options.searchQuery, mode: 'insensitive' },
                            },
                        },
                    },
                ];
            }
            return prisma.conversation.findMany({
                where,
                take: (options === null || options === void 0 ? void 0 : options.limit) || 50,
                orderBy: [
                    { isPinned: 'desc' }, // Pinned first
                    { lastMessageAt: 'desc' },
                ],
                include: {
                    messages: (options === null || options === void 0 ? void 0 : options.includeMessages)
                        ? { orderBy: { createdAt: 'asc' } }
                        : false,
                    _count: {
                        select: { messages: true },
                    },
                },
            });
        });
    }
    /**
     * Get single conversation with all messages
     */
    static getById(conversationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield prisma.conversation.findUnique({
                where: { id: conversationId },
                include: {
                    messages: { orderBy: { createdAt: 'asc' } },
                    store: true,
                },
            });
            if (!conversation) {
                throw new Error('Conversation not found');
            }
            // If userId provided, verify ownership
            if (userId && conversation.store.userId !== userId) {
                throw new Error('Unauthorized');
            }
            return conversation;
        });
    }
    /**
     * Delete conversation (hard delete)
     */
    static delete(conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.conversation.delete({
                where: { id: conversationId },
            });
        });
    }
    /**
     * Delete specific message from conversation
     */
    static deleteMessage(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.conversationMessage.delete({
                where: { id: messageId },
            });
        });
    }
    /**
     * Pin/unpin conversation
     */
    static togglePin(conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield prisma.conversation.findUnique({
                where: { id: conversationId },
            });
            if (!conversation) {
                throw new Error('Conversation not found');
            }
            return prisma.conversation.update({
                where: { id: conversationId },
                data: { isPinned: !conversation.isPinned },
            });
        });
    }
    /**
     * Rename conversation
     */
    static rename(conversationId, newTitle) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.conversation.update({
                where: { id: conversationId },
                data: { title: newTitle.substring(0, 100) },
            });
        });
    }
    /**
     * Share conversation - generate public link
     */
    static share(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { conversationId, password, expiresInDays } = params;
            const shareToken = (0, uuid_1.v4)();
            const sharePassword = password ? yield bcrypt_1.default.hash(password, 10) : null;
            const shareExpiresAt = expiresInDays
                ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
                : null;
            yield prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    isShared: true,
                    shareToken,
                    sharePassword,
                    shareExpiresAt,
                },
            });
            // Build share URL from environment or default
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return {
                shareUrl: `${frontendUrl}/shared/${shareToken}`,
                shareToken,
                expiresAt: shareExpiresAt,
            };
        });
    }
    /**
     * Unshare conversation - revoke public link
     */
    static unshare(conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    isShared: false,
                    shareToken: null,
                    sharePassword: null,
                    shareExpiresAt: null,
                },
            });
        });
    }
    /**
     * Get shared conversation (public access)
     */
    static getShared(shareToken, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield prisma.conversation.findUnique({
                where: { shareToken },
                include: {
                    messages: { orderBy: { createdAt: 'asc' } },
                },
            });
            if (!conversation) {
                throw new Error('Shared conversation not found');
            }
            if (!conversation.isShared) {
                throw new Error('This conversation is no longer shared');
            }
            // Check expiry
            if (conversation.shareExpiresAt && conversation.shareExpiresAt < new Date()) {
                throw new Error('This share link has expired');
            }
            // Check password if set
            if (conversation.sharePassword) {
                if (!password) {
                    throw new Error('Password required');
                }
                const valid = yield bcrypt_1.default.compare(password, conversation.sharePassword);
                if (!valid) {
                    throw new Error('Invalid password');
                }
            }
            return conversation;
        });
    }
    /**
     * Auto-cleanup: Delete conversations older than 90 days
     * Run this as a cron job daily
     */
    static cleanupOldConversations() {
        return __awaiter(this, void 0, void 0, function* () {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const result = yield prisma.conversation.deleteMany({
                where: {
                    lastMessageAt: { lt: ninetyDaysAgo },
                    isPinned: false, // Don't delete pinned conversations
                },
            });
            logger_1.Logger.info(`Cleaned up ${result.count} old conversations`);
            return result;
        });
    }
}
exports.ConversationService = ConversationService;
ConversationService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
