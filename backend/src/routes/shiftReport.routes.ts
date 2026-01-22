import { Router } from 'express';
import multer from 'multer';
import { ShiftReportController } from '../controllers/shiftReport.controller';
import { KVExplorerController } from '../controllers/kvExplorer.controller';
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

// Chat and insights endpoints (must come before /:id)
router.post('/:id/chat', ShiftReportController.chat);
router.get('/:id/insights', ShiftReportController.getInsights);
// Add this BEFORE other routes
router.post('/auto-crop', upload.single('file'), ShiftReportController.autoCrop);

// Bulk delete (must come before /:id)
router.post('/bulk-delete', ShiftReportController.bulkDelete);

// ============================================
// KV EXPLORER ENDPOINTS (must come before /:id)
// ============================================

// Get KV pairs for a specific section (paginated)
router.get('/:id/section/:section', KVExplorerController.getSection);

// Search KV pairs across all sections (paginated)
router.get('/:id/search', KVExplorerController.search);

// Get raw parsed JSON (for debugging/export)
router.get('/:id/raw', KVExplorerController.getRaw);

// Get single report with summary + section counts
router.get('/:id', KVExplorerController.getReport);

// Delete single report
router.delete('/:id', ShiftReportController.delete);

// Get summary for AI chat (legacy)
router.get('/:id/summary', ShiftReportController.getSummary);

export default router;

