import OpenAI from 'openai';
import { Logger } from '../utils/logger';

export class AIService {
    private static openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    static async extractStructuredData(prompt: string): Promise<any> {
        try {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API Key not configured');
            }

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a data extraction assistant. You only output valid JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0,
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error('No content from OpenAI');

            return JSON.parse(content);
        } catch (error) {
            Logger.error('AI Service Error', error);
            throw error;
        }
    }
}
