import { z } from 'zod';

// Confidence level for each extracted field
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);

// Top selling item
export const TopItemSchema = z.object({
    name: z.string(),
    quantity: z.number().optional(),
    sales: z.number().optional(),
});

// Shift Report Analysis Schema
export const ShiftReportAnalysisSchema = z.object({
    storeName: z.string().optional(),
    date: z.string().optional(),
    shiftTime: z.string().optional(),
    cashier: z.string().optional(),

    totals: z.object({
        grossSales: z.number().optional(),
        netSales: z.number().optional(),
        totalTransactions: z.number().optional(),
    }),

    fuel: z.object({
        totalFuelSales: z.number().optional(),
        fuelGross: z.number().optional(),
        gallons: z.number().optional(),
    }).optional(),

    insideSales: z.object({
        total: z.number().optional(),
        topCategory: z.string().optional(),
        topItem: TopItemSchema.optional(),
    }).optional(),

    tenderBreakdown: z.object({
        cash: z.number().optional(),
        card: z.number().optional(),
        other: z.number().optional(),
    }).optional(),

    cashVariance: z.number().optional(),

    confidence: z.record(z.string(), ConfidenceLevelSchema),
});

export type ShiftReportAnalysis = z.infer<typeof ShiftReportAnalysisSchema>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
