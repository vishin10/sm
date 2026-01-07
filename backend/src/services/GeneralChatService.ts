import OpenAI from 'openai';
import { Logger } from '../utils/logger';
import { ShiftReportStorage } from './ShiftReportStorage';
import {
    GENERAL_CHAT_SYSTEM_PROMPT,
    PARTIAL_DATE_EXTRACTION_PROMPT,
    DISAMBIGUATION_PROMPT,
    CORRECTION_DETECTION_PROMPT,
    VERIFICATION_RESPONSE_PROMPT,
    APPLY_CORRECTION_PROMPT,
} from './prompts/chatPrompts';

export interface GeneralChatResponse {
    answer: string;
    suggestions: string[];
    reportsUsed?: string[];
}

interface PartialDateQuery {
    hasDateReference: boolean;
    year: number | null;
    month: number | null;
    day: number | null;
    shiftNumber: number | null;
    timeReference: string | null;
    queryType: 'all' | 'latest' | 'specific' | 'comparison';
}

interface CorrectionData {
    isCorrection: boolean;
    correctedField: string | null;
    oldValue: any;
    newValue: any;
    confidence: number;
}

export class GeneralChatService {
    private static openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    /**
     * Answer general questions about shift reports with smart disambiguation and correction handling
     */
    static async askQuestion(
        storeId: string,
        question: string,
        conversationHistory?: Array<{ role: string; content: string }>
    ): Promise<GeneralChatResponse> {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API Key not configured');
        }

        Logger.info(`General chat query for store ${storeId}: "${question}"`);

        // Step 0: Check if user is correcting previous data
        if (conversationHistory && conversationHistory.length >= 2) {
            const lastAIMessage = conversationHistory[conversationHistory.length - 1];

            if (lastAIMessage.role === 'assistant') {
                const correction = await this.detectCorrection(question, lastAIMessage.content);

                if (correction.isCorrection && correction.confidence > 0.7) {
                    Logger.info('Correction detected:', correction);

                    // Check if we already verified this field
                    const alreadyVerified = this.hasPreviousVerification(
                        conversationHistory,
                        correction.correctedField || ''
                    );

                    if (!alreadyVerified) {
                        // First correction - show proof and ask for confirmation
                        return await this.generateVerificationResponse(
                            storeId,
                            correction,
                            conversationHistory
                        );
                    } else {
                        // Second time (after verification) - user is confirming, accept their correction
                        Logger.info('User confirmed correction, proceeding with corrected value');
                        // Continue with normal flow but we'll apply correction in the response
                    }
                }
            }
        }

        // Step 1: Extract partial date information
        const partialQuery = await this.extractPartialDate(question);
        Logger.info('Partial date extraction:', partialQuery);

        // Step 2: Handle different query types
        if (partialQuery.queryType === 'all' || partialQuery.queryType === 'comparison') {

            Logger.info('Fetching all reports for comparison...');
            // Fetch all reports for aggregate queries
            const reports = await ShiftReportStorage.listByStore(storeId, { limit: 50 });
            Logger.info(`Fetched ${reports.length} reports`);
            if (!reports || reports.length === 0) {
                return {
                    answer: "I couldn't find any shift reports. Try uploading some reports first.",
                    suggestions: ['Upload a shift report', 'What reports do I have?'],
                };
            }
            Logger.info('Preparing data context...');
            const dataContext = this.prepareMultiReportContext(reports);
            Logger.info('Calling OpenAI...'); // ADD THIS
            const response = await this.getAIResponse(question, dataContext, conversationHistory);
            Logger.info('OpenAI response received');
            return {
                answer: response.answer,
                suggestions: response.suggestions,
                reportsUsed: reports.map((r) => r.id),
            };
        }

        if (partialQuery.queryType === 'latest') {
            // Get latest N reports
            const count = partialQuery.shiftNumber || 1;
            const reports = await ShiftReportStorage.listByStore(storeId, { limit: count });

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
            const response = await this.getAIResponse(question, dataContext, conversationHistory);

            return {
                answer: response.answer,
                suggestions: response.suggestions,
                reportsUsed: finalReports.map((r) => r.id),
            };
        }

        // Step 3: For specific date queries, check for ambiguity
        if (partialQuery.hasDateReference) {
            const matchingReports = await this.findMatchingReports(storeId, partialQuery);
            Logger.info(`Found ${matchingReports.length} matching reports`);

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
                return await this.generateDisambiguationResponse(question, ambiguityCheck.options);
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
            const response = await this.getAIResponse(question, dataContext, conversationHistory);

            return {
                answer: response.answer,
                suggestions: response.suggestions,
                reportsUsed: finalReports.map((r) => r.id),
            };
        }

