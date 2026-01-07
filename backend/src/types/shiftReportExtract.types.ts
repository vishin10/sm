import { z } from 'zod';

// Confidence level for each field
const ConfidenceLevel = z.number().min(0).max(1).optional();

// -------------------- SALES / ITEMS --------------------

// Department sale item
export const DepartmentSaleSchema = z.object({
    departmentName: z.string(),
    quantity: z.number().int().optional(),
    amount: z.number(),
    confidence: ConfidenceLevel,
});

// Item sale (if item-level data present)
export const ItemSaleSchema = z.object({
    itemName: z.string(),
    sku: z.string().optional(),
    quantity: z.number().int().optional(),
    amount: z.number(),
    confidence: ConfidenceLevel,
});

// Exception entry (voids, no-sales, etc.)
export const ExceptionSchema = z.object({
    type: z.string(),
    count: z.number().int().default(0),
    amount: z.number().optional(),
});

// -------------------- METADATA --------------------

// Store metadata section
export const StoreMetadataSchema = z.object({
    storeName: z.string().optional(),
    storeAddress: z.string().optional(),
    registerId: z.string().optional(),
    operatorId: z.string().optional(),
    tillId: z.string().optional(),

    // ISO date string
    reportPrintedAt: z.string().optional(),
    shiftStart: z.string().optional(),
    shiftEnd: z.string().optional(),

    // NOTE: This may be calendar date; business date can be derived from shiftEnd
    reportDate: z.string().optional(),
});

// -------------------- BALANCES --------------------

// Balances section
export const BalancesSchema = z.object({
    beginningBalance: z.number().optional(),
    endingBalance: z.number().optional(),
    closingAccountability: z.number().optional(),
    cashierCounted: z.number().optional(),
    cashVariance: z.number().optional(), // positive = over, negative = short
    confidence: ConfidenceLevel,
});

// -------------------- SALES SUMMARY --------------------

// Sales summary section
export const SalesSummarySchema = z.object({
    grossSales: z.number().optional(),
    netSales: z.number().optional(),
    refunds: z.number().optional(),
    discounts: z.number().optional(),
    taxTotal: z.number().optional(),

    // Many receipts call this "Transactions" or "Customers"
    totalTransactions: z.number().int().optional(),
    customersCount: z.number().int().optional(), // NEW

    confidence: ConfidenceLevel,
});

// -------------------- FUEL --------------------

// Fuel section
export const FuelSchema = z.object({
    fuelSales: z.number().optional(),
    fuelGross: z.number().optional(),
    fuelGallons: z.number().optional(),
    confidence: ConfidenceLevel,
});

// -------------------- INSIDE / MERCH --------------------

// Inside/Merchandise section
export const InsideSalesSchema = z.object({
    insideSales: z.number().optional(),
    merchandiseSales: z.number().optional(),
    prepaysInitiated: z.number().optional(),
    prepaysPumped: z.number().optional(),
    confidence: ConfidenceLevel,
});

// -------------------- TENDERS --------------------

// Tender (single type)
export const TenderSchema = z.object({
    type: z.string(),
    count: z.number().int().optional(),
    amount: z.number().optional(),
});

// Tenders section
export const TendersSchema = z.object({
    cash: TenderSchema.optional(),
    credit: TenderSchema.optional(),
    debit: TenderSchema.optional(),
    check: TenderSchema.optional(),
    ebt: TenderSchema.optional(),
    other: TenderSchema.optional(),
    totalTenders: z.number().optional(),
    confidence: ConfidenceLevel,
});

// -------------------- SAFE / TILL ACTIVITY --------------------

/**
 * Some POS systems break safe drops into:
 * - CASHIER SAFE DROPS (usually just cash)
 * - SYSTEM SAFE DROPS (cash/credit/debit breakdown)
 */
export const SafeDropsBreakdownSchema = z.object({
    cashier: z
        .object({
            cashAmount: z.number().optional(),
            totalAmount: z.number().optional(),
        })
        .optional(),

    system: z
        .object({
            cashAmount: z.number().optional(),
            creditAmount: z.number().optional(),
            debitAmount: z.number().optional(),
            totalAmount: z.number().optional(),
        })
        .optional(),
});

// Safe activity section
export const SafeActivitySchema = z.object({
    safeDropCount: z.number().int().optional(),
    safeDropAmount: z.number().optional(),
    safeLoanCount: z.number().int().optional(),
    safeLoanAmount: z.number().optional(),
    paidInCount: z.number().int().optional(),
    paidInAmount: z.number().optional(),
    paidOutCount: z.number().int().optional(),
    paidOutAmount: z.number().optional(),

    // NEW: safe drop breakdown
    safeDropsBreakdown: SafeDropsBreakdownSchema.optional(),

    // NEW: till payments in/out (shown on many receipts)
    paymentsIntoTillAmount: z.number().optional(),
    paymentsOutOfTillAmount: z.number().optional(),

    confidence: ConfidenceLevel,
});

// -------------------- FULL EXTRACTION --------------------

// Full extraction result
export const ShiftReportExtractSchema = z.object({
    // Raw OCR text
    rawText: z.string(),

    // Sections
    storeMetadata: StoreMetadataSchema.optional(),
    balances: BalancesSchema.optional(),
    salesSummary: SalesSummarySchema.optional(),
    fuel: FuelSchema.optional(),
    insideSales: InsideSalesSchema.optional(),
    tenders: TendersSchema.optional(),
    safeActivity: SafeActivitySchema.optional(),

    // Arrays
    departmentSales: z.array(DepartmentSaleSchema).default([]),
    itemSales: z.array(ItemSaleSchema).default([]),
    exceptions: z.array(ExceptionSchema).default([]),

    // Extraction metadata
    extractionMethod: z.enum(['ocr', 'openai_text', 'openai_vision']),
    extractionConfidence: z.number().min(0).max(1),
});

// -------------------- TYPES --------------------

export type DepartmentSale = z.infer<typeof DepartmentSaleSchema>;
export type ItemSale = z.infer<typeof ItemSaleSchema>;
export type ShiftReportException = z.infer<typeof ExceptionSchema>;
export type StoreMetadata = z.infer<typeof StoreMetadataSchema>;
export type Balances = z.infer<typeof BalancesSchema>;
export type SalesSummary = z.infer<typeof SalesSummarySchema>;
export type Fuel = z.infer<typeof FuelSchema>;
export type InsideSales = z.infer<typeof InsideSalesSchema>;
export type Tenders = z.infer<typeof TendersSchema>;
export type SafeActivity = z.infer<typeof SafeActivitySchema>;
export type ShiftReportExtract = z.infer<typeof ShiftReportExtractSchema>;

// Summary type for AI chat queries
export interface ShiftReportSummary {
    id: string;
    reportDate: string;
    shiftStart?: string;
    shiftEnd?: string;
    grossSales?: number;
    netSales?: number;
    fuelSales?: number;
    insideSales?: number;
    cashVariance?: number;

    // NEW (optional, because older rows may not have it)
    customersCount?: number;

    topDepartments: { name: string; amount: number }[];
    topItems: { name: string; amount: number }[];
    tenderBreakdown: { type: string; amount: number }[];
}
