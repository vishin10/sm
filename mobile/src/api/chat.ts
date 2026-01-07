import { apiClient } from './client';

// Types
export interface Conversation {
    id: string;
    title: string;
    isPinned: boolean;
    lastMessageAt: string;
    createdAt: string;
    _count?: { messages: number };
}

export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
    reportsUsed?: string[];
}

export interface ConversationWithMessages extends Conversation {
    messages: ConversationMessage[];
}

export interface ChatResponse {
    conversationId: string;
    reply: string;
    suggestions: string[];
    reportsUsed?: string[];
}

// API Functions

/**
 * Send a chat message (creates new conversation if no conversationId)
 */
export async function sendChatMessage(
    storeId: string,
    message: string,
    conversationId?: string | null
): Promise<ChatResponse> {
    const response = await apiClient.post('/chat', {
        message,
        storeId,
        conversationId,
    });
    return response.data;
}

/**
 * List conversations for a store
 */
export async function getConversations(
    storeId: string,
    search?: string
): Promise<{ conversations: Conversation[] }> {
    const params: any = { storeId };
    if (search) params.search = search;

    const response = await apiClient.get('/chat/conversations', { params });
    return response.data;
}

/**
 * Get single conversation with messages
 */
export async function getConversation(
    conversationId: string
): Promise<{ conversation: ConversationWithMessages }> {
    const response = await apiClient.get(`/chat/conversations/${conversationId}`);
    return response.data;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
    conversationId: string
): Promise<{ message: string }> {
    const response = await apiClient.delete(`/chat/conversations/${conversationId}`);
    return response.data;
}

/**
 * Toggle pin status
 */
export async function togglePinConversation(
    conversationId: string
): Promise<{ conversation: Conversation }> {
    const response = await apiClient.patch(`/chat/conversations/${conversationId}/pin`);
    return response.data;
}

/**
 * Rename conversation
 */
export async function renameConversation(
    conversationId: string,
    title: string
): Promise<{ conversation: Conversation }> {
    const response = await apiClient.patch(`/chat/conversations/${conversationId}/rename`, {
        title,
    });
    return response.data;
}
