import apiClient from './client';

// ============================================
// Helper: Centralized number parsing
// Backend may return numbers as strings, null, or undefined
// ============================================
function parseNumber(value: string | number | null | undefined): number | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
}

// ============================================
// KV Explorer Types (Lightweight API)
// ============================================

export interface SectionInfo {
    name: string;
    count: number;
}

export interface ShiftReportSummary {
    grossSales?: number;
    netSales?: number;
    fuelSales?: number;
    insideSales?: number;
    totalTransactions?: number;
    cashVariance?: number;
    taxTotal?: number;
    refunds?: number;
    discounts?: number;
    fuelGallons?: number;
}

export interface ShiftReportDetail {
    id: string;
    storeId: string;
    storeName?: string;
    reportDate: string;
    businessDate?: string;
    shiftStart?: string;
    shiftEnd?: string;
    shiftId?: string;
    timezone?: string;
    vendorType?: string;
    extractionMethod?: string;
    createdAt: string;
    summary: ShiftReportSummary;
    sections: SectionInfo[];
    totalFields: number;
}

export interface KVPairItem {
    path: string;
    displayPath: string;
    value: any;
    valueType: string;
    section: string;
}

export interface ShiftReportSectionResponse {
    section: string;
    items: KVPairItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface ShiftReportSearchResponse {
    query: string;
    items: KVPairItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ============================================
// Legacy Types
// ============================================

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
     * Get full shift report with all extracted data (LEGACY)
     * @deprecated Use getShiftReportDetail for new lightweight API
     */
    async getShiftReportById(id: string): Promise<ShiftReportFull> {
        const response = await apiClient.get(`/shift-reports/${id}`);
        // Legacy endpoint - backend now returns data directly (not in .report)
        const data = response.data;
        return data;
    },

    /**
     * Get lightweight shift report detail with summary + sections[]
     * No kvPairs/rawText/parsedJson - those are fetched on-demand
     */
    async getShiftReportDetail(id: string): Promise<ShiftReportDetail> {
        const response = await apiClient.get(`/shift-reports/${id}`);
        const data = response.data;

        // Normalize summary numbers (backend may return strings)
        const summary = data.summary || {};
        return {
            ...data,
            summary: {
                grossSales: parseNumber(summary.grossSales),
                netSales: parseNumber(summary.netSales),
                fuelSales: parseNumber(summary.fuelSales),
                insideSales: parseNumber(summary.insideSales),
                totalTransactions: parseNumber(summary.totalTransactions),
                cashVariance: parseNumber(summary.cashVariance),
                taxTotal: parseNumber(summary.taxTotal),
                refunds: parseNumber(summary.refunds),
                discounts: parseNumber(summary.discounts),
                fuelGallons: parseNumber(summary.fuelGallons),
            },
            sections: data.sections || [],
            totalFields: data.totalFields || 0,
        };
    },

    /**
     * Get paginated KV pairs for a specific section
     */
    async getShiftReportSection(
        id: string,
        section: string,
        page: number = 1,
        pageSize: number = 50
    ): Promise<ShiftReportSectionResponse> {
        const response = await apiClient.get(
            `/shift-reports/${id}/section/${encodeURIComponent(section)}`,
            { params: { page, pageSize } }
        );
        return response.data;
    },

    /**
     * Search KV pairs across all sections
     */
    async searchShiftReport(
        id: string,
        query: string,
        page: number = 1,
        pageSize: number = 50
    ): Promise<ShiftReportSearchResponse> {
        const response = await apiClient.get(
            `/shift-reports/${id}/search`,
            { params: { q: query, page, pageSize } }
        );
        return response.data;
    },

    /**
     * Get raw text for debugging
     */
    async getShiftReportRawText(id: string): Promise<{ rawText: string }> {
        const response = await apiClient.get(`/shift-reports/${id}/raw-text`);
        return response.data;
    },

    /**
     * Get parsed JSON for debugging
     */
    async getShiftReportRawJson(id: string): Promise<{ vendorType: string; parsedJson: any }> {
        const response = await apiClient.get(`/shift-reports/${id}/raw-json`);
        return response.data;
    },

    async deleteShift(id: string): Promise<void> {
        await apiClient.delete(`/shifts/${id}`);
    },
};

export default shiftsApi;
