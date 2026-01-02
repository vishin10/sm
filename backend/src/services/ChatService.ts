import OpenAI from 'openai';
import { prisma } from '../config/database';
import { Logger } from '../utils/logger';

export class ChatService {
    private static openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    static async generateReply(userId: string, userMessage: string): Promise<string> {
        try {
            // 1. Fetch Context: Get recent shifts and alerts for the user's stores
            const userStores = await prisma.store.findMany({ where: { userId }, select: { id: true } });
            const storeIds = userStores.map(s => s.id);

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const [recentShifts, recentAlerts] = await Promise.all([
                prisma.shift.findMany({
                    where: { storeId: { in: storeIds }, startAt: { gte: sevenDaysAgo } },
                    orderBy: { startAt: 'desc' },
                    take: 5,
                }),
                prisma.alert.findMany({
                    where: { storeId: { in: storeIds }, createdAt: { gte: sevenDaysAgo } },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                })
            ]);

            // 2. Construct System Prompt
            const context = JSON.stringify({
                shifts: recentShifts.map((s: any) => ({
                    date: s.startAt,
                    totalSales: s.totalSales,
                    cashVariance: s.cashVariance,
                })),
                alerts: recentAlerts.map((a: any) => ({
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
            const response = await this.openai.chat.completions.create({
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

        } catch (error) {
            Logger.error('Chat Service Error', error);
            return "I'm having trouble connecting to the AI service right now.";
        }
    }
}
