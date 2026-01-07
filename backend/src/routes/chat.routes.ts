import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Chat endpoint (requires auth)
router.post('/', authenticate, ChatController.chat);

// Conversation management (requires auth)
router.get('/conversations', authenticate, ChatController.listConversations);
router.get('/conversations/:id', authenticate, ChatController.getConversation);
router.delete('/conversations/:id', authenticate, ChatController.deleteConversation);
router.patch('/conversations/:id/pin', authenticate, ChatController.togglePin);
router.patch('/conversations/:id/rename', authenticate, ChatController.renameConversation);

// Share management (requires auth)
router.post('/conversations/:id/share', authenticate, ChatController.shareConversation);
router.post('/conversations/:id/unshare', authenticate, ChatController.unshareConversation);

// Public shared conversation (NO auth required)
router.get('/shared/:token', ChatController.getSharedConversation);

export default router;