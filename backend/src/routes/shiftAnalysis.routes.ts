import { Router } from 'express';
import multer from 'multer';
import { ShiftAnalysisController } from '../controllers/shiftAnalysis.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        // Accept images and PDFs
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
        }
    }
});

// All routes require authentication
router.use(authenticate);

// POST /analyze-shift-report - Analyze a shift report image/PDF
// Accepts multipart/form-data with 'file' field
router.post('/', upload.single('file'), ShiftAnalysisController.analyzeReport);

export default router;
