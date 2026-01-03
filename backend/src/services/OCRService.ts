import Tesseract from 'tesseract.js';
import { Logger } from '../utils/logger';

export class OCRService {
    /**
     * Extract text from an image buffer using Tesseract OCR
     */
    static async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
        try {
            Logger.info('Starting OCR extraction...');

            const result = await Tesseract.recognize(imageBuffer, 'eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        Logger.info(`OCR progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });

            Logger.info(`OCR complete. Extracted ${result.data.text.length} characters`);
            return result.data.text;
        } catch (error) {
            Logger.error('OCR extraction failed', error);
            throw error;
        }
    }

    /**
     * Extract text from a PDF buffer
     * For now, we'll treat PDFs as images - in production you'd use pdf-parse
     */
    static async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
        // For PDF text extraction, you could use pdf-parse library
        // For now, we'll return empty and let it fall back to vision
        Logger.info('PDF text extraction - falling back to vision API');
        return '';
    }
}
