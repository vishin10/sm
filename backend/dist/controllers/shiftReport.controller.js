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
const logger_1 = require("../utils/logger");
class ShiftReportController {
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
}
exports.ShiftReportController = ShiftReportController;
