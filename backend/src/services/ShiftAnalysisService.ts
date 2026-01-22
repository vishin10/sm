// ShiftAnalysisService.ts

import OpenAI from 'openai';
import { Logger } from '../utils/logger';
import { ShiftReportExtract, ShiftReportExtractSchema } from '../types/shiftReportExtract.types';
import { OCRService } from './OCRService';
import { QualityScorer } from './QualityScorer';
import { EdgeDetectionService } from './EdgeDetectionService';

// Helper: Convert null to undefined for Zod
function nullToUndefined(obj: any): any {
    if (obj === null) return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(nullToUndefined);

    const result: any = {};
    for (const key in obj) {
        result[key] = nullToUndefined(obj[key]);
    }
    return result;
}

export interface AnalysisResult {
    extract: ShiftReportExtract;
    method: 'openai_vision' | 'openai_text';
    ocrScore: number;
    rawExtraction: any;
}

export class ShiftAnalysisService {
    private static openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    private static readonly UNIVERSAL_EXTRACTION_PROMPT = `
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

    /**
     * Normalize ID (register/operator) from OCR/Raw Text.
     * DISABLED: Safe drop/activity normalization (too redundant for Quick Scan).
     */
    private static normalizeSafeActivity(raw: any, rawText: string) {
        if (!raw) return raw;
        const r = raw;
        if (!r.storeInfo) r.storeInfo = {};

        // -----------------------------
        // Register / Operator ID (Regex Override)
        // -----------------------------
        const registerIdMatch = rawText.match(/REGISTER\s*ID\s*[:;]?\s*([0-9]+)/i);
        if (registerIdMatch) r.storeInfo.registerId = String(registerIdMatch[1]);

        // No other normalization/inferences allowed.
        return r;
    }

    /**
     * Validate extraction quality to catch hallucinations.
     * Confidence is OPTIONAL (do not fail if missing).
     */
    private static validateExtraction(raw: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // No strict validation for Quick Scan.
        // If confidence is brutally low, log it, but otherwise allow.
        const overallConfidence = raw.extractionMetadata?.confidence;
        if (overallConfidence !== undefined && overallConfidence < 0.4) {
            Logger.warn(`Low extraction confidence: ${overallConfidence}`);
        }

        return { valid: true, errors: [] };
    }

    static async analyzeShiftReport(fileBuffer: Buffer, mimeType: string = 'image/jpeg'): Promise<AnalysisResult> {
        // 1. Vision-first for images
        if (mimeType.startsWith('image/')) {
            Logger.info('Image detected. Using Vision-first approach (bypassing OCR check).', { mimeType });
            return await this.analyzeWithVision(fileBuffer, mimeType);
        }

        // 2. Fallback for non-images (e.g. PDF)
        Logger.info('Non-image detected, attempting OCR extraction...');
        const ocrText = await OCRService.extractTextFromImage(fileBuffer);
        const qualityResult = QualityScorer.scoreOCROutput(ocrText);

        Logger.info(`OCR quality score: ${qualityResult.score}/100`);
        return await this.analyzeWithText(ocrText, qualityResult.score);
    }

    private static async analyzeWithText(ocrText: string, ocrScore: number): Promise<AnalysisResult> {
        if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API Key not configured');

        const response = await this.openai.chat.completions.create({
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
        if (!content) throw new Error('No response from OpenAI');

        let rawExtraction = JSON.parse(content);

        // Backfill extractionMetadata.confidence if missing (so downstream code is stable)
        if (!rawExtraction.extractionMetadata) rawExtraction.extractionMetadata = {};
        if (rawExtraction.extractionMetadata.confidence == null) rawExtraction.extractionMetadata.confidence = 0.8;

        rawExtraction = this.normalizeSafeActivity(rawExtraction, ocrText);

        const validation = this.validateExtraction(rawExtraction);
        if (!validation.valid) {
            Logger.error('AI extraction failed validation', { errors: validation.errors });
            throw new Error(`Extraction quality too low: ${validation.errors.join(', ')}`);
        }

        const extract = this.mapToSchema(rawExtraction, ocrText, 'openai_text');

        return { extract, method: 'openai_text', ocrScore, rawExtraction };
    }

    private static async analyzeWithVision(imageBuffer: Buffer, mimeType: string): Promise<AnalysisResult> {
        if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API Key not configured');

        // Preprocess image uses sharp (Crop -> Resize -> Enhance)
        const processedBuffer = await EdgeDetectionService.preprocessReceiptForVision(imageBuffer, mimeType);
        const base64 = processedBuffer.toString('base64');

        const response = await this.openai.chat.completions.create({
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
        if (!content) throw new Error('No response from OpenAI');

        let jsonStr = content.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');

        let rawExtraction = JSON.parse(jsonStr);

        // Backfill extractionMetadata.confidence if missing
        if (!rawExtraction.extractionMetadata) rawExtraction.extractionMetadata = {};
        if (rawExtraction.extractionMetadata.confidence == null) rawExtraction.extractionMetadata.confidence = 0.8;

        // Use the AI-extracted rawText if available, otherwise we have no text for regex
        const textForRegex = rawExtraction.rawText || '';

        rawExtraction = this.normalizeSafeActivity(rawExtraction, textForRegex);

        const validation = this.validateExtraction(rawExtraction);
        if (!validation.valid) {
            // Warn but don't fail unless critical
            Logger.warn('AI extraction validation warnings', { errors: validation.errors });
        }

        const extract = this.mapToSchema(rawExtraction, textForRegex, 'openai_vision');

        return { extract, method: 'openai_vision', ocrScore: 0, rawExtraction };
    }

    /**
     * Map AI's free-form extraction to your database schema
     * QUICK SCAN MODE: High confidence fields only. No math.
     */
    private static mapToSchema(raw: any, rawText: string, extractionMethod: 'openai_vision' | 'openai_text'): ShiftReportExtract {
        const extract: Partial<ShiftReportExtract> = {
            rawText: rawText || raw.rawText || '',
            extractionMethod: extractionMethod,
            extractionConfidence: raw.extractionMetadata?.confidence ?? 0.7,
        };

        // Store metadata
        if (raw.storeInfo) {
            extract.storeMetadata = {
                registerId: raw.storeInfo.registerId,
                reportDate: raw.storeInfo.reportDate,
                shiftStart: raw.storeInfo.shiftStart,
                shiftEnd: raw.storeInfo.shiftEnd,
            } as any;
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
            (extract as any).salesSummary = {
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

        return ShiftReportExtractSchema.parse(nullToUndefined(extract));
    }
}
