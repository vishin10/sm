import { Router } from 'express';
import multer from 'multer';
import { ShiftReportController } from '../controllers/shiftReport.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and PDFs allowed.'));
        }
    }
});

// All routes require authentication
router.use(authenticate);

// Upload and analyze
router.post('/upload', upload.single('file'), ShiftReportController.uploadAndAnalyze);

// List reports
router.get('/', ShiftReportController.list);

// Analytics endpoints (must come before /:id)
router.get('/analytics/top-items', ShiftReportController.getTopItems);
router.get('/analytics/top-departments', ShiftReportController.getTopDepartments);
router.get('/analytics/cash-variances', ShiftReportController.getCashVariances);
router.get('/analytics/fuel-vs-inside', ShiftReportController.getFuelVsInside);

// Get single report
router.get('/:id', ShiftReportController.getById);

// Get summary for AI chat
router.get('/:id/summary', ShiftReportController.getSummary);

export default router;
