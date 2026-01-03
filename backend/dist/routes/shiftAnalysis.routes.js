"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const shiftAnalysis_controller_1 = require("../controllers/shiftAnalysis.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        // Accept images and PDFs
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
        }
    }
});
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// POST /analyze-shift-report - Analyze a shift report image/PDF
// Accepts multipart/form-data with 'file' field
router.post('/', upload.single('file'), shiftAnalysis_controller_1.ShiftAnalysisController.analyzeReport);
exports.default = router;
