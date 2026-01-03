import { Request, Response, NextFunction } from 'express';
import { ShiftAnalysisService } from '../services/ShiftAnalysisService';
import { Logger } from '../utils/logger';

export class ShiftAnalysisController {
    static async analyzeReport(req: Request, res: Response, next: NextFunction) {
        try {
            const file = req.file;

            if (!file) {
                return res.status(400).json({
                    error: {
                        code: 'MISSING_FILE',
                        message: 'Please upload an image or PDF file'
                    }
                });
            }

            Logger.info(`Analyzing shift report: ${file.originalname} (${file.mimetype}, ${Math.round(file.size / 1024)}KB)`);

            const result = await ShiftAnalysisService.analyzeShiftReport(
                file.buffer,
                file.mimetype
            );

            Logger.info(`Analysis complete using method: ${result.method}, OCR score: ${result.ocrScore}`);

            res.json({
                success: true,
                extract: result.extract,
                method: result.method,
                ocrScore: result.ocrScore,
                analyzedAt: new Date().toISOString()
            });

        } catch (error: any) {
            Logger.error('Shift analysis controller error', error);

            // Handle multer errors
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    error: {
                        code: 'FILE_TOO_LARGE',
                        message: 'File is too large. Maximum size is 10MB. Please compress the image.'
                    }
                });
            }

            if (error.message?.includes('Invalid file type')) {
                return res.status(400).json({
                    error: {
                        code: 'INVALID_FILE_TYPE',
                        message: error.message
                    }
                });
            }

            if (error.message?.includes('API Key')) {
                return res.status(500).json({
                    error: {
                        code: 'AI_CONFIG_ERROR',
                        message: 'AI service is not properly configured'
                    }
                });
            }

            if (error.name === 'ZodError') {
                return res.status(422).json({
                    error: {
                        code: 'PARSE_ERROR',
                        message: 'Could not extract data from the report. Please try a clearer image.'
                    }
                });
            }

            next(error);
        }
    }
}
