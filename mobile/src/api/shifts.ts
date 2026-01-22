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
    quantity?: number;
    amount: string;
}

export interface ItemSale {
    id: string;
    itemName: string;
    sku?: string;
    quantity?: number;
    amount: string;
}

export interface ReportException {
    id: string;
    type: string;
    count: number;
    amount?: string;
}

// Full shift report with all extraction data
export interface ShiftReportFull {
    id: string;
    reportDate: string;
    registerId?: string;
    operatorId?: string;
    tillId?: string;
    shiftStart?: string;
    shiftEnd?: string;
    printedAt?: string;

    // Sales Summary
    grossSales?: string;
    netSales?: string;
    refunds?: string;
    discounts?: string;
    taxTotal?: string;
    totalTransactions?: number;

    // Fuel
    fuelSales?: string;
    fuelGross?: string;
    fuelGallons?: number;

    // Inside Sales
    insideSales?: string;
    merchandiseSales?: string;
    prepaysInitiated?: string;
    prepaysPumped?: string;

    // Balances / Cash Drawer
    beginningBalance?: string;
    endingBalance?: string;
    closingAccountability?: string;
    cashierCounted?: string;
    cashVariance?: string;

    // Tenders
    cashCount?: number;
    cashAmount?: string;
    creditCount?: number;
    creditAmount?: string;
    debitCount?: number;
    debitAmount?: string;
    checkCount?: number;
    checkAmount?: string;
    ebtCount?: number;
    ebtAmount?: string;
    otherTenderCount?: number;
    otherTenderAmount?: string;
    totalTenders?: string;

    // Safe Activity
    safeDropCount?: number;
    safeDropAmount?: string;
    safeLoanCount?: number;
    safeLoanAmount?: string;
    paidInCount?: number;
    paidInAmount?: string;
    paidOutCount?: number;
    paidOutAmount?: string;

    // Related data arrays
    departments: DepartmentSale[];
    items: ItemSale[];
    exceptions: ReportException[];

    // Metadata
    store?: { name: string };
    extractionMethod?: string;
    extractionConfidence?: number;
    rawText?: string;
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

    /**
     * Get full shift report with all extracted data
     * (departments, items, exceptions, tenders, etc.)
     */
    async getShiftReportById(id: string): Promise<ShiftReportFull> {
        const response = await apiClient.get(`/shift-reports/${id}`);
        return response.data.report;
    },

    async deleteShift(id: string): Promise<void> {
        await apiClient.delete(`/shifts/${id}`);
    },
};

export default shiftsApi;
