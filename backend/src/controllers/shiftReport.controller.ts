import { Request, Response, NextFunction } from 'express';
import { ShiftAnalysisService } from '../services/ShiftAnalysisService';
import { ShiftReportStorage } from '../services/ShiftReportStorage';
import { Logger } from '../utils/logger';

export class ShiftReportController {
    /**
     * POST /shift-reports/upload
     * Upload, extract, and save a shift report
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

            // Analyze the report
            const result = await ShiftAnalysisService.analyzeShiftReport(
                file.buffer,
                file.mimetype
            );

            // Save to database
            const saveResult = await ShiftReportStorage.save(storeId, result.extract);

            // Fetch the full saved record
            const report = await ShiftReportStorage.getById(saveResult.id);

            res.json({
                success: true,
                reportId: saveResult.id,
                isDuplicate: saveResult.isDuplicate,
                extract: result.extract,
                method: result.method,
                ocrScore: result.ocrScore,
                savedAt: report?.createdAt,
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
}
