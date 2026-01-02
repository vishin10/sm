import apiClient from './client';

export interface Alert {
    id: string;
    storeId: string;
    shiftId?: string;
    severity: 'info' | 'warn' | 'critical';
    type: string;
    title: string;
    message: string;
    createdAt: string;
    resolvedAt?: string;
}

export interface AlertsResponse {
    alerts: Alert[];
    total: number;
}

export const alertsApi = {
    async getAlerts(params?: {
        storeId?: string;
        severity?: string;
        resolved?: boolean;
    }): Promise<AlertsResponse> {
        const response = await apiClient.get('/alerts', { params });
        return response.data;
    },

    async resolveAlert(id: string): Promise<Alert> {
        const response = await apiClient.patch(`/alerts/${id}/resolve`);
        return response.data;
    },
};

export default alertsApi;
