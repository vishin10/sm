"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftAnalysisService = void 0;
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../utils/logger");
const shiftReportExtract_types_1 = require("../types/shiftReportExtract.types");
// Helper: Convert null to undefined for Zod
function nullToUndefined(obj) {
    if (obj === null)
        return undefined;
    if (typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj))
        return obj.map(nullToUndefined);
    const result = {};
    for (const key in obj) {
        result[key] = nullToUndefined(obj[key]);
    }
    return result;
}
/**
 * Universal AI-powered shift report analyzer
 * No hardcoded patterns - AI extracts everything automatically
 */
class ShiftAnalysisService {
    /**
     * Main extraction - AI handles everything
     */
    static analyzeShiftReport(fileBuffer_1) {
        return __awaiter(this, arguments, void 0, function* (fileBuffer, mimeType = 'image/jpeg') {
            // Skip OCR - go straight to Vision (like ChatGPT)
            logger_1.Logger.info('Using OpenAI Vision for universal extraction...');
            return yield this.analyzeWithVision(fileBuffer, mimeType);
        });
    }
    /**
     * Universal text-based extraction
     */
    static analyzeWithText(ocrText) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API Key not configured');
            }
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: this.UNIVERSAL_EXTRACTION_PROMPT },
                    { role: 'user', content: `Extract all data from this receipt:\n\n${ocrText}` },
                ],
                temperature: 0,
                response_format: { type: 'json_object' },
                max_tokens: 4000,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error('No response from OpenAI');
            const rawExtraction = JSON.parse(content);
            // Map to your schema (for database compatibility)
            const extract = this.mapToSchema(rawExtraction, ocrText, 'openai_text');
            return {
                extract,
                method: 'openai_text',
                ocrScore: 85, // Estimated since OCR was good enough to use
                rawExtraction, // Store EVERYTHING for chat queries
            };
        });
    }
    /**
     * Universal vision-based extraction
     */
    static analyzeWithVision(imageBuffer, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API Key not configured');
            }
            const base64 = imageBuffer.toString('base64');
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: this.UNIVERSAL_EXTRACTION_PROMPT },
                            {
                                type: 'image_url',
                                image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
                            },
                        ],
                    },
                ],
                max_tokens: 4000,
                temperature: 0,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error('No response from OpenAI');
            // Clean markdown if present
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            }
            else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            const rawExtraction = JSON.parse(jsonStr);
            // Map to your schema
            const extract = this.mapToSchema(rawExtraction, rawExtraction.rawText || '', 'openai_vision');
            // Quick debug log (optional but very helpful)
            logger_1.Logger.info(`Mapped extract summary: date=${(_a = extract.storeMetadata) === null || _a === void 0 ? void 0 : _a.reportDate} start=${(_b = extract.storeMetadata) === null || _b === void 0 ? void 0 : _b.shiftStart} end=${(_c = extract.storeMetadata) === null || _c === void 0 ? void 0 : _c.shiftEnd} customers=${(_d = extract.salesSummary) === null || _d === void 0 ? void 0 : _d.customersCount} tx=${(_e = extract.salesSummary) === null || _e === void 0 ? void 0 : _e.totalTransactions}`);
            return {
                extract,
                method: 'openai_vision',
                ocrScore: 0, // Vision doesn't use OCR
                rawExtraction, // Store EVERYTHING
            };
        });
    }
    /**
     * Map AI's free-form extraction to your database schema
     * This maintains backward compatibility with your existing DB
     */
    static mapToSchema(raw, rawText, extractionMethod) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21;
        const extract = {
            rawText: rawText || raw.rawText || '',
            extractionMethod: extractionMethod === 'openai_text' ? 'openai_text' : 'openai_vision',
            extractionConfidence: ((_a = raw.extractionMetadata) === null || _a === void 0 ? void 0 : _a.confidence) || 0.8,
        };
        // Store metadata
        if (raw.storeInfo) {
            extract.storeMetadata = {
                storeName: raw.storeInfo.name,
                storeAddress: raw.storeInfo.address,
                registerId: raw.storeInfo.registerId,
                operatorId: raw.storeInfo.operatorId,
                tillId: raw.storeInfo.tillId,
                reportDate: raw.storeInfo.reportDate,
                shiftStart: raw.storeInfo.shiftStart,
                shiftEnd: raw.storeInfo.shiftEnd,
                reportPrintedAt: raw.storeInfo.reportPrintedAt,
            };
        }
        // Balances
        if (raw.cashManagement) {
            extract.balances = {
                beginningBalance: raw.cashManagement.beginningBalance,
                endingBalance: raw.cashManagement.endingBalance,
                closingAccountability: raw.cashManagement.expectedCash,
                cashierCounted: raw.cashManagement.actualCash,
                cashVariance: (_b = raw.cashManagement.cashVariance) !== null && _b !== void 0 ? _b : raw.cashManagement.overShort,
                confidence: raw.cashManagement.confidence || 0.7,
            };
        }
        // Sales summary (IMPORTANT: do NOT mix customers into transactions)
        if (raw.financialSummary) {
            // NOTE: customersCount is expected to exist in your schema now
            extract.salesSummary = {
                grossSales: (_c = raw.financialSummary.grossSales) !== null && _c !== void 0 ? _c : raw.financialSummary.totalSales,
                netSales: raw.financialSummary.netSales,
                refunds: raw.financialSummary.refunds,
                discounts: raw.financialSummary.discounts,
                taxTotal: raw.financialSummary.tax,
                totalTransactions: raw.financialSummary.totalTransactions,
                // NEW: store customers separately
                customersCount: (_d = raw.financialSummary.totalCustomers) !== null && _d !== void 0 ? _d : raw.financialSummary.customersCount,
                confidence: raw.financialSummary.confidence || 0.8,
            };
        }
        // Fuel
        if (raw.fuelData) {
            extract.fuel = {
                fuelSales: raw.fuelData.fuelSales,
                fuelGross: raw.fuelData.fuelGross,
                fuelGallons: raw.fuelData.fuelGallons,
                confidence: raw.fuelData.confidence || 0.7,
            };
        }
        // Inside sales
        if (raw.insideStoreData) {
            extract.insideSales = {
                insideSales: (_e = raw.insideStoreData.insideSales) !== null && _e !== void 0 ? _e : raw.insideStoreData.merchandiseSales,
                merchandiseSales: raw.insideStoreData.merchandiseSales,
                prepaysInitiated: raw.insideStoreData.prepayInitiated,
                prepaysPumped: raw.insideStoreData.prepayPumped,
                confidence: raw.insideStoreData.confidence || 0.6,
            };
        }
        // Tenders
        if (raw.paymentMethods && Array.isArray(raw.paymentMethods)) {
            extract.tenders = { confidence: 0.8 };
            for (const method of raw.paymentMethods) {
                const tender = {
                    type: method.type,
                    count: method.count,
                    amount: method.amount,
                };
                switch ((method.type || '').toLowerCase()) {
                    case 'cash':
                        extract.tenders.cash = tender;
                        break;
                    case 'credit':
                        extract.tenders.credit = tender;
                        break;
                    case 'debit':
                        extract.tenders.debit = tender;
                        break;
                    case 'check':
                        extract.tenders.check = tender;
                        break;
                    case 'ebt':
                        extract.tenders.ebt = tender;
                        break;
                    default:
                        extract.tenders.other = tender;
                }
            }
            // totalTenders if present anywhere
            const totalT = (_j = (_g = (_f = raw.financialSummary) === null || _f === void 0 ? void 0 : _f.totalTenders) !== null && _g !== void 0 ? _g : (_h = raw.cashManagement) === null || _h === void 0 ? void 0 : _h.totalTenders) !== null && _j !== void 0 ? _j : (_k = raw.additionalData) === null || _k === void 0 ? void 0 : _k.totalTenders;
            if (typeof totalT === 'number') {
                extract.tenders.totalTenders = totalT;
            }
        }
        // Safe activity (includes breakdown + payments in/out)
        if (raw.safeActivity) {
            const cashierDropCash = (_o = (_m = (_l = raw.safeActivity) === null || _l === void 0 ? void 0 : _l.cashierSafeDrops) === null || _m === void 0 ? void 0 : _m.cash) !== null && _o !== void 0 ? _o : (_q = (_p = raw.safeActivity) === null || _p === void 0 ? void 0 : _p.cashierSafeDrops) === null || _q === void 0 ? void 0 : _q.cashAmount;
            const cashierDropTotal = (_t = (_s = (_r = raw.safeActivity) === null || _r === void 0 ? void 0 : _r.cashierSafeDrops) === null || _s === void 0 ? void 0 : _s.total) !== null && _t !== void 0 ? _t : (_v = (_u = raw.safeActivity) === null || _u === void 0 ? void 0 : _u.cashierSafeDrops) === null || _v === void 0 ? void 0 : _v.totalAmount;
            const systemDropCash = (_y = (_x = (_w = raw.safeActivity) === null || _w === void 0 ? void 0 : _w.systemSafeDrops) === null || _x === void 0 ? void 0 : _x.cash) !== null && _y !== void 0 ? _y : (_0 = (_z = raw.safeActivity) === null || _z === void 0 ? void 0 : _z.systemSafeDrops) === null || _0 === void 0 ? void 0 : _0.cashAmount;
            const systemDropCredit = (_3 = (_2 = (_1 = raw.safeActivity) === null || _1 === void 0 ? void 0 : _1.systemSafeDrops) === null || _2 === void 0 ? void 0 : _2.credit) !== null && _3 !== void 0 ? _3 : (_5 = (_4 = raw.safeActivity) === null || _4 === void 0 ? void 0 : _4.systemSafeDrops) === null || _5 === void 0 ? void 0 : _5.creditAmount;
            const systemDropDebit = (_8 = (_7 = (_6 = raw.safeActivity) === null || _6 === void 0 ? void 0 : _6.systemSafeDrops) === null || _7 === void 0 ? void 0 : _7.debit) !== null && _8 !== void 0 ? _8 : (_10 = (_9 = raw.safeActivity) === null || _9 === void 0 ? void 0 : _9.systemSafeDrops) === null || _10 === void 0 ? void 0 : _10.debitAmount;
            const systemDropTotal = (_13 = (_12 = (_11 = raw.safeActivity) === null || _11 === void 0 ? void 0 : _11.systemSafeDrops) === null || _12 === void 0 ? void 0 : _12.total) !== null && _13 !== void 0 ? _13 : (_15 = (_14 = raw.safeActivity) === null || _14 === void 0 ? void 0 : _14.systemSafeDrops) === null || _15 === void 0 ? void 0 : _15.totalAmount;
            // NOTE: safeDropsBreakdown + paymentsIntoTillAmount/out are expected in your schema now
            extract.safeActivity = {
                safeDropCount: Array.isArray(raw.safeActivity.drops) ? raw.safeActivity.drops.length : undefined,
                safeDropAmount: raw.safeActivity.totalDrops,
                safeLoanCount: Array.isArray(raw.safeActivity.loans) ? raw.safeActivity.loans.length : undefined,
                safeLoanAmount: raw.safeActivity.totalLoans,
                paidInCount: (_16 = raw.safeActivity.paidIn) === null || _16 === void 0 ? void 0 : _16.count,
                paidInAmount: (_17 = raw.safeActivity.paidIn) === null || _17 === void 0 ? void 0 : _17.amount,
                paidOutCount: (_18 = raw.safeActivity.paidOut) === null || _18 === void 0 ? void 0 : _18.count,
                paidOutAmount: (_19 = raw.safeActivity.paidOut) === null || _19 === void 0 ? void 0 : _19.amount,
                // NEW: breakdown (cashier vs system)
                safeDropsBreakdown: {
                    cashier: {
                        cashAmount: cashierDropCash,
                        totalAmount: cashierDropTotal,
                    },
                    system: {
                        cashAmount: systemDropCash,
                        creditAmount: systemDropCredit,
                        debitAmount: systemDropDebit,
                        totalAmount: systemDropTotal,
                    },
                },
                // NEW: payments in/out
                paymentsIntoTillAmount: (_20 = raw.safeActivity.paymentsIntoTillAmount) !== null && _20 !== void 0 ? _20 : raw.safeActivity.paymentsIntoTill,
                paymentsOutOfTillAmount: (_21 = raw.safeActivity.paymentsOutOfTillAmount) !== null && _21 !== void 0 ? _21 : raw.safeActivity.paymentsOutOfTill,
                confidence: raw.safeActivity.confidence || 0.7,
            };
        }
        // Department sales
        extract.departmentSales = (raw.departmentBreakdown || []).map((dept) => ({
            departmentName: dept.departmentName,
            quantity: dept.quantity,
            amount: dept.amount,
            confidence: dept.confidence || 0.8,
        }));
        // Item sales
        extract.itemSales = (raw.itemizedSales || []).map((item) => ({
            itemName: item.itemName,
            sku: item.sku,
            quantity: item.quantity,
            amount: item.amount,
            confidence: item.confidence || 0.7,
        }));
        // Exceptions
        extract.exceptions = (raw.exceptions || []).map((exc) => ({
            type: exc.type,
            count: exc.count,
            amount: exc.amount,
        }));
        return shiftReportExtract_types_1.ShiftReportExtractSchema.parse(nullToUndefined(extract));
    }
}
exports.ShiftAnalysisService = ShiftAnalysisService;
ShiftAnalysisService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * Universal extraction prompt - AI finds EVERYTHING
 */
