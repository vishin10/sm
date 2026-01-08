// Add this to your existing api/dashboard.ts or create new file

import api from './client';

export interface TodayStats {
    date: string;
    shiftCount: number;
    totalSales: number;
    fuelSales: number;
    insideSales: number;
    customerCount: number;
    cashVariance: number;
    monthlySales: number;
    averageChange: {
        sales: number;
        customers: number;
    };
}

export interface Alert {
    id: string;
    severity: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
}

export interface DashboardResponse {
    stats: TodayStats | null;
    alerts: Alert[];
}

export const getTodayStats = async (storeId: string): Promise<DashboardResponse> => {
    const response = await api.get('/dashboard/today', {
        params: { storeId },
    });
    return response.data;
};