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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftReportController = void 0;
const ShiftAnalysisService_1 = require("../services/ShiftAnalysisService");
const ShiftReportStorage_1 = require("../services/ShiftReportStorage");
const ShiftReportChatService_1 = require("../services/ShiftReportChatService");
const EdgeDetectionService_1 = require("../services/EdgeDetectionService");
const logger_1 = require("../utils/logger");
class ShiftReportController {
    /**
     * POST /shift-reports/auto-crop
     * Auto-detect receipt edges and crop image
     */
    static autoCrop(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        error: { code: 'MISSING_FILE', message: 'No file uploaded' }
                    });
                }
                logger_1.Logger.info(`Auto-cropping image: ${req.file.originalname}`);
                const result = yield EdgeDetectionService_1.EdgeDetectionService.autoCropReceipt(req.file.buffer);
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
                logger_1.Logger.info(`Auto-crop successful with confidence ${result.confidence.toFixed(2)}`);
                res.json({
                    success: true,
                    confidence: result.confidence,
                    croppedImage: base64Image,
                    coordinates: result.coordinates,
                });
            }
            catch (error) {
                logger_1.Logger.error('Auto-crop endpoint error', error);
                next(error);
            }
        });
    }
    /**
     * POST /shift-reports/upload
     * Upload, extract, and save a shift report with universal AI extraction
     */
    static uploadAndAnalyze(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
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
                logger_1.Logger.info(`Analyzing shift report for store ${storeId}: ${file.originalname}`);
                // Analyze with universal AI extraction
                const result = yield ShiftAnalysisService_1.ShiftAnalysisService.analyzeShiftReport(file.buffer, file.mimetype);
                // Save to database with FULL extraction data for chat queries
                const saveResult = yield ShiftReportStorage_1.ShiftReportStorage.save(storeId, result.extract, result.rawExtraction);
                // Fetch the full saved record
                const report = yield ShiftReportStorage_1.ShiftReportStorage.getById(saveResult.id);
                res.json({
                    success: true,
                    reportId: saveResult.id,
                    status: saveResult.status,
                    uploadCount: saveResult.uploadCount,
                    extract: result.extract,
                    method: result.method,
                    ocrScore: result.ocrScore,
                    savedAt: report === null || report === void 0 ? void 0 : report.createdAt,
                    updatedAt: report === null || report === void 0 ? void 0 : report.updatedAt,
                });
            }
            catch (error) {
                logger_1.Logger.error('Upload and analyze error', error);
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
        });
    }
    /**
     * POST /shift-reports/:id/chat
     * Ask natural language questions about a shift report
     */
    static chat(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { question, conversationHistory } = req.body;
                if (!question) {
                    return res.status(400).json({
                        error: { code: 'MISSING_QUESTION', message: 'Question is required' }
                    });
                }
                logger_1.Logger.info(`Chat query for report ${id}: "${question}"`);
                const response = yield ShiftReportChatService_1.ShiftReportChatService.askQuestion(id, question, conversationHistory);
                res.json({
                    success: true,
                    answer: response.answer,
                    suggestions: response.suggestions,
                    relatedData: response.relatedData
                });
            }
            catch (error) {
                if (error.message === 'Report not found') {
                    return res.status(404).json({
                        error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                    });
                }
                next(error);
            }
        });
    }
    /**
     * GET /shift-reports/:id/insights
     * Get automatic AI-generated insights for a report
     */
    static getInsights(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                logger_1.Logger.info(`Generating insights for report ${id}`);
                const insights = yield ShiftReportChatService_1.ShiftReportChatService.generateInsights(id);
                res.json({
                    success: true,
                    insights
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /shift-reports
     * List shift reports for a store
     */
    static list(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId, startDate, endDate, limit, offset } = req.query;
                if (!storeId) {
                    return res.status(400).json({
                        error: { code: 'MISSING_STORE', message: 'Store ID is required' }
                    });
                }
                const reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, {
                    startDate: startDate ? new Date(startDate) : undefined,
                    endDate: endDate ? new Date(endDate) : undefined,
                    limit: limit ? parseInt(limit) : 50,
                    offset: offset ? parseInt(offset) : 0,
                });
                res.json({ success: true, reports });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /shift-reports/:id
     * Get a single shift report
     */
    static getById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const report = yield ShiftReportStorage_1.ShiftReportStorage.getById(id);
                if (!report) {
                    return res.status(404).json({
                        error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                    });
                }
                res.json({ success: true, report });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /shift-reports/:id/summary
     * Get compact summary for AI chat
     */
    static getSummary(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const summary = yield ShiftReportStorage_1.ShiftReportStorage.getSummary(id);
                if (!summary) {
                    return res.status(404).json({
                        error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                    });
                }
                res.json({ success: true, summary });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /shift-reports/analytics/top-items
     */
    static getTopItems(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId, startDate, endDate, limit } = req.query;
                if (!storeId || !startDate || !endDate) {
                    return res.status(400).json({
                        error: { code: 'MISSING_PARAMS', message: 'storeId, startDate, endDate required' }
                    });
                }
                const items = yield ShiftReportStorage_1.ShiftReportStorage.getTopItems(storeId, new Date(startDate), new Date(endDate), limit ? parseInt(limit) : 10);
                res.json({ success: true, items });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /shift-reports/analytics/top-departments
     */
    static getTopDepartments(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId, startDate, endDate, limit } = req.query;
                if (!storeId || !startDate || !endDate) {
                    return res.status(400).json({
                        error: { code: 'MISSING_PARAMS', message: 'storeId, startDate, endDate required' }
                    });
                }
                const departments = yield ShiftReportStorage_1.ShiftReportStorage.getTopDepartments(storeId, new Date(startDate), new Date(endDate), limit ? parseInt(limit) : 10);
                res.json({ success: true, departments });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /shift-reports/analytics/cash-variances
     */
    static getCashVariances(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId, startDate, endDate } = req.query;
                if (!storeId || !startDate || !endDate) {
                    return res.status(400).json({
                        error: { code: 'MISSING_PARAMS', message: 'storeId, startDate, endDate required' }
                    });
                }
                const variances = yield ShiftReportStorage_1.ShiftReportStorage.getCashVarianceDays(storeId, new Date(startDate), new Date(endDate));
                res.json({ success: true, variances });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /shift-reports/analytics/fuel-vs-inside
     */
    static getFuelVsInside(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId, startDate, endDate } = req.query;
                if (!storeId || !startDate || !endDate) {
                    return res.status(400).json({
                        error: { code: 'MISSING_PARAMS', message: 'storeId, startDate, endDate required' }
                    });
                }
                const data = yield ShiftReportStorage_1.ShiftReportStorage.getFuelVsInside(storeId, new Date(startDate), new Date(endDate));
                res.json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * DELETE /shift-reports/:id
     * Delete a single shift report
     */
    static delete(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { storeId } = req.query;
                if (!storeId) {
                    return res.status(400).json({
                        error: { code: 'MISSING_STORE', message: 'Store ID is required' }
                    });
                }
                const deleted = yield ShiftReportStorage_1.ShiftReportStorage.delete(id, storeId);
                if (!deleted) {
                    return res.status(404).json({
                        error: { code: 'NOT_FOUND', message: 'Shift report not found' }
                    });
                }
                logger_1.Logger.info(`Deleted shift report ${id} for store ${storeId}`);
                res.json({ success: true, message: 'Report deleted successfully' });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * POST /shift-reports/bulk-delete
     * Delete multiple shift reports at once
     */
    static bulkDelete(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const deletedCount = yield ShiftReportStorage_1.ShiftReportStorage.deleteMany(reportIds, storeId);
                logger_1.Logger.info(`Bulk deleted ${deletedCount} reports for store ${storeId}`);
                res.json({
                    success: true,
                    deletedCount,
                    message: `${deletedCount} report(s) deleted successfully`
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.ShiftReportController = ShiftReportController;