        // Fallback: no date reference, get latest
        const reports = await ShiftReportStorage.listByStore(storeId, { limit: 1 });

        if (!reports || reports.length === 0) {
            return {
                answer: "I couldn't find any shift reports. Try uploading some reports first.",
                suggestions: ['Upload a shift report'],
            };
        }

        const dataContext = this.prepareMultiReportContext(reports);
        const response = await this.getAIResponse(question, dataContext, conversationHistory);

        return {
            answer: response.answer,
            suggestions: response.suggestions,
            reportsUsed: reports.map((r) => r.id),
        };
    }

    /**
     * Detect if user is correcting previous AI response
     */
    private static async detectCorrection(
        userMessage: string,
        lastAIResponse: string
    ): Promise<CorrectionData> {
        const prompt = CORRECTION_DETECTION_PROMPT(userMessage, lastAIResponse);

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content || '{}';

        try {
            return JSON.parse(content) as CorrectionData;
        } catch (e) {
            Logger.error('Failed to parse correction detection', { content });
            return {
                isCorrection: false,
                correctedField: null,
                oldValue: null,
                newValue: null,
                confidence: 0
            };
        }
    }

    /**
     * Check if we already asked for verification about this field
     */
    private static hasPreviousVerification(
        history: Array<{ role: string; content: string }>,
        field: string
    ): boolean {
        // Check if we already asked "Let me verify" in the last few messages
        const recentMessages = history.slice(-4); // Last 4 messages
        return recentMessages.some(msg =>
            msg.role === 'assistant' &&
            (msg.content.includes('Let me verify') || msg.content.includes('According to'))
        );
    }

    /**
     * Generate verification response showing actual data
     */
    private static async generateVerificationResponse(
        storeId: string,
        correction: CorrectionData,
        conversationHistory: Array<{ role: string; content: string }>
    ): Promise<GeneralChatResponse> {
        // Find the report being discussed
        const lastDate = this.extractLastMentionedDate(conversationHistory);

        let reports: any[];
        if (lastDate) {
            const dateParts = lastDate.split('-');
            const query: PartialDateQuery = {
                hasDateReference: true,
                year: parseInt(dateParts[0]),
                month: parseInt(dateParts[1]),
                day: parseInt(dateParts[2]),
                shiftNumber: null,
                timeReference: null,
                queryType: 'specific',
            };
            reports = await this.findMatchingReports(storeId, query);
        } else {
            reports = await ShiftReportStorage.listByStore(storeId, { limit: 1 });
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
            grossSales: report.grossSales?.toNumber(),
            fuelSales: report.fuelSales?.toNumber(),
            insideSales: report.insideSales?.toNumber(),
            cashVariance: report.cashVariance?.toNumber(),
        };

        const prompt = VERIFICATION_RESPONSE_PROMPT(correction, actualData);

        const response = await this.openai.chat.completions.create({
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
        } catch (e) {
            Logger.error('Failed to parse verification response', { content });
            return {
                answer: `I have different data. According to my records for ${actualData.date}, ${correction.correctedField} is ${correction.oldValue}. You're saying it should be ${correction.newValue}. Should I use your value?`,
                suggestions: ['Yes, use my value', 'No, keep your data', 'Show full report'],
                reportsUsed: [report.id],
            };
        }
    }

    /**
     * Extract last mentioned date from conversation history
     */
    private static extractLastMentionedDate(
        conversationHistory?: Array<{ role: string; content: string }>
    ): string | null {
        if (!conversationHistory || conversationHistory.length === 0) return null;

        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const text = conversationHistory[i]?.content ?? '';
            const match = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
            if (match) return match[0];
        }

        return null;
    }

    /**
     * Extract partial date information from question
     */
    private static async extractPartialDate(question: string): Promise<PartialDateQuery> {
        const prompt = PARTIAL_DATE_EXTRACTION_PROMPT(
            question,
            new Date().toISOString().split('T')[0]
        );

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content || '{}';

        try {
            return JSON.parse(content) as PartialDateQuery;
        } catch (e) {
            Logger.error('Failed to parse partial date JSON', { content });
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
    }

    /**
     * Find all reports matching partial date criteria
     */
    private static async findMatchingReports(
        storeId: string,
        query: PartialDateQuery
    ): Promise<any[]> {
        // Get all reports (we'll filter in memory for partial matches)
        const allReports = await ShiftReportStorage.listByStore(storeId, { limit: 200 });

        return allReports.filter((report) => {
            const reportDate = new Date(report.reportDate);
            const reportYear = reportDate.getFullYear();
            const reportMonth = reportDate.getMonth() + 1; // 1-12
            const reportDay = reportDate.getDate();

            // Check year match
            if (query.year !== null && reportYear !== query.year) return false;

            // Check month match
            if (query.month !== null && reportMonth !== query.month) return false;

            // Check day match
            if (query.day !== null && reportDay !== query.day) return false;

            return true;
        });
    }

    /**
     * Check if matching reports are ambiguous (multiple years/dates)
     */
    private static checkAmbiguity(
        reports: any[],
        query: PartialDateQuery
    ): { isAmbiguous: boolean; options: Array<{ date: string; shifts: number; grossSales?: number }> } {
        const dateMap = new Map<string, any[]>();

        // Group reports by date
        reports.forEach((report) => {
            const dateStr = report.reportDate.toISOString().split('T')[0];
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, []);
            }
            dateMap.get(dateStr)!.push(report);
        });

        // If only one unique date, not ambiguous
        if (dateMap.size === 1) {
            const [date, reportsOnDate] = Array.from(dateMap.entries())[0];
            return {
                isAmbiguous: false,
                options: [{
                    date,
                    shifts: reportsOnDate.length,
                    grossSales: reportsOnDate[0].grossSales?.toNumber(),
                }],
            };
        }

        // Multiple dates found - ambiguous
        const options = Array.from(dateMap.entries()).map(([date, reportsOnDate]) => ({
            date,
            shifts: reportsOnDate.length,
            grossSales: reportsOnDate[0].grossSales?.toNumber(),
        }));

        return { isAmbiguous: true, options };
    }

    /**
     * Filter reports to specific shift number (1st, 2nd, etc.)
     */
    private static filterByShiftNumber(reports: any[], shiftNumber: number): any[] {
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
    private static async generateDisambiguationResponse(
        question: string,
        options: Array<{ date: string; shifts: number; grossSales?: number }>
    ): Promise<GeneralChatResponse> {
        const prompt = DISAMBIGUATION_PROMPT(question, options);

        const response = await this.openai.chat.completions.create({
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
        } catch (e) {
            Logger.error('Failed to parse disambiguation response', { content });
            return {
                answer: `I found reports on multiple dates: ${options.map((o) => o.date).join(', ')}. Which one would you like to see?`,
                suggestions: options.map((o) => o.date),
            };
        }
    }

    /**
     * Build "not found" message based on query
     */
    private static buildNotFoundMessage(query: PartialDateQuery): string {
        const parts: string[] = [];

        if (query.month) parts.push(this.monthName(query.month));
        if (query.day) parts.push(query.day.toString());
        if (query.year) parts.push(query.year.toString());

        const dateStr = parts.length > 0 ? parts.join(' ') : 'that time period';

        return `I couldn't find any shift reports for ${dateStr}. Try uploading some reports first.`;
    }

    /**
     * Helper: month number to name
     */
    private static monthName(month: number): string {
        const names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return names[month] || month.toString();
    }

    /**
     * Helper: ordinal (1st, 2nd, 3rd)
     */
    private static ordinal(n: number): string {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    /**
     * Prepare context from multiple reports
     */
    private static prepareMultiReportContext(reports: any[]): any {
        return {
            reportCount: reports.length,
            reports: reports.map((r) => ({
                id: r.id,
                date: r.reportDate.toISOString().split('T')[0],
                shiftStart: r.shiftStart?.toISOString(),
                shiftEnd: r.shiftEnd?.toISOString(),
                grossSales: r.grossSales?.toNumber(),
                fuelSales: r.fuelSales?.toNumber(),
                insideSales: r.insideSales?.toNumber(),
                cashVariance: r.cashVariance?.toNumber(),
                totalTransactions: r.totalTransactions,
                departments: r.departments?.map((d: any) => ({
                    name: d.departmentName,
                    quantity: d.quantity,
                    amount: d.amount?.toNumber(),
                })),
            })),
        };
    }

    /**
     * Get AI response
     */
    private static async getAIResponse(
        question: string,
        dataContext: any,
        conversationHistory?: Array<{ role: string; content: string }>
    ): Promise<{ answer: string; suggestions: string[] }> {
        const messages: any[] = [{ role: 'system', content: GENERAL_CHAT_SYSTEM_PROMPT }];

        if (conversationHistory && conversationHistory.length > 0) {
            messages.push(...conversationHistory);
        }

        messages.push({
            role: 'user',
            content: `Here's the shift report data:\n\n${JSON.stringify(dataContext, null, 2)}`,
        });

        messages.push({ role: 'user', content: question });

        const response = await this.openai.chat.completions.create({
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
        } catch (e) {
            Logger.error('Failed to parse chat response JSON', { content });
            return {
                answer: "I couldn't generate a response.",
                suggestions: [],
            };
        }
    }
}