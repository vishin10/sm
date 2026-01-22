"use strict";
// ShiftAnalysisService.ts
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
const OCRService_1 = require("./OCRService");
const QualityScorer_1 = require("./QualityScorer");
const EdgeDetectionService_1 = require("./EdgeDetectionService");
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
class ShiftAnalysisService {
    /**
     * Normalize ID (register/operator) from OCR/Raw Text.
     * DISABLED: Safe drop/activity normalization (too redundant for Quick Scan).
     */
    static normalizeSafeActivity(raw, rawText) {
        if (!raw)
            return raw;
        const r = raw;
        if (!r.storeInfo)
            r.storeInfo = {};
        // -----------------------------
        // Register / Operator ID (Regex Override)
        // -----------------------------
        const registerIdMatch = rawText.match(/REGISTER\s*ID\s*[:;]?\s*([0-9]+)/i);
        if (registerIdMatch)
            r.storeInfo.registerId = String(registerIdMatch[1]);
        // No other normalization/inferences allowed.
        return r;
    }
    /**
     * Validate extraction quality to catch hallucinations.
     * Confidence is OPTIONAL (do not fail if missing).
     */
    static validateExtraction(raw) {
        var _a;
        const errors = [];
        // No strict validation for Quick Scan.
        // If confidence is brutally low, log it, but otherwise allow.
        const overallConfidence = (_a = raw.extractionMetadata) === null || _a === void 0 ? void 0 : _a.confidence;
        if (overallConfidence !== undefined && overallConfidence < 0.4) {
            logger_1.Logger.warn(`Low extraction confidence: ${overallConfidence}`);
        }
        return { valid: true, errors: [] };
    }
    static analyzeShiftReport(fileBuffer_1) {
        return __awaiter(this, arguments, void 0, function* (fileBuffer, mimeType = 'image/jpeg') {
            // 1. Vision-first for images
            if (mimeType.startsWith('image/')) {
                logger_1.Logger.info('Image detected. Using Vision-first approach (bypassing OCR check).', { mimeType });
                return yield this.analyzeWithVision(fileBuffer, mimeType);
            }
            // 2. Fallback for non-images (e.g. PDF)
            logger_1.Logger.info('Non-image detected, attempting OCR extraction...');
            const ocrText = yield OCRService_1.OCRService.extractTextFromImage(fileBuffer);
            const qualityResult = QualityScorer_1.QualityScorer.scoreOCROutput(ocrText);
            logger_1.Logger.info(`OCR quality score: ${qualityResult.score}/100`);
            return yield this.analyzeWithText(ocrText, qualityResult.score);
        });
    }
    static analyzeWithText(ocrText, ocrScore) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.OPENAI_API_KEY)
                throw new Error('OpenAI API Key not configured');
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: this.UNIVERSAL_EXTRACTION_PROMPT },
                    { role: 'user', content: `Extract all data from this receipt into strict JSON format:\n\n${ocrText}` },
                ],
                temperature: 0,
                response_format: { type: 'json_object' },
                max_tokens: 4000,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error('No response from OpenAI');
            let rawExtraction = JSON.parse(content);
            // Backfill extractionMetadata.confidence if missing (so downstream code is stable)
            if (!rawExtraction.extractionMetadata)
                rawExtraction.extractionMetadata = {};
            if (rawExtraction.extractionMetadata.confidence == null)
                rawExtraction.extractionMetadata.confidence = 0.8;
            rawExtraction = this.normalizeSafeActivity(rawExtraction, ocrText);
            const validation = this.validateExtraction(rawExtraction);
            if (!validation.valid) {
                logger_1.Logger.error('AI extraction failed validation', { errors: validation.errors });
                throw new Error(`Extraction quality too low: ${validation.errors.join(', ')}`);
            }
            const extract = this.mapToSchema(rawExtraction, ocrText, 'openai_text');
            return { extract, method: 'openai_text', ocrScore, rawExtraction };
        });
    }
    static analyzeWithVision(imageBuffer, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.OPENAI_API_KEY)
                throw new Error('OpenAI API Key not configured');
            // Preprocess image uses sharp (Crop -> Resize -> Enhance)
            const processedBuffer = yield EdgeDetectionService_1.EdgeDetectionService.preprocessReceiptForVision(imageBuffer, mimeType);
            const base64 = processedBuffer.toString('base64');
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: this.UNIVERSAL_EXTRACTION_PROMPT },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
                        ],
                    },
                ],
                max_tokens: 4000,
                temperature: 0,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error('No response from OpenAI');
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```json'))
                jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            else if (jsonStr.startsWith('```'))
                jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
            let rawExtraction = JSON.parse(jsonStr);
            // Backfill extractionMetadata.confidence if missing
            if (!rawExtraction.extractionMetadata)
                rawExtraction.extractionMetadata = {};
            if (rawExtraction.extractionMetadata.confidence == null)
                rawExtraction.extractionMetadata.confidence = 0.8;
            // Use the AI-extracted rawText if available, otherwise we have no text for regex
            const textForRegex = rawExtraction.rawText || '';
            rawExtraction = this.normalizeSafeActivity(rawExtraction, textForRegex);
            const validation = this.validateExtraction(rawExtraction);
            if (!validation.valid) {
                // Warn but don't fail unless critical
                logger_1.Logger.warn('AI extraction validation warnings', { errors: validation.errors });
            }
            const extract = this.mapToSchema(rawExtraction, textForRegex, 'openai_vision');
            return { extract, method: 'openai_vision', ocrScore: 0, rawExtraction };
        });
    }
    /**
     * Map AI's free-form extraction to your database schema
     * QUICK SCAN MODE: High confidence fields only. No math.
     */
    static mapToSchema(raw, rawText, extractionMethod) {
        var _a, _b;
        const extract = {
            rawText: rawText || raw.rawText || '',
            extractionMethod: extractionMethod,
            extractionConfidence: (_b = (_a = raw.extractionMetadata) === null || _a === void 0 ? void 0 : _a.confidence) !== null && _b !== void 0 ? _b : 0.7,
        };
        // Store metadata
        if (raw.storeInfo) {
            extract.storeMetadata = {
                registerId: raw.storeInfo.registerId,
                reportDate: raw.storeInfo.reportDate,
                shiftStart: raw.storeInfo.shiftStart,
                shiftEnd: raw.storeInfo.shiftEnd,
            };
        }
        // Balances
        if (raw.cashManagement) {
            extract.balances = {
                cashierCounted: raw.cashManagement.cashierCountedCash,
                cashVariance: raw.cashManagement.cashierShortAmount,
                confidence: raw.cashManagement.confidence || 0.7,
            };
        }
        // Sales summary
        if (raw.financialSummary) {
            extract.salesSummary = {
                grossSales: raw.financialSummary.totalSales,
                taxTotal: raw.financialSummary.tax,
                confidence: raw.financialSummary.confidence || 0.8,
            };
        }
        // Fuel
        if (raw.fuelData) {
            extract.fuel = {
                fuelSales: raw.fuelData.fuelSales,
                confidence: raw.fuelData.confidence || 0.7,
            };
        }
        // EVERYTHING ELSE IS NULL
        // No tenders, no safe activity, no department breakdowns.
        return shiftReportExtract_types_1.ShiftReportExtractSchema.parse(nullToUndefined(extract));
    }
}
exports.ShiftAnalysisService = ShiftAnalysisService;
ShiftAnalysisService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
ShiftAnalysisService.UNIVERSAL_EXTRACTION_PROMPT = `
You are an expert OCR system for gas station shift reports.
Your job is to extract *ONLY* the following explicit high-confidence fields.
Do NOT calculate totals. Do NOT infer missing values.
If a field is not cleanly printed on the receipt, return null.

### EXTRACTION TARGETS:
1. **Store Info**: Register ID (from header/footer)
2. **Dates**: Report Date, Shift Start/End
3. **Financials**:
   - Total Sales (or Gross Sales)
   - Tax Amount
   - Fuel Sales (if separate line exists)
4. **Cash/Balancing**:
   - Cashier Counted Cash (Input Amount)
   - Over/Short Amount (Cash Variance)

### RULES:
1. **Output Format**: Valid JSON only.
2. **Precision**: Exact numbers as printed.
3. **Nulls**: Use null if not found.
4. **No Math**: Do not sum up tenders or departments.

### JSON SCHEMA:
{
  "rawText": "string",
  "storeInfo": {
    "registerId": "string",
    "reportDate": "YYYY-MM-DD",
    "shiftStart": "ISO string",
    "shiftEnd": "ISO string"
  },
  "financialSummary": {
    "totalSales": number,
    "tax": number,
    "confidence": number
  },
  "fuelData": {
    "fuelSales": number,
    "confidence": number
  },
  "cashManagement": {
    "cashierCountedCash": number,
    "cashierShortAmount": number, // Over/Short or Closing Availability
    "confidence": number
  },
  "extractionMetadata": {
    "confidence": number,
    "notes": "string"
  }
}
`;
