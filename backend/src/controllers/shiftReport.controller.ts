import { Request, Response, NextFunction } from 'express';
import { ShiftAnalysisService } from '../services/ShiftAnalysisService';
import { ShiftReportStorage } from '../services/ShiftReportStorage';
import { ShiftReportChatService } from '../services/ShiftReportChatService';
import { EdgeDetectionService } from '../services/EdgeDetectionService';
import { Logger } from '../utils/logger';

export class ShiftReportController {
    /**
     * POST /shift-reports/auto-crop
     * Auto-detect receipt edges and crop image
     */
    static async autoCrop(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: { code: 'MISSING_FILE', message: 'No file uploaded' }
                });
            }

            Logger.info(`Auto-cropping image: ${req.file.originalname}`);

            const result = await EdgeDetectionService.autoCropReceipt(req.file.buffer);

            if (!result.success || !result.croppedImage) {
                return res.status(200).json({
                    success: false,
                    confidence: result.confidence,
                    error: result.error,
                    message: 'Auto-crop failed, please crop manually',
                });
            }

            // Return cropped image as base64
            const base64Image = `data:${req.file.mimetype};base64,${result.croppedImage.toString('base64')}`;

            Logger.info(`Auto-crop successful with confidence ${result.confidence.toFixed(2)}`);

            res.json({
                success: true,
                confidence: result.confidence,
                croppedImage: base64Image,
                coordinates: result.coordinates,
            });
        } catch (error) {
            Logger.error('Auto-crop endpoint error', error);
            next(error);
        }
    }

    /**
     * POST /shift-reports/upload
     * Upload, extract, and save a shift report with universal AI extraction
     */
    static async uploadAndAnalyze(req: Request, res: Response, next: NextFunction) {
        try {
            const file = req.file;
            const { storeId } = req.body;

            if (!file) {
                return res.status(400).json({
                    error: { code: 'MISSING_FILE', message: 'Please upload an image or PDF file' }
                });
            }

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'MISSING_STORE', message: 'Store ID is required' }
                });
            }

            Logger.info(`Analyzing shift report for store ${storeId}: ${file.originalname}`);

            // Analyze with universal AI extraction
            const result = await ShiftAnalysisService.analyzeShiftReport(
                file.buffer,
                file.mimetype
            );

            // Save to database with FULL extraction data for chat queries
            const saveResult = await ShiftReportStorage.save(
                storeId,
                result.extract,
                result.rawExtraction
            );

            // Fetch the full saved record
            const report = await ShiftReportStorage.getById(saveResult.id);

            res.json({
                success: true,
                reportId: saveResult.id,
                status: saveResult.status,
                uploadCount: saveResult.uploadCount,
                extract: result.extract,
                method: result.method,
                ocrScore: result.ocrScore,
                savedAt: report?.createdAt,
                updatedAt: report?.updatedAt,
            });

        } catch (error: any) {
            Logger.error('Upload and analyze error', error);

            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    error: { code: 'FILE_TOO_LARGE', message: 'File too large. Max 10MB.' }
                });
            }

            if (error.name === 'ZodError') {
                return res.status(422).json({
                    error: { code: 'PARSE_ERROR', message: 'Could not extract data from report.' }
                });
            }

            next(error);
        }
    }

    /**
     * POST /shift-reports/:id/chat
     * Ask natural language questions about a shift report
     */
    static async chat(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { question, conversationHistory } = req.body;

            if (!question) {
                return res.status(400).json({
                    error: { code: 'MISSING_QUESTION', message: 'Question is required' }
                });
            }

            Logger.info(`Chat query for report ${id}: "${question}"`);

            const response = await ShiftReportChatService.askQuestion(
                id,
                question,
                conversationHistory
            );

            res.json({
                success: true,
                answer: response.answer,
                suggestions: response.suggestions,
                relatedData: response.relatedData
            });

        } catch (error: any) {
            if (error.message === 'Report not found') {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }
            next(error);
        }
    }

    /**
     * GET /shift-reports/:id/insights
     * Get automatic AI-generated insights for a report
     */
    static async getInsights(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            Logger.info(`Generating insights for report ${id}`);

            const insights = await ShiftReportChatService.generateInsights(id);

            res.json({
                success: true,
                insights
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports
     * List shift reports for a store
     */
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId, startDate, endDate, limit, offset } = req.query;

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'MISSING_STORE', message: 'Store ID is required' }
                });
            }

            const reports = await ShiftReportStorage.listByStore(storeId as string, {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                limit: limit ? parseInt(limit as string) : 50,
                offset: offset ? parseInt(offset as string) : 0,
            });

            res.json({ success: true, reports });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/:id
     * Get a single shift report
     */
    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const report = await ShiftReportStorage.getById(id);

            if (!report) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            res.json({ success: true, report });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/:id/summary
     * Get compact summary for AI chat
     */
    static async getSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const summary = await ShiftReportStorage.getSummary(id);

            if (!summary) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            res.json({ success: true, summary });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/analytics/top-items
     */
    static async getTopItems(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId, startDate, endDate, limit } = req.query;

            if (!storeId || !startDate || !endDate) {
                return res.status(400).json({
                    error: { code: 'MISSING_PARAMS', message: 'storeId, startDate, endDate required' }
                });
            }

            const items = await ShiftReportStorage.getTopItems(
                storeId as string,
                new Date(startDate as string),
                new Date(endDate as string),
                limit ? parseInt(limit as string) : 10
            );

            res.json({ success: true, items });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/analytics/top-departments
     */
    static async getTopDepartments(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId, startDate, endDate, limit } = req.query;

            if (!storeId || !startDate || !endDate) {
                return res.status(400).json({
                    error: { code: 'MISSING_PARAMS', message: 'storeId, startDate, endDate required' }
                });
            }

            const departments = await ShiftReportStorage.getTopDepartments(
                storeId as string,
                new Date(startDate as string),
                new Date(endDate as string),
                limit ? parseInt(limit as string) : 10
            );

            res.json({ success: true, departments });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/analytics/cash-variances
     */
    static async getCashVariances(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId, startDate, endDate } = req.query;

            if (!storeId || !startDate || !endDate) {
                return res.status(400).json({
                    error: { code: 'MISSING_PARAMS', message: 'storeId, startDate, endDate required' }
                });
            }

            const variances = await ShiftReportStorage.getCashVarianceDays(
                storeId as string,
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.json({ success: true, variances });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /shift-reports/analytics/fuel-vs-inside
     */
    static async getFuelVsInside(req: Request, res: Response, next: NextFunction) {
        try {
            const { storeId, startDate, endDate } = req.query;

            if (!storeId || !startDate || !endDate) {
                return res.status(400).json({
                    error: { code: 'MISSING_PARAMS', message: 'storeId, startDate, endDate required' }
                });
            }

            const data = await ShiftReportStorage.getFuelVsInside(
                storeId as string,
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /shift-reports/:id
     * Delete a single shift report
     */
    static async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { storeId } = req.query;

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'MISSING_STORE', message: 'Store ID is required' }
                });
            }

            const deleted = await ShiftReportStorage.delete(id, storeId as string);

            if (!deleted) {
                return res.status(404).json({
                    error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                });
            }

            Logger.info(`Deleted shift report ${id} for store ${storeId}`);
            res.json({ success: true, message: 'Report deleted successfully' });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /shift-reports/bulk-delete
     * Delete multiple shift reports at once
     */
    static async bulkDelete(req: Request, res: Response, next: NextFunction) {
        try {
            const { reportIds, storeId } = req.body;

            if (!storeId) {
                return res.status(400).json({
                    error: { code: 'MISSING_STORE', message: 'Store ID is required' }
                });
            }

            if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
                return res.status(400).json({
                    error: { code: 'MISSING_IDS', message: 'Report IDs array is required' }
                });
            }

            const deletedCount = await ShiftReportStorage.deleteMany(reportIds, storeId);

            Logger.info(`Bulk deleted ${deletedCount} reports for store ${storeId}`);
            res.json({
                success: true,
                deletedCount,
                message: `${deletedCount} report(s) deleted successfully`
            });
        } catch (error) {
            next(error);
        }
    }
}