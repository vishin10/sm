"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftReportAnalysisSchema = exports.TopItemSchema = exports.ConfidenceLevelSchema = void 0;
const zod_1 = require("zod");
// Confidence level for each extracted field
exports.ConfidenceLevelSchema = zod_1.z.enum(['high', 'medium', 'low']);
// Top selling item
exports.TopItemSchema = zod_1.z.object({
    name: zod_1.z.string(),
    quantity: zod_1.z.number().optional(),
    sales: zod_1.z.number().optional(),
});
// Shift Report Analysis Schema
exports.ShiftReportAnalysisSchema = zod_1.z.object({
    storeName: zod_1.z.string().optional(),
    date: zod_1.z.string().optional(),
    shiftTime: zod_1.z.string().optional(),
    cashier: zod_1.z.string().optional(),
    totals: zod_1.z.object({
        grossSales: zod_1.z.number().optional(),
        netSales: zod_1.z.number().optional(),
        totalTransactions: zod_1.z.number().optional(),
    }),
    fuel: zod_1.z.object({
        totalFuelSales: zod_1.z.number().optional(),
        fuelGross: zod_1.z.number().optional(),
        gallons: zod_1.z.number().optional(),
    }).optional(),
    insideSales: zod_1.z.object({
        total: zod_1.z.number().optional(),
        topCategory: zod_1.z.string().optional(),
        topItem: exports.TopItemSchema.optional(),
    }).optional(),
    tenderBreakdown: zod_1.z.object({
        cash: zod_1.z.number().optional(),
        card: zod_1.z.number().optional(),
        other: zod_1.z.number().optional(),
    }).optional(),
    cashVariance: zod_1.z.number().optional(),
    confidence: zod_1.z.record(zod_1.z.string(), exports.ConfidenceLevelSchema),
});
