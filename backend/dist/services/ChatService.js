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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const openai_1 = __importDefault(require("openai"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class ChatService {
    static generateReply(userId, userMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Fetch Context: Get recent shifts and alerts for the user's stores
                const userStores = yield database_1.prisma.store.findMany({ where: { userId }, select: { id: true } });
                const storeIds = userStores.map(s => s.id);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const [recentShifts, recentAlerts] = yield Promise.all([
                    database_1.prisma.shift.findMany({
                        where: { storeId: { in: storeIds }, startAt: { gte: sevenDaysAgo } },
                        orderBy: { startAt: 'desc' },
                        take: 5,
                    }),
                    database_1.prisma.alert.findMany({
                        where: { storeId: { in: storeIds }, createdAt: { gte: sevenDaysAgo } },
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    })
                ]);
                // 2. Construct System Prompt
                const context = JSON.stringify({
                    shifts: recentShifts.map((s) => ({
                        date: s.startAt,
                        totalSales: s.totalSales,
                        cashVariance: s.cashVariance,
                    })),
                    alerts: recentAlerts.map((a) => ({
                        title: a.title,
                        severity: a.severity,
                        message: a.message
                    }))
                });
                const systemPrompt = `
        You are "Silent Manager", an AI assistant for a retail store owner.
        Answer the user's question based strictly on the recent data provided below.
        Be concise, professional, and helpful.
        If the data doesn't contain the answer, say "I don't have that information in the recent records."
        
        Recent Data:
        ${context}
      `;
                // 3. Call OpenAI
                const response = yield this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 0.7,
                    max_tokens: 150,
                });
                const reply = response.choices[0].message.content;
                return reply || "I couldn't generate a response.";
            }
            catch (error) {
                logger_1.Logger.error('Chat Service Error', error);
                return "I'm having trouble connecting to the AI service right now.";
            }
        });
    }
}
exports.ChatService = ChatService;
ChatService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
