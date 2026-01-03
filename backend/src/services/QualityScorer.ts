import { Logger } from '../utils/logger';

export interface QualityScoreResult {
    score: number;          // 0-100
    extractedText: string;
    analysis: {
        textLength: number;
        moneyPatternCount: number;
        keywordHits: number;
        weirdCharRatio: number;
    };
    recommendation: 'accept_ocr' | 'use_openai_text' | 'use_openai_vision';
}

// Keywords we expect in shift reports
const SHIFT_KEYWORDS = [
    'total', 'sales', 'net', 'gross', 'fuel', 'gallons', 'gal',
    'cash', 'card', 'credit', 'debit', 'tender', 'payment',
    'over', 'short', 'variance', 'drawer',
    'shift', 'register', 'pos', 'report',
    'tax', 'discount', 'refund', 'void',
    'inside', 'store', 'merchandise', 'grocery',
    'transaction', 'customer', 'count'
];

export class QualityScorer {
    /**
     * Score the quality of OCR-extracted text
     * Returns a score from 0-100 and a recommendation
     */
    static scoreOCROutput(text: string): QualityScoreResult {
        const analysis = {
            textLength: text.length,
            moneyPatternCount: this.countMoneyPatterns(text),
            keywordHits: this.countKeywordHits(text),
            weirdCharRatio: this.calculateWeirdCharRatio(text),
        };

        let score = 0;

        // Text length scoring (max 25 points)
        if (analysis.textLength > 500) score += 25;
        else if (analysis.textLength > 300) score += 20;
        else if (analysis.textLength > 200) score += 15;
        else if (analysis.textLength > 100) score += 10;
        else if (analysis.textLength > 50) score += 5;

        // Money pattern scoring (max 30 points)
        if (analysis.moneyPatternCount >= 10) score += 30;
        else if (analysis.moneyPatternCount >= 5) score += 25;
        else if (analysis.moneyPatternCount >= 3) score += 20;
        else if (analysis.moneyPatternCount >= 1) score += 10;

        // Keyword hits scoring (max 30 points)
        if (analysis.keywordHits >= 10) score += 30;
        else if (analysis.keywordHits >= 7) score += 25;
        else if (analysis.keywordHits >= 5) score += 20;
        else if (analysis.keywordHits >= 3) score += 15;
        else if (analysis.keywordHits >= 1) score += 5;

        // Weird character penalty (max -15 points)
        if (analysis.weirdCharRatio > 0.3) score -= 15;
        else if (analysis.weirdCharRatio > 0.2) score -= 10;
        else if (analysis.weirdCharRatio > 0.1) score -= 5;

        // Ensure score is within bounds
        score = Math.max(0, Math.min(100, score));

        // Determine recommendation
        let recommendation: 'accept_ocr' | 'use_openai_text' | 'use_openai_vision';
        if (score >= 70) {
            recommendation = 'accept_ocr';
        } else if (score >= 40) {
            recommendation = 'use_openai_text';
        } else {
            recommendation = 'use_openai_vision';
        }

        Logger.info(`OCR Quality Score: ${score} - Recommendation: ${recommendation}`, analysis);

        return { score, extractedText: text, analysis, recommendation };
    }

    private static countMoneyPatterns(text: string): number {
        // Match patterns like $123.45, 123.45, $1,234.56
        const moneyRegex = /\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;
        const matches = text.match(moneyRegex) || [];
        return matches.length;
    }

    private static countKeywordHits(text: string): number {
        const lowerText = text.toLowerCase();
        return SHIFT_KEYWORDS.filter(keyword => lowerText.includes(keyword)).length;
    }

    private static calculateWeirdCharRatio(text: string): number {
        if (text.length === 0) return 1;

        // Normal characters: letters, numbers, common punctuation, whitespace
        const normalChars = text.match(/[a-zA-Z0-9\s.,\-:$%\/\\()\[\]#@&*+='"!?<>]/g) || [];
        return 1 - (normalChars.length / text.length);
    }
}
