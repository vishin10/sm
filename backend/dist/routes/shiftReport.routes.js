"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const shiftReport_controller_1 = require("../controllers/shiftReport.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only images and PDFs allowed.'));
        }
    }
});
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Upload and analyze
router.post('/upload', upload.single('file'), shiftReport_controller_1.ShiftReportController.uploadAndAnalyze);
// List reports
router.get('/', shiftReport_controller_1.ShiftReportController.list);
// Analytics endpoints (must come before /:id)
router.get('/analytics/top-items', shiftReport_controller_1.ShiftReportController.getTopItems);
router.get('/analytics/top-departments', shiftReport_controller_1.ShiftReportController.getTopDepartments);
router.get('/analytics/cash-variances', shiftReport_controller_1.ShiftReportController.getCashVariances);
router.get('/analytics/fuel-vs-inside', shiftReport_controller_1.ShiftReportController.getFuelVsInside);
// Get single report
router.get('/:id', shiftReport_controller_1.ShiftReportController.getById);
// Get summary for AI chat
router.get('/:id/summary', shiftReport_controller_1.ShiftReportController.getSummary);
exports.default = router;
