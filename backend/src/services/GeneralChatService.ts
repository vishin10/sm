import OpenAI from 'openai';
import { Logger } from '../utils/logger';
import { ShiftReportStorage } from './ShiftReportStorage';

export interface GeneralChatResponse {
    answer: string;
    suggestions: string[];
    reportsUsed?: string[];
}

export class GeneralChatService {
    private static openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    /**
     * Answer general questions about shift reports
     * Handles single reports, multiple reports, comparisons, trends
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

        // Step 1: Determine what reports to fetch
        const dateQuery = await this.parseQuestion(question);

        // Step 2: Fetch relevant reports
        const reports = await this.fetchReports(storeId, dateQuery);

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
        const response = await this.getAIResponse(question, dataContext, conversationHistory);

        return {
            answer: response.answer,
            suggestions: response.suggestions,
            reportsUsed: reports.map(r => r.id)
        };
    }

    /**
     * Parse the question to determine what reports to fetch
     */
    private static async parseQuestion(question: string): Promise<DateQuery> {
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

        const response = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(response.choices[0].message.content || '{}');
        return parsed as DateQuery;
    }

    /**
     * Fetch reports based on parsed query
     */
    private static async fetchReports(storeId: string, query: DateQuery): Promise<any[]> {
        if (query.type === 'latest') {
            const reports = await ShiftReportStorage.listByStore(storeId, {
                limit: query.count || 1
            });
            return reports;
        }

        if (query.type === 'date_range') {
            const reports = await ShiftReportStorage.listByStore(storeId, {
                startDate: new Date(query.startDate!),
                endDate: new Date(query.endDate!),
                limit: 100
            });
            return reports;
        }

        if (query.type === 'specific_date') {
            const date = new Date(query.specificDate!);
            const reports = await ShiftReportStorage.listByStore(storeId, {
                startDate: date,
                endDate: date,
                limit: 10
            });
            return reports;
        }

        // type === 'all'
        const reports = await ShiftReportStorage.listByStore(storeId, {
            limit: 50
        });
        return reports;
    }

    /**
     * Prepare context from multiple reports
     */
    private static prepareMultiReportContext(reports: any[]): any {
        return {
            reportCount: reports.length,
            reports: reports.map(r => ({
                id: r.id,
                date: r.reportDate.toISOString().split('T')[0],
                grossSales: r.grossSales?.toNumber(),
                fuelSales: r.fuelSales?.toNumber(),
                insideSales: r.insideSales?.toNumber(),
                cashVariance: r.cashVariance?.toNumber(),
                totalTransactions: r.totalTransactions,
                departments: r.departments?.map((d: any) => ({
                    name: d.departmentName,
                    quantity: d.quantity,
                    amount: d.amount?.toNumber()
                }))
            }))
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

        const messages: any[] = [
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

        const response = await this.openai.chat.completions.create({
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
    }
}

interface DateQuery {
    type: 'latest' | 'date_range' | 'specific_date' | 'all';
    count?: number;
    startDate?: string;
    endDate?: string;
    specificDate?: string;
}