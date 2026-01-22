import apiClient from './client';

export interface AgentPinResponse {
    pin: string;
    expiresAt: string;
    storeName: string;
}

export interface AgentKey {
    id: string;
    keyPrefix: string;
    deviceName: string;
    status: 'ACTIVE' | 'REVOKED';
    lastSeenAt: string | null;
    createdAt: string;
}

export const agentApi = {
    /**
     * Generate a setup PIN for a store
     */
    generatePin: async (storeId: string): Promise<AgentPinResponse> => {
        const response = await apiClient.post('/agent/generate-pin', { storeId });
        return response.data;
    },

    /**
     * List registered agents (API keys) for a store
     */
    listKeys: async (storeId: string): Promise<{ keys: AgentKey[] }> => {
        const response = await apiClient.get('/agent/keys', {
            params: { storeId }
        });
        return response.data;
    },

    /**
     * Revoke an agent's access
     */
    revokeKey: async (keyId: string, storeId: string): Promise<{ success: boolean }> => {
        const response = await apiClient.delete(`/agent/keys/${keyId}`, {
            data: { storeId }
        });
        return response.data;
    }
};
