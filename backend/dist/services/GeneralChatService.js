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
const chatPrompts_1 = require("./prompts/chatPrompts");
class GeneralChatService {
    /**
     * Answer general questions about shift reports with smart disambiguation and correction handling
     */
    static askQuestion(storeId, question, conversationHistory) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API Key not configured');
            }
            logger_1.Logger.info(`General chat query for store ${storeId}: "${question}"`);
            // Step 0: Check if user is correcting previous data
            if (conversationHistory && conversationHistory.length >= 2) {
                const lastAIMessage = conversationHistory[conversationHistory.length - 1];
                if (lastAIMessage.role === 'assistant') {
                    const correction = yield this.detectCorrection(question, lastAIMessage.content);
                    if (correction.isCorrection && correction.confidence > 0.7) {
                        logger_1.Logger.info('Correction detected:', correction);
                        // Check if we already verified this field
                        const alreadyVerified = this.hasPreviousVerification(conversationHistory, correction.correctedField || '');
                        if (!alreadyVerified) {
                            // First correction - show proof and ask for confirmation
                            return yield this.generateVerificationResponse(storeId, correction, conversationHistory);
                        }
                        else {
                            // Second time (after verification) - user is confirming, accept their correction
                            logger_1.Logger.info('User confirmed correction, proceeding with corrected value');
                            // Continue with normal flow but we'll apply correction in the response
                        }
                    }
                }
            }
            // Step 1: Extract partial date information
            const partialQuery = yield this.extractPartialDate(question);
            logger_1.Logger.info('Partial date extraction:', partialQuery);
            // Step 2: Handle different query types
            if (partialQuery.queryType === 'all' || partialQuery.queryType === 'comparison') {
                logger_1.Logger.info('Fetching all reports for comparison...');
                // Fetch all reports for aggregate queries
                const reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, { limit: 50 });
                logger_1.Logger.info(`Fetched ${reports.length} reports`);
                if (!reports || reports.length === 0) {
                    return {
                        answer: "I couldn't find any shift reports. Try uploading some reports first.",
                        suggestions: ['Upload a shift report', 'What reports do I have?'],
                    };
                }
                logger_1.Logger.info('Preparing data context...');
                const dataContext = this.prepareMultiReportContext(reports);
                logger_1.Logger.info('Calling OpenAI...'); // ADD THIS
                const response = yield this.getAIResponse(question, dataContext, conversationHistory);
                logger_1.Logger.info('OpenAI response received');
                return {
                    answer: response.answer,
                    suggestions: response.suggestions,
                    reportsUsed: reports.map((r) => r.id),
                };
            }
            if (partialQuery.queryType === 'latest') {
                // Get latest N reports
                const count = partialQuery.shiftNumber || 1;
                const reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, { limit: count });
                if (!reports || reports.length === 0) {
                    return {
                        answer: "I couldn't find any shift reports. Try uploading some reports first.",
                        suggestions: ['Upload a shift report'],
                    };
                }
                // If shift number specified, filter to that shift
                let finalReports = reports;
                if (partialQuery.shiftNumber && reports.length >= partialQuery.shiftNumber) {
                    finalReports = [reports[partialQuery.shiftNumber - 1]];
                }
                const dataContext = this.prepareMultiReportContext(finalReports);
                const response = yield this.getAIResponse(question, dataContext, conversationHistory);
                return {
                    answer: response.answer,
                    suggestions: response.suggestions,
                    reportsUsed: finalReports.map((r) => r.id),
                };
            }
            // Step 3: For specific date queries, check for ambiguity
            if (partialQuery.hasDateReference) {
                const matchingReports = yield this.findMatchingReports(storeId, partialQuery);
                logger_1.Logger.info(`Found ${matchingReports.length} matching reports`);
                if (matchingReports.length === 0) {
                    return {
                        answer: this.buildNotFoundMessage(partialQuery),
                        suggestions: [
                            'Upload a shift report',
                            'What reports do I have?',
                            'Show me all reports',
                        ],
                    };
                }
                // Check for ambiguity (multiple years, months, or shifts)
                const ambiguityCheck = this.checkAmbiguity(matchingReports, partialQuery);
                if (ambiguityCheck.isAmbiguous) {
                    // Ask for clarification
                    return yield this.generateDisambiguationResponse(question, ambiguityCheck.options);
                }
                // Single clear match - proceed with analysis
                let finalReports = matchingReports;
                // If shift number specified, filter to that shift on the matched date
                if (partialQuery.shiftNumber) {
                    finalReports = this.filterByShiftNumber(matchingReports, partialQuery.shiftNumber);
                    if (finalReports.length === 0) {
                        const dateStr = matchingReports[0].reportDate.toISOString().split('T')[0];
                        return {
                            answer: `I found ${matchingReports.length} shift(s) on ${dateStr}, but there's no ${this.ordinal(partialQuery.shiftNumber)} shift on that day.`,
                            suggestions: matchingReports.map((_, i) => `${this.ordinal(i + 1)} shift on ${dateStr}`),
                        };
                    }
                }
                const dataContext = this.prepareMultiReportContext(finalReports);
                const response = yield this.getAIResponse(question, dataContext, conversationHistory);
                return {
                    answer: response.answer,
                    suggestions: response.suggestions,
                    reportsUsed: finalReports.map((r) => r.id),
                };
            }
            // Fallback: no date reference, get latest
            const reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, { limit: 1 });
            if (!reports || reports.length === 0) {
                return {
                    answer: "I couldn't find any shift reports. Try uploading some reports first.",
                    suggestions: ['Upload a shift report'],
                };
            }
            const dataContext = this.prepareMultiReportContext(reports);
            const response = yield this.getAIResponse(question, dataContext, conversationHistory);
            return {
                answer: response.answer,
                suggestions: response.suggestions,
                reportsUsed: reports.map((r) => r.id),
            };
        });
    }
    /**
     * Detect if user is correcting previous AI response
     */
    static detectCorrection(userMessage, lastAIResponse) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = (0, chatPrompts_1.CORRECTION_DETECTION_PROMPT)(userMessage, lastAIResponse);
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                response_format: { type: 'json_object' },
            });
            const content = response.choices[0].message.content || '{}';
            try {
                return JSON.parse(content);
            }
            catch (e) {
                logger_1.Logger.error('Failed to parse correction detection', { content });
                return {
                    isCorrection: false,
                    correctedField: null,
                    oldValue: null,
                    newValue: null,
                    confidence: 0
                };
            }
        });
    }
    /**
     * Check if we already asked for verification about this field
     */
    static hasPreviousVerification(history, field) {
        // Check if we already asked "Let me verify" in the last few messages
        const recentMessages = history.slice(-4); // Last 4 messages
        return recentMessages.some(msg => msg.role === 'assistant' &&
            (msg.content.includes('Let me verify') || msg.content.includes('According to')));
    }
    /**
     * Generate verification response showing actual data
     */
    static generateVerificationResponse(storeId, correction, conversationHistory) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            // Find the report being discussed
            const lastDate = this.extractLastMentionedDate(conversationHistory);
            let reports;
            if (lastDate) {
                const dateParts = lastDate.split('-');
                const query = {
                    hasDateReference: true,
                    year: parseInt(dateParts[0]),
                    month: parseInt(dateParts[1]),
                    day: parseInt(dateParts[2]),
                    shiftNumber: null,
                    timeReference: null,
                    queryType: 'specific',
                };
                reports = yield this.findMatchingReports(storeId, query);
            }
            else {
                reports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, { limit: 1 });
            }
            if (!reports || reports.length === 0) {
                return {
                    answer: "I don't have the report data to verify. Could you upload the report?",
                    suggestions: ['Upload report', 'Show all reports'],
                };
            }
            const report = reports[0];
            const actualData = {
                date: report.reportDate.toISOString().split('T')[0],
                grossSales: (_a = report.grossSales) === null || _a === void 0 ? void 0 : _a.toNumber(),
                fuelSales: (_b = report.fuelSales) === null || _b === void 0 ? void 0 : _b.toNumber(),
                insideSales: (_c = report.insideSales) === null || _c === void 0 ? void 0 : _c.toNumber(),
                cashVariance: (_d = report.cashVariance) === null || _d === void 0 ? void 0 : _d.toNumber(),
            };
            const prompt = (0, chatPrompts_1.VERIFICATION_RESPONSE_PROMPT)(correction, actualData);
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });
            const content = response.choices[0].message.content || '{}';
            try {
                const result = JSON.parse(content);
                return {
                    answer: result.answer,
                    suggestions: result.suggestions || ['Yes, use my value', 'No, keep your data', 'Show full report'],
                    reportsUsed: [report.id],
                };
            }
            catch (e) {
                logger_1.Logger.error('Failed to parse verification response', { content });
                return {
                    answer: `I have different data. According to my records for ${actualData.date}, ${correction.correctedField} is ${correction.oldValue}. You're saying it should be ${correction.newValue}. Should I use your value?`,
                    suggestions: ['Yes, use my value', 'No, keep your data', 'Show full report'],
                    reportsUsed: [report.id],
                };
            }
        });
    }
    /**
     * Extract last mentioned date from conversation history
     */
    static extractLastMentionedDate(conversationHistory) {
        var _a, _b;
        if (!conversationHistory || conversationHistory.length === 0)
            return null;
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const text = (_b = (_a = conversationHistory[i]) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : '';
            const match = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
            if (match)
                return match[0];
        }
        return null;
    }
    /**
     * Extract partial date information from question
     */
    static extractPartialDate(question) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = (0, chatPrompts_1.PARTIAL_DATE_EXTRACTION_PROMPT)(question, new Date().toISOString().split('T')[0]);
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                response_format: { type: 'json_object' },
            });
            const content = response.choices[0].message.content || '{}';
            try {
                return JSON.parse(content);
            }
            catch (e) {
                logger_1.Logger.error('Failed to parse partial date JSON', { content });
                return {
                    hasDateReference: false,
                    year: null,
                    month: null,
                    day: null,
                    shiftNumber: null,
                    timeReference: null,
                    queryType: 'latest',
                };
            }
        });
    }
    /**
     * Find all reports matching partial date criteria
     */
    static findMatchingReports(storeId, query) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get all reports (we'll filter in memory for partial matches)
            const allReports = yield ShiftReportStorage_1.ShiftReportStorage.listByStore(storeId, { limit: 200 });
            return allReports.filter((report) => {
                const reportDate = new Date(report.reportDate);
                const reportYear = reportDate.getFullYear();
                const reportMonth = reportDate.getMonth() + 1; // 1-12
                const reportDay = reportDate.getDate();
                // Check year match
                if (query.year !== null && reportYear !== query.year)
                    return false;
                // Check month match
                if (query.month !== null && reportMonth !== query.month)
                    return false;
                // Check day match
                if (query.day !== null && reportDay !== query.day)
                    return false;
                return true;
            });
        });
    }
    /**
     * Check if matching reports are ambiguous (multiple years/dates)
     */
    static checkAmbiguity(reports, query) {
        var _a;
        const dateMap = new Map();
        // Group reports by date
        reports.forEach((report) => {
            const dateStr = report.reportDate.toISOString().split('T')[0];
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, []);
            }
            dateMap.get(dateStr).push(report);
        });
        // If only one unique date, not ambiguous
        if (dateMap.size === 1) {
            const [date, reportsOnDate] = Array.from(dateMap.entries())[0];
            return {
                isAmbiguous: false,
                options: [{
                        date,
                        shifts: reportsOnDate.length,
                        grossSales: (_a = reportsOnDate[0].grossSales) === null || _a === void 0 ? void 0 : _a.toNumber(),
                    }],
            };
        }
        // Multiple dates found - ambiguous
        const options = Array.from(dateMap.entries()).map(([date, reportsOnDate]) => {
            var _a;
            return ({
                date,
                shifts: reportsOnDate.length,
                grossSales: (_a = reportsOnDate[0].grossSales) === null || _a === void 0 ? void 0 : _a.toNumber(),
            });
        });
        return { isAmbiguous: true, options };
    }
    /**
     * Filter reports to specific shift number (1st, 2nd, etc.)
     */
    static filterByShiftNumber(reports, shiftNumber) {
        // Sort by shift start time
        const sorted = reports
            .filter((r) => r.shiftStart)
            .sort((a, b) => new Date(a.shiftStart).getTime() - new Date(b.shiftStart).getTime());
        if (sorted.length >= shiftNumber) {
            return [sorted[shiftNumber - 1]];
        }
        return [];
    }
    /**
     * Generate disambiguation question
     */
    static generateDisambiguationResponse(question, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = (0, chatPrompts_1.DISAMBIGUATION_PROMPT)(question, options);
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });
            const content = response.choices[0].message.content || '{}';
            try {
                const result = JSON.parse(content);
                return {
                    answer: result.answer,
                    suggestions: result.suggestions || [],
                };
            }
            catch (e) {
                logger_1.Logger.error('Failed to parse disambiguation response', { content });
                return {
                    answer: `I found reports on multiple dates: ${options.map((o) => o.date).join(', ')}. Which one would you like to see?`,
                    suggestions: options.map((o) => o.date),
                };
            }
        });
    }
    /**
     * Build "not found" message based on query
     */
    static buildNotFoundMessage(query) {
        const parts = [];
        if (query.month)
            parts.push(this.monthName(query.month));
        if (query.day)
            parts.push(query.day.toString());
        if (query.year)
            parts.push(query.year.toString());
        const dateStr = parts.length > 0 ? parts.join(' ') : 'that time period';
        return `I couldn't find any shift reports for ${dateStr}. Try uploading some reports first.`;
    }
    /**
     * Helper: month number to name
     */
    static monthName(month) {
        const names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return names[month] || month.toString();
    }
    /**
     * Helper: ordinal (1st, 2nd, 3rd)
     */
    static ordinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    /**
     * Prepare context from multiple reports
     */
    static prepareMultiReportContext(reports) {
        return {
            reportCount: reports.length,
            reports: reports.map((r) => {
                var _a, _b, _c, _d, _e, _f, _g;
                return ({
                    id: r.id,
                    date: r.reportDate.toISOString().split('T')[0],
                    shiftStart: (_a = r.shiftStart) === null || _a === void 0 ? void 0 : _a.toISOString(),
                    shiftEnd: (_b = r.shiftEnd) === null || _b === void 0 ? void 0 : _b.toISOString(),
                    grossSales: (_c = r.grossSales) === null || _c === void 0 ? void 0 : _c.toNumber(),
                    fuelSales: (_d = r.fuelSales) === null || _d === void 0 ? void 0 : _d.toNumber(),
                    insideSales: (_e = r.insideSales) === null || _e === void 0 ? void 0 : _e.toNumber(),
                    cashVariance: (_f = r.cashVariance) === null || _f === void 0 ? void 0 : _f.toNumber(),
                    totalTransactions: r.totalTransactions,
                    departments: (_g = r.departments) === null || _g === void 0 ? void 0 : _g.map((d) => {
                        var _a;
                        return ({
                            name: d.departmentName,
                            quantity: d.quantity,
                            amount: (_a = d.amount) === null || _a === void 0 ? void 0 : _a.toNumber(),
                        });
                    }),
                });
            }),
        };
    }
    /**
     * Get AI response
     */
    static getAIResponse(question, dataContext, conversationHistory) {
        return __awaiter(this, void 0, void 0, function* () {
            const messages = [{ role: 'system', content: chatPrompts_1.GENERAL_CHAT_SYSTEM_PROMPT }];
            if (conversationHistory && conversationHistory.length > 0) {
                messages.push(...conversationHistory);
            }
            messages.push({
                role: 'user',
                content: `Here's the shift report data:\n\n${JSON.stringify(dataContext, null, 2)}`,
            });
            messages.push({ role: 'user', content: question });
            const response = yield this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.3,
                response_format: { type: 'json_object' },
                max_tokens: 1000,
            });
            const content = response.choices[0].message.content || '{}';
            try {
                const result = JSON.parse(content);
                return {
                    answer: result.answer || "I couldn't generate a response.",
                    suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
                };
            }
            catch (e) {
                logger_1.Logger.error('Failed to parse chat response JSON', { content });
                return {
                    answer: "I couldn't generate a response.",
                    suggestions: [],
                };
            }
        });
    }
}
exports.GeneralChatService = GeneralChatService;
GeneralChatService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
