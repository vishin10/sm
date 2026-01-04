import OpenAI from 'openai';
import { Logger } from '../utils/logger';
import { ShiftReportStorage } from './ShiftReportStorage';

export interface ChatResponse {
    answer: string;
    suggestions: string[];
    relatedData?: any;
}

/**
 * Natural language chat service for shift report analytics
 * Works like ChatGPT - conversational, helpful, with suggestions
 */
export class ShiftReportChatService {
    private static openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    /**
     * System prompt for natural conversational analytics
     */
    private static readonly CHAT_SYSTEM_PROMPT = `You are an AI assistant helping a gas station/convenience store manager analyze their shift reports.

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

    /**
     * Answer a natural language question about a shift report
     */
    static async askQuestion(
        reportId: string,
        question: string,
        conversationHistory?: Array<{ role: string; content: string }>
    ): Promise<ChatResponse> {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API Key not configured');
        }

        // Get the full report data
        const report = await ShiftReportStorage.getForChat(reportId);
        if (!report) {
            throw new Error('Report not found');
        }

        // Prepare data context
        const dataContext = this.prepareDataContext(report);

        // Build messages
        const messages: any[] = [
            {
                role: "system",
                content: this.CHAT_SYSTEM_PROMPT
            },
            {
                role: "user",
                content: `Here's the shift report data:\n\n${JSON.stringify(dataContext, null, 2)}`
            },
        ];

        // Add conversation history if provided
        if (conversationHistory && conversationHistory.length > 0) {
            messages.push(...conversationHistory);
        }

        // Add current question
        messages.push({
            role: "user",
            content: question
        });

        Logger.info(`Chat query: "${question}" for report ${reportId}`);

        const response = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.7, // Slightly higher for natural conversation
            response_format: { type: "json_object" },
            max_tokens: 1000,
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error('No response from OpenAI');

        const result = JSON.parse(content);

        Logger.info(`Chat response generated with ${result.suggestions?.length || 0} suggestions`);

        return {
            answer: result.answer || 'I could not generate a response.',
            suggestions: result.suggestions || [],
            relatedData: result.relatedData || null
        };
    }

    /**
     * Prepare comprehensive data context for AI
     * Uses FULL extraction if available, falls back to database fields
     */
    private static prepareDataContext(report: any): any {
        // If we have the full AI extraction, use that (most complete)
        if (report.fullExtraction) {
            return {
                reportDate: report.reportDate?.toISOString().split('T')[0],
                storeName: report.store?.name,

                // Include EVERYTHING from AI extraction
                ...report.fullExtraction,

                // Also include database-structured data for convenience
                departments: report.departments?.map((d: any) => ({
                    name: d.departmentName,
                    quantity: d.quantity,
                    amount: d.amount?.toNumber()
                })),

                items: report.items?.map((i: any) => ({
                    name: i.itemName,
                    sku: i.sku,
                    quantity: i.quantity,
                    amount: i.amount?.toNumber()
                })),

                exceptions: report.exceptions?.map((e: any) => ({
                    type: e.type,
                    count: e.count,
                    amount: e.amount?.toNumber()
                }))
            };
        }

        // Fallback: use database fields only
        return {
            reportDate: report.reportDate?.toISOString().split('T')[0],
            storeName: report.store?.name,
            shiftInfo: {
                registerId: report.registerId,
                operatorId: report.operatorId,
                tillId: report.tillId,
                shiftStart: report.shiftStart?.toISOString(),
                shiftEnd: report.shiftEnd?.toISOString(),
            },
            financial: {
                grossSales: report.grossSales?.toNumber(),
                netSales: report.netSales?.toNumber(),
                tax: report.taxTotal?.toNumber(),
                refunds: report.refunds?.toNumber(),
                discounts: report.discounts?.toNumber(),
                totalTransactions: report.totalTransactions,
            },
            cash: {
                beginningBalance: report.beginningBalance?.toNumber(),
                endingBalance: report.endingBalance?.toNumber(),
                expected: report.closingAccountability?.toNumber(),
                actual: report.cashierCounted?.toNumber(),
                variance: report.cashVariance?.toNumber(),
            },
            fuel: {
                sales: report.fuelSales?.toNumber(),
                gross: report.fuelGross?.toNumber(),
                gallons: report.fuelGallons?.toNumber(),
            },
            inside: {
                sales: report.insideSales?.toNumber(),
                merchandise: report.merchandiseSales?.toNumber(),
                prepaysInitiated: report.prepaysInitiated?.toNumber(),
                prepaysPumped: report.prepaysPumped?.toNumber(),
            },
            tenders: {
                cash: { count: report.cashCount, amount: report.cashAmount?.toNumber() },
                credit: { count: report.creditCount, amount: report.creditAmount?.toNumber() },
                debit: { count: report.debitCount, amount: report.debitAmount?.toNumber() },
                check: { count: report.checkCount, amount: report.checkAmount?.toNumber() },
                total: report.totalTenders?.toNumber(),
            },
            safe: {
                drops: { count: report.safeDropCount, amount: report.safeDropAmount?.toNumber() },
                loans: { count: report.safeLoanCount, amount: report.safeLoanAmount?.toNumber() },
                paidIn: { count: report.paidInCount, amount: report.paidInAmount?.toNumber() },
                paidOut: { count: report.paidOutCount, amount: report.paidOutAmount?.toNumber() },
            },
            departments: report.departments?.map((d: any) => ({
                name: d.departmentName,
                quantity: d.quantity,
                amount: d.amount?.toNumber()
            })),
            items: report.items?.map((i: any) => ({
                name: i.itemName,
                sku: i.sku,
                quantity: i.quantity,
                amount: i.amount?.toNumber()
            })),
            exceptions: report.exceptions?.map((e: any) => ({
                type: e.type,
                count: e.count,
                amount: e.amount?.toNumber()
            }))
        };
    }

    /**
     * Generate automatic insights for a report
     */
    static async generateInsights(reportId: string): Promise<string[]> {
        const report = await ShiftReportStorage.getForChat(reportId);
        if (!report) return [];

        const dataContext = this.prepareDataContext(report);

        const response = await this.openai.chat.completions.create({
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
        if (!content) return [];

        // Parse bullet points
        const insights = content
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
            .map(line => line.replace(/^[-•]\s*/, '').trim())
            .filter(Boolean);

        return insights;
    }
}