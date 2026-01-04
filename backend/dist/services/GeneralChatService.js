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
exports.GeneralChatService = void 0;
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../utils/logger");
const ShiftReportStorage_1 = require("./ShiftReportStorage");
class GeneralChatService {
    /**
     * Answer general questions about shift reports
     * Handles single reports, multiple reports, comparisons, trends
     */
    static askQuestion(storeId, question, conversationHistory) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API Key not configured');
            }
            logger_1.Logger.info(`General chat query for store ${storeId}: "${question}"`);
            // Step 1: Determine what reports to fetch
            const dateQuery = yield this.parseQuestion(question);
            // Step 2: Fetch relevant reports
            const reports = yield this.fetchReports(storeId, dateQuery);
            if (!reports || reports.length === 0) {
                return {
                    answer: "I couldn't find any shift reports for that time period. Try uploading some reports first.",
                    suggestions: [
                        "Upload a shift report",
                        "What reports do I have?",
                        "Show me this week's sales"
                    ]
                };
            }
            // Step 3: Prepare data for AI
            const dataContext = this.prepareMultiReportContext(reports);
            // Step 4: Ask AI
            const response = yield this.getAIResponse(question, dataContext, conversationHistory);
            return {
                answer: response.answer,
                suggestions: response.suggestions,
                reportsUsed: reports.map(r => r.id)
            };
        });
    }
    /**
     * Parse the question to determine what reports to fetch
     */
    static parseQuestion(question) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = `Parse this question and determine what date range of shift reports to fetch.

Question: "${question}"
You must respond with valid JSON only:
Return JSON:
{
  "type": "latest" | "date_range" | "specific_date" | "all",
  "count": number (for "latest"),
  "startDate": "YYYY-MM-DD" (for "date_range"),
  "endDate": "YYYY-MM-DD" (for "date_range"),
  "specificDate": "YYYY-MM-DD" (for "specific_date")
}

Examples:
- "what's the sale in the last report?" → {"type": "latest", "count": 1}
- "compare last 3 reports" → {"type": "latest", "count": 3}
- "sales this week" → {"type": "date_range", "startDate": "2026-01-01", "endDate": "2026-01-07"}
- "what sold on Dec 24" → {"type": "specific_date", "specificDate": "2025-12-24"}
- "all my reports" → {"type": "all"}

Current date: ${new Date().toISOString().split('T')[0]}`;
            const response = yield this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0,
                response_format: { type: "json_object" }
            });
            const parsed = JSON.parse(response.choices[0].message.content || '{}');
            return parsed;
        });
    }
    /**
     * Fetch reports based on parsed query
     */
    static fetchReports(storeId, query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (query.type === 'latest') {
                const reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, {
                    limit: query.count || 1
                });
                return reports;
            }
            if (query.type === 'date_range') {
                const reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, {
                    startDate: new Date(query.startDate),
                    endDate: new Date(query.endDate),
                    limit: 100
                });
                return reports;
            }
            if (query.type === 'specific_date') {
                const date = new Date(query.specificDate);
                const reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, {
                    startDate: date,
                    endDate: date,
                    limit: 10
                });
                return reports;
            }
            // type === 'all'
            const reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, {
                limit: 50
            });
            return reports;
        });
    }
    /**
     * Prepare context from multiple reports
     */
    static prepareMultiReportContext(reports) {
        return {
            reportCount: reports.length,
            reports: reports.map(r => {
                var _a, _b, _c, _d, _e;
                return ({
                    id: r.id,
                    date: r.reportDate.toISOString().split('T')[0],
                    grossSales: (_a = r.grossSales) === null || _a === void 0 ? void 0 : _a.toNumber(),
                    fuelSales: (_b = r.fuelSales) === null || _b === void 0 ? void 0 : _b.toNumber(),
                    insideSales: (_c = r.insideSales) === null || _c === void 0 ? void 0 : _c.toNumber(),
                    cashVariance: (_d = r.cashVariance) === null || _d === void 0 ? void 0 : _d.toNumber(),
                    totalTransactions: r.totalTransactions,
                    departments: (_e = r.departments) === null || _e === void 0 ? void 0 : _e.map((d) => {
                        var _a;
                        return ({
                            name: d.departmentName,
                            quantity: d.quantity,
                            amount: (_a = d.amount) === null || _a === void 0 ? void 0 : _a.toNumber()
                        });
                    })
                });
            })
        };
    }
    /**
     * Get AI response
     */
    static getAIResponse(question, dataContext, conversationHistory) {
        return __awaiter(this, void 0, void 0, function* () {
            const systemPrompt = `You are a helpful assistant for a gas station manager analyzing shift reports.

Answer questions naturally and conversationally. Be specific with numbers and dates.

When comparing reports, show clear differences and trends.
When asked about "last report" or "latest", use the most recent one.
You must respond with valid JSON in this format:

Response format:
{
  "answer": "Your natural, conversational answer",
  "suggestions": ["3-5 follow-up questions"]
}`;
            const messages = [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Here's the shift report data:\n\n${JSON.stringify(dataContext, null, 2)}`
                }
            ];
            if (conversationHistory) {
                messages.push(...conversationHistory);
            }
            messages.push({ role: "user", content: question });
            const response = yield this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                temperature: 0.7,
                response_format: { type: "json_object" },
                max_tokens: 1000
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            return {
                answer: result.answer || "I couldn't generate a response.",
                suggestions: result.suggestions || []
            };
        });
    }
}
exports.GeneralChatService = GeneralChatService;
GeneralChatService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
