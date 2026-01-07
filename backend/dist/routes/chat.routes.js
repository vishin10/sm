"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_1 = require("../controllers/chat.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Chat endpoint (requires auth)
router.post('/', auth_middleware_1.authenticate, chat_controller_1.ChatController.chat);
// Conversation management (requires auth)
router.get('/conversations', auth_middleware_1.authenticate, chat_controller_1.ChatController.listConversations);
router.get('/conversations/:id', auth_middleware_1.authenticate, chat_controller_1.ChatController.getConversation);
router.delete('/conversations/:id', auth_middleware_1.authenticate, chat_controller_1.ChatController.deleteConversation);
router.patch('/conversations/:id/pin', auth_middleware_1.authenticate, chat_controller_1.ChatController.togglePin);
router.patch('/conversations/:id/rename', auth_middleware_1.authenticate, chat_controller_1.ChatController.renameConversation);
// Share management (requires auth)
router.post('/conversations/:id/share', auth_middleware_1.authenticate, chat_controller_1.ChatController.shareConversation);
router.post('/conversations/:id/unshare', auth_middleware_1.authenticate, chat_controller_1.ChatController.unshareConversation);
// Public shared conversation (NO auth required)
router.get('/shared/:token', chat_controller_1.ChatController.getSharedConversation);
exports.default = router;
