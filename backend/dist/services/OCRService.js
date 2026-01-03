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
exports.OCRService = void 0;
const tesseract_js_1 = __importDefault(require("tesseract.js"));
const logger_1 = require("../utils/logger");
class OCRService {
    /**
     * Extract text from an image buffer using Tesseract OCR
     */
    static extractTextFromImage(imageBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('Starting OCR extraction...');
                const result = yield tesseract_js_1.default.recognize(imageBuffer, 'eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            logger_1.Logger.info(`OCR progress: ${Math.round(m.progress * 100)}%`);
                        }
                    }
                });
                logger_1.Logger.info(`OCR complete. Extracted ${result.data.text.length} characters`);
                return result.data.text;
            }
            catch (error) {
                logger_1.Logger.error('OCR extraction failed', error);
                throw error;
            }
        });
    }
    /**
     * Extract text from a PDF buffer
     * For now, we'll treat PDFs as images - in production you'd use pdf-parse
     */
    static extractTextFromPDF(pdfBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            // For PDF text extraction, you could use pdf-parse library
            // For now, we'll return empty and let it fall back to vision
            logger_1.Logger.info('PDF text extraction - falling back to vision API');
            return '';
        });
    }
}
exports.OCRService = OCRService;
