import { Router } from 'express';
import multer from 'multer';
import { AgentController } from '../controllers/agent.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authenticateAgent } from '../middleware/agentAuth.middleware';

const router = Router();

// Configure multer for XML file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/xml', 'text/xml', 'application/octet-stream'];
        const allowedExts = ['.xml', '.XML'];
        const hasAllowedExt = allowedExts.some(ext => file.originalname.endsWith(ext));

        if (allowedMimes.includes(file.mimetype) || hasAllowedExt) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only XML files allowed.'));
        }
    }
});

// ==========================================
// JWT-authenticated routes (mobile app)
// ==========================================

// Generate setup PIN
router.post('/generate-pin', authenticate, AgentController.generatePin);

// List API keys for a store
router.get('/keys', authenticate, AgentController.listKeys);

// Revoke an API key
router.delete('/keys/:id', authenticate, AgentController.revokeKey);

// ==========================================
// Public route (agent registration)
// ==========================================

// Register agent with PIN (no auth required)
router.post('/register', AgentController.register);

// ==========================================
// API key authenticated routes (agent)
// ==========================================

// Upload XML file
router.post('/upload', authenticateAgent, upload.single('file'), AgentController.upload);

// Get upload status
router.get('/upload/:id/status', authenticateAgent, AgentController.getUploadStatus);

// Heartbeat / health check
router.get('/heartbeat', authenticateAgent, AgentController.heartbeat);

export default router;
