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
const logger_1 = require("../utils/logger");
class ShiftReportController {
    /**
     * POST /shift-reports/upload
     * Upload, extract, and save a shift report
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
                // Analyze the report
                const result = yield ShiftAnalysisService_1.ShiftAnalysisService.analyzeShiftReport(file.buffer, file.mimetype);
                // Save to database
                const saveResult = yield ShiftReportStorage_1.ShiftReportStorage.save(storeId, result.extract);
                // Fetch the full saved record
                const report = yield ShiftReportStorage_1.ShiftReportStorage.getById(saveResult.id);
                res.json({
                    success: true,
                    reportId: saveResult.id,
                    isDuplicate: saveResult.isDuplicate,
                    extract: result.extract,
                    method: result.method,
                    ocrScore: result.ocrScore,
                    savedAt: report === null || report === void 0 ? void 0 : report.createdAt,
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
