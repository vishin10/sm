import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import OpenAI from 'openai';
import { Logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateConversationParams {
    storeId: string;
    firstQuestion?: string;
}

export interface AddMessageParams {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    reportsUsed?: string[];
}

export interface ShareConversationParams {
    conversationId: string;
    password?: string;
    expiresInDays?: number;
}

export interface ListConversationsOptions {
    limit?: number;
    includeMessages?: boolean;
    searchQuery?: string;
}

export class ConversationService {
    private static openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    /**
     * Create a new conversation
     */
    static async create(params: CreateConversationParams) {
        const title = params.firstQuestion
            ? await this.generateTitle(params.firstQuestion)
            : 'New Chat';

        return prisma.conversation.create({
            data: {
                storeId: params.storeId,
                title,
                lastMessageAt: new Date(),
            },
        });
    }

    /**
     * Generate conversation title from first question using AI
     */
    private static async generateTitle(firstQuestion: string): Promise<string> {
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

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 20,
            });

            const title = response.choices[0].message.content?.trim() || 'New Chat';
            return title.substring(0, 50);
        } catch (error) {
            Logger.error('Failed to generate title', error);
            return 'New Chat';
        }
    }

    /**
     * Add message to conversation
     */
    static async addMessage(params: AddMessageParams) {
        const message = await prisma.conversationMessage.create({
            data: {
                conversationId: params.conversationId,
                role: params.role,
                content: params.content,
                reportsUsed: params.reportsUsed || [],
            },
        });

        // Update conversation's lastMessageAt
        await prisma.conversation.update({
            where: { id: params.conversationId },
            data: { lastMessageAt: new Date() },
        });

        return message;
    }

    /**
     * List conversations for a store
     */
    static async listByStore(storeId: string, options?: ListConversationsOptions) {
        const where: any = { storeId };

        // Simple text search
        if (options?.searchQuery) {
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
            take: options?.limit || 50,
            orderBy: [
                { isPinned: 'desc' },  // Pinned first
                { lastMessageAt: 'desc' },
            ],
            include: {
                messages: options?.includeMessages
                    ? { orderBy: { createdAt: 'asc' } }
                    : false,
                _count: {
                    select: { messages: true },
                },
            },
        });
    }

    /**
     * Get single conversation with all messages
     */
    static async getById(conversationId: string, userId?: string) {
        const conversation = await prisma.conversation.findUnique({
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
    }

    /**
     * Delete conversation (hard delete)
     */
    static async delete(conversationId: string) {
        return prisma.conversation.delete({
            where: { id: conversationId },
        });
    }

    /**
     * Delete specific message from conversation
     */
    static async deleteMessage(messageId: string) {
        return prisma.conversationMessage.delete({
            where: { id: messageId },
        });
    }

    /**
     * Pin/unpin conversation
     */
    static async togglePin(conversationId: string) {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new Error('Conversation not found');
        }

        return prisma.conversation.update({
            where: { id: conversationId },
            data: { isPinned: !conversation.isPinned },
        });
    }

    /**
     * Rename conversation
     */
    static async rename(conversationId: string, newTitle: string) {
        return prisma.conversation.update({
            where: { id: conversationId },
            data: { title: newTitle.substring(0, 100) },
        });
    }

    /**
     * Share conversation - generate public link
     */
    static async share(params: ShareConversationParams) {
        const { conversationId, password, expiresInDays } = params;

        const shareToken = uuidv4();
        const sharePassword = password ? await bcrypt.hash(password, 10) : null;
        const shareExpiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        await prisma.conversation.update({
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
    }

    /**
     * Unshare conversation - revoke public link
     */
    static async unshare(conversationId: string) {
        return prisma.conversation.update({
            where: { id: conversationId },
            data: {
                isShared: false,
                shareToken: null,
                sharePassword: null,
                shareExpiresAt: null,
            },
        });
    }

    /**
     * Get shared conversation (public access)
     */
    static async getShared(shareToken: string, password?: string) {
        const conversation = await prisma.conversation.findUnique({
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
            const valid = await bcrypt.compare(password, conversation.sharePassword);
            if (!valid) {
                throw new Error('Invalid password');
            }
        }

        return conversation;
    }

    /**
     * Auto-cleanup: Delete conversations older than 90 days
     * Run this as a cron job daily
     */
    static async cleanupOldConversations() {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const result = await prisma.conversation.deleteMany({
            where: {
                lastMessageAt: { lt: ninetyDaysAgo },
                isPinned: false, // Don't delete pinned conversations
            },
        });

        Logger.info(`Cleaned up ${result.count} old conversations`);
        return result;
    }
}
