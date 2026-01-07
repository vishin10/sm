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
exports.ShiftReportChatService = void 0;
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../utils/logger");
const ShiftReportStorage_1 = require("./ShiftReportStorage");
/**
 * Natural language chat service for shift report analytics
 * Works like ChatGPT - conversational, helpful, with suggestions
 */
class ShiftReportChatService {
    /**
     * Answer a natural language question about a shift report
     */
    static askQuestion(reportId, question, conversationHistory) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API Key not configured');
            }
            // Get the full report data
            const report = yield ShiftReportStorage_1.ShiftReportStorage.getForChat(reportId);
            if (!report) {
                throw new Error('Report not found');
            }
            // Prepare data context
            const dataContext = this.prepareDataContext(report);
            // Build messages
            const messages = [
                {
                    role: "system",
                    content: this.CHAT_SYSTEM_PROMPT
                }
            ];
            // 1️⃣ Add conversation history FIRST (this enables real chat behavior)
            if (conversationHistory && conversationHistory.length > 0) {
                messages.push(...conversationHistory);
            }
            // 2️⃣ Then give the shift report data (grounding)
            messages.push({
                role: "user",
                content: `Here's the shift report data:\n\n${JSON.stringify(dataContext, null, 2)}`
            });
            // 3️⃣ Then add the current question
            messages.push({
                role: "user",
                content: question
            });
            logger_1.Logger.info(`Chat query: "${question}" for report ${reportId}`);
            const response = yield this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                temperature: 0.7, // Slightly higher for natural conversation
                response_format: { type: "json_object" },
                max_tokens: 1000,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error('No response from OpenAI');
            const result = JSON.parse(content);
            logger_1.Logger.info(`Chat response generated with ${((_a = result.suggestions) === null || _a === void 0 ? void 0 : _a.length) || 0} suggestions`);
            return {
                answer: result.answer || 'I could not generate a response.',
                suggestions: result.suggestions || [],
                relatedData: result.relatedData || null
            };
        });
    }
    /**
     * Prepare comprehensive data context for AI
     * Uses FULL extraction if available, falls back to database fields
     */
    static prepareDataContext(report) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
        // If we have the full AI extraction, use that (most complete)
        if (report.fullExtraction) {
            return Object.assign(Object.assign({ reportDate: (_a = report.reportDate) === null || _a === void 0 ? void 0 : _a.toISOString().split('T')[0], storeName: (_b = report.store) === null || _b === void 0 ? void 0 : _b.name }, report.fullExtraction), { 
                // Also include database-structured data for convenience
                departments: (_c = report.departments) === null || _c === void 0 ? void 0 : _c.map((d) => {
                    var _a;
                    return ({
                        name: d.departmentName,
                        quantity: d.quantity,
                        amount: (_a = d.amount) === null || _a === void 0 ? void 0 : _a.toNumber()
                    });
                }), items: (_d = report.items) === null || _d === void 0 ? void 0 : _d.map((i) => {
                    var _a;
                    return ({
                        name: i.itemName,
                        sku: i.sku,
                        quantity: i.quantity,
                        amount: (_a = i.amount) === null || _a === void 0 ? void 0 : _a.toNumber()
                    });
                }), exceptions: (_e = report.exceptions) === null || _e === void 0 ? void 0 : _e.map((e) => {
                    var _a;
                    return ({
                        type: e.type,
                        count: e.count,
                        amount: (_a = e.amount) === null || _a === void 0 ? void 0 : _a.toNumber()
                    });
                }) });
        }
        // Fallback: use database fields only
        return {
            reportDate: (_f = report.reportDate) === null || _f === void 0 ? void 0 : _f.toISOString().split('T')[0],
            storeName: (_g = report.store) === null || _g === void 0 ? void 0 : _g.name,
            shiftInfo: {
                registerId: report.registerId,
                operatorId: report.operatorId,
                tillId: report.tillId,
                shiftStart: (_h = report.shiftStart) === null || _h === void 0 ? void 0 : _h.toISOString(),
                shiftEnd: (_j = report.shiftEnd) === null || _j === void 0 ? void 0 : _j.toISOString(),
            },
            financial: {
                grossSales: (_k = report.grossSales) === null || _k === void 0 ? void 0 : _k.toNumber(),
                netSales: (_l = report.netSales) === null || _l === void 0 ? void 0 : _l.toNumber(),
                tax: (_m = report.taxTotal) === null || _m === void 0 ? void 0 : _m.toNumber(),
                refunds: (_o = report.refunds) === null || _o === void 0 ? void 0 : _o.toNumber(),
                discounts: (_p = report.discounts) === null || _p === void 0 ? void 0 : _p.toNumber(),
                totalTransactions: report.totalTransactions,
            },
            cash: {
                beginningBalance: (_q = report.beginningBalance) === null || _q === void 0 ? void 0 : _q.toNumber(),
                endingBalance: (_r = report.endingBalance) === null || _r === void 0 ? void 0 : _r.toNumber(),
                expected: (_s = report.closingAccountability) === null || _s === void 0 ? void 0 : _s.toNumber(),
                actual: (_t = report.cashierCounted) === null || _t === void 0 ? void 0 : _t.toNumber(),
                variance: (_u = report.cashVariance) === null || _u === void 0 ? void 0 : _u.toNumber(),
            },
            fuel: {
                sales: (_v = report.fuelSales) === null || _v === void 0 ? void 0 : _v.toNumber(),
                gross: (_w = report.fuelGross) === null || _w === void 0 ? void 0 : _w.toNumber(),
                gallons: (_x = report.fuelGallons) === null || _x === void 0 ? void 0 : _x.toNumber(),
            },
            inside: {
                sales: (_y = report.insideSales) === null || _y === void 0 ? void 0 : _y.toNumber(),
                merchandise: (_z = report.merchandiseSales) === null || _z === void 0 ? void 0 : _z.toNumber(),
                prepaysInitiated: (_0 = report.prepaysInitiated) === null || _0 === void 0 ? void 0 : _0.toNumber(),
                prepaysPumped: (_1 = report.prepaysPumped) === null || _1 === void 0 ? void 0 : _1.toNumber(),
            },
            tenders: {
                cash: { count: report.cashCount, amount: (_2 = report.cashAmount) === null || _2 === void 0 ? void 0 : _2.toNumber() },
                credit: { count: report.creditCount, amount: (_3 = report.creditAmount) === null || _3 === void 0 ? void 0 : _3.toNumber() },
                debit: { count: report.debitCount, amount: (_4 = report.debitAmount) === null || _4 === void 0 ? void 0 : _4.toNumber() },
                check: { count: report.checkCount, amount: (_5 = report.checkAmount) === null || _5 === void 0 ? void 0 : _5.toNumber() },
                total: (_6 = report.totalTenders) === null || _6 === void 0 ? void 0 : _6.toNumber(),
            },
            safe: {
                drops: { count: report.safeDropCount, amount: (_7 = report.safeDropAmount) === null || _7 === void 0 ? void 0 : _7.toNumber() },
                loans: { count: report.safeLoanCount, amount: (_8 = report.safeLoanAmount) === null || _8 === void 0 ? void 0 : _8.toNumber() },
                paidIn: { count: report.paidInCount, amount: (_9 = report.paidInAmount) === null || _9 === void 0 ? void 0 : _9.toNumber() },
                paidOut: { count: report.paidOutCount, amount: (_10 = report.paidOutAmount) === null || _10 === void 0 ? void 0 : _10.toNumber() },
            },
            departments: (_11 = report.departments) === null || _11 === void 0 ? void 0 : _11.map((d) => {
                var _a;
                return ({
                    name: d.departmentName,
                    quantity: d.quantity,
                    amount: (_a = d.amount) === null || _a === void 0 ? void 0 : _a.toNumber()
                });
            }),
            items: (_12 = report.items) === null || _12 === void 0 ? void 0 : _12.map((i) => {
                var _a;
                return ({
                    name: i.itemName,
                    sku: i.sku,
                    quantity: i.quantity,
                    amount: (_a = i.amount) === null || _a === void 0 ? void 0 : _a.toNumber()
                });
            }),
            exceptions: (_13 = report.exceptions) === null || _13 === void 0 ? void 0 : _13.map((e) => {
                var _a;
                return ({
                    type: e.type,
                    count: e.count,
                    amount: (_a = e.amount) === null || _a === void 0 ? void 0 : _a.toNumber()
                });
            })
        };
    }
    /**
     * Generate automatic insights for a report
     */
    static generateInsights(reportId) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield ShiftReportStorage_1.ShiftReportStorage.getForChat(reportId);
            if (!report)
                return [];
            const dataContext = this.prepareDataContext(report);
            const response = yield this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You analyze gas station shift reports and generate 5-7 key insights as bullet points. Be specific with numbers. Focus on what's notable, unusual, or important for the manager to know."
                    },
                    {
                        role: "user",
                        content: `Generate insights from this shift report:\n\n${JSON.stringify(dataContext, null, 2)}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 500,
            });
            const content = response.choices[0].message.content;
            if (!content)
                return [];
            // Parse bullet points
            const insights = content
                .split('\n')
                .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
                .map(line => line.replace(/^[-•]\s*/, '').trim())
                .filter(Boolean);
            return insights;
        });
    }
}
exports.ShiftReportChatService = ShiftReportChatService;
ShiftReportChatService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * System prompt for natural conversational analytics
 */
ShiftReportChatService.CHAT_SYSTEM_PROMPT = `You are an AI assistant helping a gas station/convenience store manager analyze their shift reports.

Your personality:
- Conversational and friendly (like ChatGPT)
- Data-driven but explain insights clearly
- Proactive with suggestions
- Understand business context (retail, fuel, margins, etc.)

When answering:
1. Answer the question directly and naturally
2. Provide specific numbers/details from the data
3. Add context or insights when relevant
4. Never say "based on the data provided" - just answer naturally
5. If asked about trends or comparisons, explain what you see
6. For "least sold" or "most sold" questions, name the specific item/department with exact numbers

Response format:
{
  "answer": "Your natural, conversational response",
  "suggestions": [
    "3-5 follow-up questions the user might want to ask",
    "Make them specific to the data you see",
    "Examples: 'What was my fuel vs inside sales split?', 'How much cash variance did I have?'"
  ],
  "relatedData": {
    // Optional: Include specific data points mentioned in answer
    // Examples: {"lowestSelling": "Sweet Snacks", "amount": 1.99}
  }
}

Example interactions:

User: "What sold the least on Dec 24th?"
Response: {
  "answer": "Sweet Snacks sold the least with just 1 item for $1.99. That's significantly lower than your other categories - Cigarettes led at $89.53 with 8 packs sold.",
  "suggestions": [
    "What were my top 3 selling departments that day?",
    "How did my fuel sales compare to inside sales?",
    "Did I have any cash variance?",
    "What was my total revenue for Dec 24th?"
  ],
  "relatedData": {
    "lowestSelling": "Sweet Snacks",
    "quantity": 1,
    "amount": 1.99,
    "highestSelling": "Cigarettes",
    "highestAmount": 89.53
  }
}

User: "How was my cash short?"
Response: {
  "answer": "You had a cash short of $1.88. Your cashier counted $343.88 but the expected amount was $345.76. This is a pretty minor variance - less than 1% of your total cash handling for the shift.",
  "suggestions": [
    "What were my total safe drops?",
    "How many transactions did I process?",
    "What was my beginning vs ending balance?",
    "Show me my payment method breakdown"
  ],
  "relatedData": {
    "variance": -1.88,
    "expected": 345.76,
    "actual": 343.88,
    "variancePercentage": 0.54
  }
}

Always respond with valid JSON matching this format.`;
