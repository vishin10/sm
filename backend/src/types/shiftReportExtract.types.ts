import { z } from 'zod';

// Confidence level for each field
const ConfidenceLevel = z.number().min(0).max(1).optional();

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

// Store metadata section
export const StoreMetadataSchema = z.object({
    storeName: z.string().optional(),
    storeAddress: z.string().optional(),
    registerId: z.string().optional(),
    operatorId: z.string().optional(),
    tillId: z.string().optional(),
    reportPrintedAt: z.string().optional(), // ISO date string
    shiftStart: z.string().optional(),
    shiftEnd: z.string().optional(),
    reportDate: z.string().optional(),
});

// Balances section
export const BalancesSchema = z.object({
    beginningBalance: z.number().optional(),
    endingBalance: z.number().optional(),
    closingAccountability: z.number().optional(),
    cashierCounted: z.number().optional(),
    cashVariance: z.number().optional(), // positive = over, negative = short
    confidence: ConfidenceLevel,
});

// Sales summary section
export const SalesSummarySchema = z.object({
    grossSales: z.number().optional(),
    netSales: z.number().optional(),
    refunds: z.number().optional(),
    discounts: z.number().optional(),
    taxTotal: z.number().optional(),
    totalTransactions: z.number().int().optional(),
    confidence: ConfidenceLevel,
});

// Fuel section
export const FuelSchema = z.object({
    fuelSales: z.number().optional(),
    fuelGross: z.number().optional(),
    fuelGallons: z.number().optional(),
    confidence: ConfidenceLevel,
});

// Inside/Merchandise section
export const InsideSalesSchema = z.object({
    insideSales: z.number().optional(),
    merchandiseSales: z.number().optional(),
    prepaysInitiated: z.number().optional(),
    prepaysPumped: z.number().optional(),
    confidence: ConfidenceLevel,
});

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
    confidence: ConfidenceLevel,
});

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
    topDepartments: { name: string; amount: number }[];
    topItems: { name: string; amount: number }[];
    tenderBreakdown: { type: string; amount: number }[];
}
