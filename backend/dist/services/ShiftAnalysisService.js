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
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: this.UNIVERSAL_EXTRACTION_PROMPT
                    },
                    {
                        role: "user",
                        content: `Extract all data from this receipt:\n\n${ocrText}`
                    }
                ],
                temperature: 0,
                response_format: { type: "json_object" },
                max_tokens: 4000,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error('No response from OpenAI');
            const rawExtraction = JSON.parse(content);
            // Map to your schema (for database compatibility)
            const extract = this.mapToSchema(rawExtraction, ocrText);
            return {
                extract,
                method: 'openai_text',
                ocrScore: 85, // Estimated since OCR was good enough to use
                rawExtraction // Store EVERYTHING for chat queries
            };
        });
    }
    /**
     * Universal vision-based extraction
     */
    static analyzeWithVision(imageBuffer, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API Key not configured');
            }
            const base64 = imageBuffer.toString('base64');
            const response = yield this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: this.UNIVERSAL_EXTRACTION_PROMPT
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64}`,
                                    detail: "high"
                                }
                            }
                        ]
                    }
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
            const extract = this.mapToSchema(rawExtraction, rawExtraction.rawText || '');
            return {
                extract,
                method: 'openai_vision',
                ocrScore: 0, // Vision doesn't use OCR
                rawExtraction // Store EVERYTHING
            };
        });
    }
    /**
     * Map AI's free-form extraction to your database schema
     * This maintains backward compatibility with your existing DB
     */
    static mapToSchema(raw, rawText) {
        var _a, _b, _c, _d, _e, _f, _g;
        const extract = {
            rawText: rawText || raw.rawText || '',
            extractionMethod: 'openai_vision',
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
                cashVariance: raw.cashManagement.cashVariance || raw.cashManagement.overShort,
                confidence: raw.cashManagement.confidence || 0.7,
            };
        }
        // Sales summary
        if (raw.financialSummary) {
            extract.salesSummary = {
                grossSales: raw.financialSummary.grossSales || raw.financialSummary.totalSales,
                netSales: raw.financialSummary.netSales,
                refunds: raw.financialSummary.refunds,
                discounts: raw.financialSummary.discounts,
                taxTotal: raw.financialSummary.tax,
                totalTransactions: raw.financialSummary.totalTransactions || raw.financialSummary.totalCustomers,
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
                insideSales: raw.insideStoreData.insideSales || raw.insideStoreData.merchandiseSales,
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
                switch (method.type.toLowerCase()) {
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
        }
        // Safe activity
        if (raw.safeActivity) {
            extract.safeActivity = {
                safeDropCount: ((_b = raw.safeActivity.drops) === null || _b === void 0 ? void 0 : _b.length) || null,
                safeDropAmount: raw.safeActivity.totalDrops,
                safeLoanCount: ((_c = raw.safeActivity.loans) === null || _c === void 0 ? void 0 : _c.length) || null,
                safeLoanAmount: raw.safeActivity.totalLoans,
                paidInCount: (_d = raw.safeActivity.paidIn) === null || _d === void 0 ? void 0 : _d.count,
                paidInAmount: (_e = raw.safeActivity.paidIn) === null || _e === void 0 ? void 0 : _e.amount,
                paidOutCount: (_f = raw.safeActivity.paidOut) === null || _f === void 0 ? void 0 : _f.count,
                paidOutAmount: (_g = raw.safeActivity.paidOut) === null || _g === void 0 ? void 0 : _g.amount,
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
    // Examples: lottery sales, car wash, promotions, coupons, etc.
    // Use descriptive field names based on what you see
  },
  
  "rawSections": {
    // Store sections you found but couldn't categorize
    // Format: { "sectionName": "raw text content" }
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
