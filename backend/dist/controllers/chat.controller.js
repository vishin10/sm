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
const ChatService_1 = require("../services/ChatService");
class ChatController {
    static chat(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { message } = req.body;
                if (!message) {
                    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Message is required' } });
                }
                const reply = yield ChatService_1.ChatService.generateReply(userId, message);
                res.json({ reply });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.ChatController = ChatController;
