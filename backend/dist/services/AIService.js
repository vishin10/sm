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
exports.AIService = void 0;
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../utils/logger");
class AIService {
    static extractStructuredData(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!process.env.OPENAI_API_KEY) {
                    throw new Error('OpenAI API Key not configured');
                }
                const response = yield this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are a data extraction assistant. You only output valid JSON." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0,
                    response_format: { type: "json_object" }
                });
                const content = response.choices[0].message.content;
                if (!content)
                    throw new Error('No content from OpenAI');
                return JSON.parse(content);
            }
            catch (error) {
                logger_1.Logger.error('AI Service Error', error);
                throw error;
            }
        });
    }
}
exports.AIService = AIService;
AIService.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