ShiftAnalysisService.UNIVERSAL_EXTRACTION_PROMPT = `You are analyzing a gas station/convenience store shift report receipt.

Your job: Extract EVERY piece of data visible in this receipt into structured JSON.

CRITICAL RULES:
1. Extract EVERYTHING you can see - don't skip anything
2. If a section exists but you don't have a field for it, create a new field
3. Create arrays for repeating data (departments, items, tenders, etc.)
4. Use descriptive field names based on what you see (e.g., "cigarette_packs", "candy_sales")
5. Include confidence scores for each section (0-1)
6. All monetary values must be numbers, not strings

REQUIRED STRUCTURE (but add more fields as needed):
{
  "storeInfo": {
    "name": "string or null",
    "address": "string or null",
    "phone": "string or null",
    "registerId": "string or null",
    "operatorId": "string or null",
    "tillId": "string or null",
    "reportDate": "YYYY-MM-DD or null",
    "shiftStart": "ISO datetime or null",
    "shiftEnd": "ISO datetime or null",
    "reportPrintedAt": "ISO datetime or null"
  },
  
  "financialSummary": {
    "totalSales": number or null,
    "grossSales": number or null,
    "netSales": number or null,
    "tax": number or null,
    "refunds": number or null,
    "discounts": number or null,
    "totalTransactions": number or null,
    "totalCustomers": number or null,
    "confidence": 0-1
  },
  
  "cashManagement": {
    "beginningBalance": number or null,
    "endingBalance": number or null,
    "expectedCash": number or null,
    "actualCash": number or null,
    "cashVariance": number or null,
    "overShort": number or null,
    "confidence": 0-1
  },
  
  "fuelData": {
    "fuelSales": number or null,
    "fuelGross": number or null,
    "fuelGallons": number or null,
    "fuelCustomers": number or null,
    "fuelTransactions": number or null,
    "confidence": 0-1
  },
  
  "insideStoreData": {
    "insideSales": number or null,
    "merchandiseSales": number or null,
    "prepayInitiated": number or null,
    "prepayPumped": number or null,
    "prepayNotPumped": number or null,
    "confidence": 0-1
  },
  
  "paymentMethods": [
    {
      "type": "cash|credit|debit|check|ebt|other",
      "name": "exact name from receipt",
      "count": number or null,
      "amount": number,
      "confidence": 0-1
    }
  ],
  
  "safeActivity": {
    "drops": [
      { "type": "string", "count": number or null, "amount": number, "description": "string" }
    ],
    "loans": [
      { "type": "string", "count": number or null, "amount": number, "description": "string" }
    ],
    "paidIn": { "count": number or null, "amount": number or null },
    "paidOut": { "count": number or null, "amount": number or null },
    "totalDrops": number or null,
    "totalLoans": number or null,

    "cashierSafeDrops": { "cash": number or null, "total": number or null },
    "systemSafeDrops": { "cash": number or null, "credit": number or null, "debit": number or null, "total": number or null },

    "paymentsIntoTill": number or null,
    "paymentsOutOfTill": number or null,

    "confidence": 0-1
  },
  
  "departmentBreakdown": [
    {
      "departmentName": "exact name from receipt",
      "quantity": number or null,
      "amount": number,
      "percentage": number or null,
      "confidence": 0-1
    }
  ],
  
  "itemizedSales": [
    {
      "itemName": "exact name from receipt",
      "sku": "string or null",
      "quantity": number or null,
      "unitPrice": number or null,
      "amount": number,
      "department": "string or null",
      "confidence": 0-1
    }
  ],
  
  "exceptions": [
    {
      "type": "void|no_sale|refund|discount|drive_off|other",
      "description": "exact text from receipt",
      "count": number or null,
      "amount": number or null
    }
  ],
  
  "additionalData": {
    // PUT ANY OTHER DATA YOU FIND HERE
  },
  
  "rawSections": {
    // Store sections you found but couldn't categorize
  },
  
  "extractionMetadata": {
    "confidence": 0-1,
    "missingFields": ["list of expected fields not found"],
    "unusualFields": ["list of fields found that aren't standard"],
    "notes": "any observations about the receipt format"
  }
}

IMPORTANT: 
- If you see data that doesn't fit the schema above, ADD IT to "additionalData" with descriptive names
- Extract EVERY line item in department sales, even if there are 50+ items
- Extract EVERY payment method shown
- Don't skip sections because they seem "extra" - capture everything
- Use exact names from the receipt (don't normalize "Cigarettes - Packs" to just "Cigarettes")

Respond ONLY with valid JSON matching this structure.`;
