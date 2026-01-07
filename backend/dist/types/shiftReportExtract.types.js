"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftReportExtractSchema = exports.SafeActivitySchema = exports.SafeDropsBreakdownSchema = exports.TendersSchema = exports.TenderSchema = exports.InsideSalesSchema = exports.FuelSchema = exports.SalesSummarySchema = exports.BalancesSchema = exports.StoreMetadataSchema = exports.ExceptionSchema = exports.ItemSaleSchema = exports.DepartmentSaleSchema = void 0;
const zod_1 = require("zod");
// Confidence level for each field
const ConfidenceLevel = zod_1.z.number().min(0).max(1).optional();
// -------------------- SALES / ITEMS --------------------
// Department sale item
exports.DepartmentSaleSchema = zod_1.z.object({
    departmentName: zod_1.z.string(),
    quantity: zod_1.z.number().int().optional(),
    amount: zod_1.z.number(),
    confidence: ConfidenceLevel,
});
// Item sale (if item-level data present)
exports.ItemSaleSchema = zod_1.z.object({
    itemName: zod_1.z.string(),
    sku: zod_1.z.string().optional(),
    quantity: zod_1.z.number().int().optional(),
    amount: zod_1.z.number(),
    confidence: ConfidenceLevel,
});
// Exception entry (voids, no-sales, etc.)
exports.ExceptionSchema = zod_1.z.object({
    type: zod_1.z.string(),
    count: zod_1.z.number().int().default(0),
    amount: zod_1.z.number().optional(),
});
// -------------------- METADATA --------------------
// Store metadata section
exports.StoreMetadataSchema = zod_1.z.object({
    storeName: zod_1.z.string().optional(),
    storeAddress: zod_1.z.string().optional(),
    registerId: zod_1.z.string().optional(),
    operatorId: zod_1.z.string().optional(),
    tillId: zod_1.z.string().optional(),
    // ISO date string
    reportPrintedAt: zod_1.z.string().optional(),
    shiftStart: zod_1.z.string().optional(),
    shiftEnd: zod_1.z.string().optional(),
    // NOTE: This may be calendar date; business date can be derived from shiftEnd
    reportDate: zod_1.z.string().optional(),
});
// -------------------- BALANCES --------------------
// Balances section
exports.BalancesSchema = zod_1.z.object({
    beginningBalance: zod_1.z.number().optional(),
    endingBalance: zod_1.z.number().optional(),
    closingAccountability: zod_1.z.number().optional(),
    cashierCounted: zod_1.z.number().optional(),
    cashVariance: zod_1.z.number().optional(), // positive = over, negative = short
    confidence: ConfidenceLevel,
});
// -------------------- SALES SUMMARY --------------------
// Sales summary section
exports.SalesSummarySchema = zod_1.z.object({
    grossSales: zod_1.z.number().optional(),
    netSales: zod_1.z.number().optional(),
    refunds: zod_1.z.number().optional(),
    discounts: zod_1.z.number().optional(),
    taxTotal: zod_1.z.number().optional(),
    // Many receipts call this "Transactions" or "Customers"
    totalTransactions: zod_1.z.number().int().optional(),
    customersCount: zod_1.z.number().int().optional(), // NEW
    confidence: ConfidenceLevel,
});
// -------------------- FUEL --------------------
// Fuel section
exports.FuelSchema = zod_1.z.object({
    fuelSales: zod_1.z.number().optional(),
    fuelGross: zod_1.z.number().optional(),
    fuelGallons: zod_1.z.number().optional(),
    confidence: ConfidenceLevel,
});
// -------------------- INSIDE / MERCH --------------------
// Inside/Merchandise section
exports.InsideSalesSchema = zod_1.z.object({
    insideSales: zod_1.z.number().optional(),
    merchandiseSales: zod_1.z.number().optional(),
    prepaysInitiated: zod_1.z.number().optional(),
    prepaysPumped: zod_1.z.number().optional(),
    confidence: ConfidenceLevel,
});
// -------------------- TENDERS --------------------
// Tender (single type)
exports.TenderSchema = zod_1.z.object({
    type: zod_1.z.string(),
    count: zod_1.z.number().int().optional(),
    amount: zod_1.z.number().optional(),
});
// Tenders section
exports.TendersSchema = zod_1.z.object({
    cash: exports.TenderSchema.optional(),
    credit: exports.TenderSchema.optional(),
    debit: exports.TenderSchema.optional(),
    check: exports.TenderSchema.optional(),
    ebt: exports.TenderSchema.optional(),
    other: exports.TenderSchema.optional(),
    totalTenders: zod_1.z.number().optional(),
    confidence: ConfidenceLevel,
});
// -------------------- SAFE / TILL ACTIVITY --------------------
/**
 * Some POS systems break safe drops into:
 * - CASHIER SAFE DROPS (usually just cash)
 * - SYSTEM SAFE DROPS (cash/credit/debit breakdown)
 */
exports.SafeDropsBreakdownSchema = zod_1.z.object({
    cashier: zod_1.z
        .object({
        cashAmount: zod_1.z.number().optional(),
        totalAmount: zod_1.z.number().optional(),
    })
        .optional(),
    system: zod_1.z
        .object({
        cashAmount: zod_1.z.number().optional(),
        creditAmount: zod_1.z.number().optional(),
        debitAmount: zod_1.z.number().optional(),
        totalAmount: zod_1.z.number().optional(),
    })
        .optional(),
});
// Safe activity section
exports.SafeActivitySchema = zod_1.z.object({
    safeDropCount: zod_1.z.number().int().optional(),
    safeDropAmount: zod_1.z.number().optional(),
    safeLoanCount: zod_1.z.number().int().optional(),
    safeLoanAmount: zod_1.z.number().optional(),
    paidInCount: zod_1.z.number().int().optional(),
    paidInAmount: zod_1.z.number().optional(),
    paidOutCount: zod_1.z.number().int().optional(),
    paidOutAmount: zod_1.z.number().optional(),
    // NEW: safe drop breakdown
    safeDropsBreakdown: exports.SafeDropsBreakdownSchema.optional(),
    // NEW: till payments in/out (shown on many receipts)
    paymentsIntoTillAmount: zod_1.z.number().optional(),
    paymentsOutOfTillAmount: zod_1.z.number().optional(),
    confidence: ConfidenceLevel,
});
// -------------------- FULL EXTRACTION --------------------
// Full extraction result
exports.ShiftReportExtractSchema = zod_1.z.object({
    // Raw OCR text
    rawText: zod_1.z.string(),
    // Sections
    storeMetadata: exports.StoreMetadataSchema.optional(),
    balances: exports.BalancesSchema.optional(),
    salesSummary: exports.SalesSummarySchema.optional(),
    fuel: exports.FuelSchema.optional(),
    insideSales: exports.InsideSalesSchema.optional(),
    tenders: exports.TendersSchema.optional(),
    safeActivity: exports.SafeActivitySchema.optional(),
    // Arrays
    departmentSales: zod_1.z.array(exports.DepartmentSaleSchema).default([]),
    itemSales: zod_1.z.array(exports.ItemSaleSchema).default([]),
    exceptions: zod_1.z.array(exports.ExceptionSchema).default([]),
    // Extraction metadata
    extractionMethod: zod_1.z.enum(['ocr', 'openai_text', 'openai_vision']),
    extractionConfidence: zod_1.z.number().min(0).max(1),
});
