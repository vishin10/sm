"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const agent_controller_1 = require("../controllers/agent.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const agentAuth_middleware_1 = require("../middleware/agentAuth.middleware");
const router = (0, express_1.Router)();
// Configure multer for XML file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/xml', 'text/xml', 'application/octet-stream'];
        const allowedExts = ['.xml', '.XML'];
        const hasAllowedExt = allowedExts.some(ext => file.originalname.endsWith(ext));
        if (allowedMimes.includes(file.mimetype) || hasAllowedExt) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only XML files allowed.'));
        }
    }
});
// ==========================================
// JWT-authenticated routes (mobile app)
// ==========================================
// Generate setup PIN
router.post('/generate-pin', auth_middleware_1.authenticate, agent_controller_1.AgentController.generatePin);
// List API keys for a store
router.get('/keys', auth_middleware_1.authenticate, agent_controller_1.AgentController.listKeys);
// Revoke an API key
router.delete('/keys/:id', auth_middleware_1.authenticate, agent_controller_1.AgentController.revokeKey);
// ==========================================
// Public route (agent registration)
// ==========================================
// Register agent with PIN (no auth required)
router.post('/register', agent_controller_1.AgentController.register);
// ==========================================
// API key authenticated routes (agent)
// ==========================================
// Upload XML file
router.post('/upload', agentAuth_middleware_1.authenticateAgent, upload.single('file'), agent_controller_1.AgentController.upload);
// Get upload status
router.get('/upload/:id/status', agentAuth_middleware_1.authenticateAgent, agent_controller_1.AgentController.getUploadStatus);
// Heartbeat / health check
router.get('/heartbeat', agentAuth_middleware_1.authenticateAgent, agent_controller_1.AgentController.heartbeat);
exports.default = router;
