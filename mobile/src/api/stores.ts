import apiClient from './client';

export interface Store {
    id: string;
    name: string;
    timezone: string;
    deviceKey: string;
    createdAt: string;
}

export interface StoresResponse {
    stores: Store[];
}

export const storesApi = {
    async getStores(): Promise<StoresResponse> {
        const response = await apiClient.get('/stores');
        return response.data;
    },

    async setupStore(data: { name: string; timezone?: string }): Promise<Store> {
        const response = await apiClient.post('/stores/setup', data);
        return response.data;
    },
};

export default storesApi;
