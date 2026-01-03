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
const OCRService_1 = require("./OCRService");
const QualityScorer_1 = require("./QualityScorer");
const ShiftReportParser_1 = require("./ShiftReportParser");
class ShiftAnalysisService {
    /**
     * Main extraction pipeline
     * 1. OCR -> 2. Deterministic parse -> 3. Quality check -> 4. AI fallback if needed
     */
    static analyzeShiftReport(fileBuffer_1) {
        return __awaiter(this, arguments, void 0, function* (fileBuffer, mimeType = 'image/jpeg') {
            var _a;
            const isPDF = mimeType === 'application/pdf';
            // Step 1: OCR
            logger_1.Logger.info('Step 1: Running OCR extraction...');
            let ocrText = '';
            try {
                if (isPDF) {
                    ocrText = yield OCRService_1.OCRService.extractTextFromPDF(fileBuffer);
                }
                else {
                    ocrText = yield OCRService_1.OCRService.extractTextFromImage(fileBuffer);
                }
            }
            catch (error) {
                logger_1.Logger.error('OCR failed', error);
            }
            // Step 2: Quality scoring
            logger_1.Logger.info('Step 2: Scoring OCR quality...');
            const scoreResult = QualityScorer_1.QualityScorer.scoreOCROutput(ocrText);
            // Step 3: Deterministic parsing
            logger_1.Logger.info('Step 3: Parsing with deterministic parser...');
            let extract = ShiftReportParser_1.ShiftReportParser.parse(ocrText);
            // Step 4: Decide fallback
            logger_1.Logger.info(`OCR Score: ${scoreResult.score}, Recommendation: ${scoreResult.recommendation}`);
            if (scoreResult.recommendation === 'accept_ocr' && ((_a = extract.extractionConfidence) !== null && _a !== void 0 ? _a : 0) >= 0.5) {
                // OCR is good enough
                logger_1.Logger.info('Using OCR result (sufficient quality)');
                const validated = shiftReportExtract_types_1.ShiftReportExtractSchema.parse(Object.assign(Object.assign({}, extract), { rawText: ocrText, extractionMethod: 'ocr' }));
                return { extract: validated, method: 'ocr', ocrScore: scoreResult.score };
            }
            if (scoreResult.recommendation === 'use_openai_text' && ocrText.length > 100) {
                // Use OpenAI to normalize OCR text
                logger_1.Logger.info('Using OpenAI text normalization...');
                try {
                    const aiExtract = yield this.analyzeWithOpenAIText(ocrText);
                    return { extract: aiExtract, method: 'openai_text', ocrScore: scoreResult.score };
                }
                catch (error) {
                    logger_1.Logger.error('OpenAI text failed, falling back to vision', error);
                }
            }
            // Fall back to vision
            logger_1.Logger.info('Using OpenAI Vision...');
            const visionExtract = yield this.analyzeWithOpenAIVision(fileBuffer, mimeType);
            return { extract: visionExtract, method: 'openai_vision', ocrScore: scoreResult.score };
        });
    }
    /**
     * Use OpenAI to normalize OCR text into full schema
     */
    static analyzeWithOpenAIText(ocrText) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API Key not configured');
            }
            const response = yield this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: this.FULL_EXTRACTION_PROMPT },
                    { role: "user", content: `OCR TEXT:\n${ocrText}` }
                ],
                temperature: 0,
                response_format: { type: "json_object" },
                max_tokens: 4000,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error('No response from OpenAI');
            const parsed = JSON.parse(content);
            parsed.rawText = ocrText;
            parsed.extractionMethod = 'openai_text';
            return shiftReportExtract_types_1.ShiftReportExtractSchema.parse(parsed);
        });
    }
    /**
     * Use OpenAI Vision for full extraction
     */
    static analyzeWithOpenAIVision(imageBuffer, mimeType) {
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
                            { type: "text", text: this.VISION_PROMPT },
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
            // Clean markdown code blocks
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            }
            else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            const parsed = JSON.parse(jsonStr);
            parsed.extractionMethod = 'openai_vision';
            return shiftReportExtract_types_1.ShiftReportExtractSchema.parse(parsed);
        });
    }
}
exports.ShiftAnalysisService = ShiftAnalysisService;
ShiftAnalysisService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
ShiftAnalysisService.FULL_EXTRACTION_PROMPT = `You are a gas station/convenience store shift report analyzer.
Extract ALL visible data from this shift report into structured JSON.

EXTRACTION RULES:
1. Extract EVERY section and field visible in the report
2. Use null for fields you cannot find
3. All monetary values must be numbers (not strings)
4. Capture department sales as an array
5. Capture any exceptions (voids, no-sales, drive-offs)
6. Include confidence 0-1 for each major section

JSON SCHEMA:
{
  "rawText": "the OCR text you were given",
  "storeMetadata": {
    "storeName": "string or null",
    "storeAddress": "string or null", 
    "registerId": "string or null",
    "operatorId": "string or null",
    "tillId": "string or null",
    "reportPrintedAt": "ISO date string or null",
    "shiftStart": "ISO date string or null",
    "shiftEnd": "ISO date string or null",
    "reportDate": "YYYY-MM-DD or null"
  },
  "balances": {
    "beginningBalance": number or null,
    "endingBalance": number or null,
    "closingAccountability": number or null,
    "cashierCounted": number or null,
    "cashVariance": number or null,
    "confidence": 0-1
  },
  "salesSummary": {
    "grossSales": number or null,
    "netSales": number or null,
    "refunds": number or null,
    "discounts": number or null,
    "taxTotal": number or null,
    "totalTransactions": integer or null,
    "confidence": 0-1
  },
  "fuel": {
    "fuelSales": number or null,
    "fuelGross": number or null,
    "fuelGallons": number or null,
    "confidence": 0-1
  },
  "insideSales": {
    "insideSales": number or null,
    "merchandiseSales": number or null,
    "prepaysInitiated": number or null,
    "prepaysPumped": number or null,
    "confidence": 0-1
  },
  "tenders": {
    "cash": { "type": "cash", "count": int or null, "amount": number or null },
    "credit": { "type": "credit", "count": int or null, "amount": number or null },
    "debit": { "type": "debit", "count": int or null, "amount": number or null },
    "check": { "type": "check", "count": int or null, "amount": number or null },
    "ebt": { "type": "ebt", "count": int or null, "amount": number or null },
    "other": { "type": "other", "count": int or null, "amount": number or null },
    "totalTenders": number or null,
    "confidence": 0-1
  },
  "safeActivity": {
    "safeDropCount": int or null,
    "safeDropAmount": number or null,
    "safeLoanCount": int or null,
    "safeLoanAmount": number or null,
    "paidInCount": int or null,
    "paidInAmount": number or null,
    "paidOutCount": int or null,
    "paidOutAmount": number or null,
    "confidence": 0-1
  },
  "departmentSales": [
    { "departmentName": "string", "quantity": int or null, "amount": number, "confidence": 0-1 }
  ],
  "itemSales": [
    { "itemName": "string", "sku": "string or null", "quantity": int or null, "amount": number, "confidence": 0-1 }
  ],
  "exceptions": [
    { "type": "void|no_sale|drive_off|etc", "count": int, "amount": number or null }
  ],
  "extractionMethod": "openai_text",
  "extractionConfidence": 0-1
}

Respond ONLY with valid JSON matching this schema.`;
ShiftAnalysisService.VISION_PROMPT = `You are a gas station/convenience store shift report analyzer.
Analyze this shift report image and extract ALL visible data into structured JSON.

${ShiftAnalysisService.FULL_EXTRACTION_PROMPT.split('JSON SCHEMA:')[1]}`;
