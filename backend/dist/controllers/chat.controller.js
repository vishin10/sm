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
exports.ChatController = void 0;
const GeneralChatService_1 = require("../services/GeneralChatService");
const logger_1 = require("../utils/logger");
class ChatController {
    /**
     * POST /chat
     * General chat about shift reports - handles single or multiple reports
     */
    static chat(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const { message, storeId, conversationHistory } = req.body;
                if (!message) {
                    return res.status(400).json({
                        error: { code: 'INVALID_INPUT', message: 'Message is required' }
                    });
                }
                if (!storeId) {
                    return res.status(400).json({
                        error: { code: 'INVALID_INPUT', message: 'Store ID is required' }
                    });
                }
                logger_1.Logger.info(`Chat request from user ${userId}: "${message}"`);
                const response = yield GeneralChatService_1.GeneralChatService.askQuestion(storeId, message, conversationHistory);
                res.json({
                    reply: response.answer,
                    suggestions: response.suggestions,
                    reportsUsed: response.reportsUsed
                });
            }
            catch (error) {
                logger_1.Logger.error('Chat error', error);
                next(error);
            }
        });
    }
}
exports.ChatController = ChatController;
