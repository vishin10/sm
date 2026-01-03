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
exports.ShiftAnalysisController = void 0;
const ShiftAnalysisService_1 = require("../services/ShiftAnalysisService");
const logger_1 = require("../utils/logger");
class ShiftAnalysisController {
    static analyzeReport(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
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
                logger_1.Logger.info(`Analyzing shift report: ${file.originalname} (${file.mimetype}, ${Math.round(file.size / 1024)}KB)`);
                const result = yield ShiftAnalysisService_1.ShiftAnalysisService.analyzeShiftReport(file.buffer, file.mimetype);
                logger_1.Logger.info(`Analysis complete using method: ${result.method}, OCR score: ${result.ocrScore}`);
                res.json({
                    success: true,
                    extract: result.extract,
                    method: result.method,
                    ocrScore: result.ocrScore,
                    analyzedAt: new Date().toISOString()
                });
            }
            catch (error) {
                logger_1.Logger.error('Shift analysis controller error', error);
                // Handle multer errors
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({
                        error: {
                            code: 'FILE_TOO_LARGE',
                            message: 'File is too large. Maximum size is 10MB. Please compress the image.'
                        }
                    });
                }
                if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Invalid file type')) {
                    return res.status(400).json({
                        error: {
                            code: 'INVALID_FILE_TYPE',
                            message: error.message
                        }
                    });
                }
                if ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('API Key')) {
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
        });
    }
}
exports.ShiftAnalysisController = ShiftAnalysisController;
