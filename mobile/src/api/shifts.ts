import apiClient from './client';

export interface Shift {
    id: string;
    storeId: string;
    registerId?: string;
    operatorId?: string;
    startAt?: string;
    endAt?: string;
    totalSales: string;
    fuelSales: string;
    nonFuelSales: string;
    refunds: string;
    voidCount: number;
    discountTotal: string;
    taxTotal: string;
    customerCount?: number;
    cashVariance: string;
    createdAt: string;
    departments?: DepartmentSale[];
}

export interface DepartmentSale {
    id: string;
    departmentName: string;
    amount: string;
}

export interface ShiftsResponse {
    shifts: Shift[];
    total: number;
}

export const shiftsApi = {
    async getShifts(params?: {
        storeId?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<ShiftsResponse> {
        const response = await apiClient.get('/shifts', { params });
        return response.data;
    },

    async getShiftById(id: string): Promise<Shift> {
        const response = await apiClient.get(`/shifts/${id}`);
        return response.data;
    },

    async deleteShift(id: string): Promise<void> {
        await apiClient.delete(`/shifts/${id}`);
    },
};

export default shiftsApi;
