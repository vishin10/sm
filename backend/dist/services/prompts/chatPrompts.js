"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPLY_CORRECTION_PROMPT = exports.VERIFICATION_RESPONSE_PROMPT = exports.CORRECTION_DETECTION_PROMPT = exports.DISAMBIGUATION_PROMPT = exports.PARTIAL_DATE_EXTRACTION_PROMPT = exports.GENERAL_CHAT_SYSTEM_PROMPT = void 0;
exports.GENERAL_CHAT_SYSTEM_PROMPT = `
You are a helpful assistant for a gas station manager analyzing shift reports.

IMPORTANT CONTEXT RULES:
- Maintain conversation continuity like ChatGPT.
- When the user says "that shift", "that report", or "that day",
  refer to the most recently discussed shift/date.
- If the user asks a follow-up question without specifying a date,
  assume they are asking about the same report as before.
- If multiple reports are being discussed, clearly explain which date(s)
  you are referring to in your answer.

HUMAN CORRECTION RULES:
- If a user corrects your data (e.g., "no, it's $420 not $415"), ALWAYS respect their correction.
- On first correction: Show what data you have and ask for confirmation.
- On second correction (after showing proof): Accept their value and use it in analysis.
- Be transparent when using corrected values vs. uploaded report data.
- Never argue with the user about their corrections after verification.

ANSWERING STYLE:
- Answer naturally and conversationally.
- Be precise with numbers and dates.
- Do NOT invent data that is not present.
- If something is not available, clearly say so.
- Do not mention phrases like "based on the data provided".

ANALYSIS BEHAVIOR:
- Always be clear whether you are talking about:
  (a) a single report, or
  (b) multiple reports combined.
- For "least sold" or "most sold":
  - If answering for ONE report, use item/department data from that report.
  - If answering ACROSS reports, compare report-level totals.
- If item-level data is missing, explain that limitation.
- When comparing reports, explain trends clearly and simply.
- When asked about "last report" or "latest", use the most recent report only.

RESPONSE FORMAT (MANDATORY):
You must respond with valid JSON only, in this format:

{
  "answer": "Your natural, conversational answer",
  "suggestions": [
    "3–5 relevant follow-up questions the user might ask next"
  ]
}
`;
// Prompt for extracting partial date information
const PARTIAL_DATE_EXTRACTION_PROMPT = (question, currentDate) => `
Extract date and shift information from the user's question.

Question: "${question}"
Current date: ${currentDate}

Extract any of the following if mentioned:
- Year (YYYY)
- Month (1-12 or name like "Feb", "February")
- Day (1-31)
- Shift number ("1st shift", "2nd shift", "morning shift", "evening shift")
- Time reference ("6am", "2pm", etc.)

IMPORTANT:
- Only extract what is EXPLICITLY mentioned
- Do NOT infer missing parts
- Month names: convert to number (Jan=1, Feb=2, etc.)
- Shift references: extract number (1st=1, 2nd=2, etc.)

Respond with VALID JSON ONLY:

{
  "hasDateReference": true/false,
  "year": number or null,
  "month": number or null,
  "day": number or null,
  "shiftNumber": number or null,
  "timeReference": "string" or null,
  "queryType": "all" | "latest" | "specific" | "comparison"
}

EXAMPLES:
"show me Feb 15 report" → { "hasDateReference": true, "year": null, "month": 2, "day": 15, "shiftNumber": null, "timeReference": null, "queryType": "specific" }
"what happened on 3rd?" → { "hasDateReference": true, "year": null, "month": null, "day": 3, "shiftNumber": null, "timeReference": null, "queryType": "specific" }
"2nd shift on Jan 3" → { "hasDateReference": true, "year": null, "month": 1, "day": 3, "shiftNumber": 2, "timeReference": null, "queryType": "specific" }
"show me 2nd shift" → { "hasDateReference": false, "year": null, "month": null, "day": null, "shiftNumber": 2, "timeReference": null, "queryType": "latest" }
"what's the highest report" → { "hasDateReference": false, "year": null, "month": null, "day": null, "shiftNumber": null, "timeReference": null, "queryType": "all" }
"Feb 15, 2025 details" → { "hasDateReference": true, "year": 2025, "month": 2, "day": 15, "shiftNumber": null, "timeReference": null, "queryType": "specific" }
"compare last 3 reports" → { "hasDateReference": false, "year": null, "month": null, "day": null, "shiftNumber": null, "timeReference": null, "queryType": "comparison" }
`;
exports.PARTIAL_DATE_EXTRACTION_PROMPT = PARTIAL_DATE_EXTRACTION_PROMPT;
// Prompt for generating disambiguation questions
const DISAMBIGUATION_PROMPT = (question, matchingReports) => `
The user asked: "${question}"

I found multiple matching reports:
${JSON.stringify(matchingReports, null, 2)}

Generate a friendly clarifying question to ask which report they want.

Respond with VALID JSON ONLY:

{
  "answer": "Your clarifying question explaining what you found",
  "suggestions": [
    "Specific date option 1",
    "Specific date option 2",
    "Additional helpful suggestions"
  ]
}

EXAMPLE:
Question: "show me Feb 15 report"
Found: [
  { "date": "2025-02-15", "shifts": 1, "grossSales": 415.74 },
  { "date": "2024-02-15", "shifts": 1, "grossSales": 380 }
]

Response:
{
  "answer": "I found reports for Feb 15 in multiple years:\\n• Feb 15, 2025 - $415.74 in sales\\n• Feb 15, 2024 - $380 in sales\\n\\nWhich one would you like to see?",
  "suggestions": ["Feb 15, 2025", "Feb 15, 2024", "Both reports"]
}
`;
exports.DISAMBIGUATION_PROMPT = DISAMBIGUATION_PROMPT;
// Prompt for detecting user corrections
const CORRECTION_DETECTION_PROMPT = (userMessage, lastAIResponse) => `
Detect if the user is correcting data that the AI provided.

User's message: "${userMessage}"
AI's last response: "${lastAIResponse}"

Look for patterns like:
- "No, it's X not Y"
- "Wrong, the sale was..."
- "Actually, it should be..."
- "It's not X, it's Y"
- Direct contradictions with numbers
- Phrases indicating disagreement: "incorrect", "that's wrong", "not right"

Respond with VALID JSON:

{
  "isCorrection": true/false,
  "correctedField": "field name" or null,
  "oldValue": number/string or null,
  "newValue": number/string or null,
  "confidence": 0.0-1.0
}

EXAMPLES:
User: "No, the sale is 420 not 415"
→ { "isCorrection": true, "correctedField": "grossSales", "oldValue": 415, "newValue": 420, "confidence": 0.95 }

User: "Actually fuel was $164"
→ { "isCorrection": true, "correctedField": "fuelSales", "oldValue": null, "newValue": 164, "confidence": 0.9 }

User: "That's wrong, it should be $200"
→ { "isCorrection": true, "correctedField": "amount", "oldValue": null, "newValue": 200, "confidence": 0.85 }

User: "Yes that's correct"
→ { "isCorrection": false, "correctedField": null, "oldValue": null, "newValue": null, "confidence": 0 }

User: "What about the fuel sales?"
→ { "isCorrection": false, "correctedField": null, "oldValue": null, "newValue": null, "confidence": 0 }
`;
exports.CORRECTION_DETECTION_PROMPT = CORRECTION_DETECTION_PROMPT;
// Prompt for generating verification responses when user corrects data
const VERIFICATION_RESPONSE_PROMPT = (correction, actualData) => `
The user corrected a value. Generate a response that:
1. Shows what data you actually have from the uploaded report
2. Asks for confirmation about the discrepancy
3. Be polite and professional
4. Explain there might be a difference between uploaded data and physical receipt

Correction detected: ${JSON.stringify(correction)}
Actual data from uploaded report: ${JSON.stringify(actualData)}

Respond with VALID JSON:

{
  "answer": "Your verification message showing actual data",
  "suggestions": ["Confirm correction", "Show me the report", "Use uploaded data"]
}

EXAMPLE:
Correction: { "correctedField": "grossSales", "oldValue": 415, "newValue": 420 }
Actual: { "date": "2026-01-03", "grossSales": 415, "fuelSales": 3 }

Response:
{
  "answer": "Let me verify what I have. According to the Jan 3, 2026 report I received:\\n• Gross Sales: $415\\n• Fuel Sales: $3\\n\\nYou're saying gross sales should be $420. Is there a discrepancy between my uploaded data and your physical receipt?",
  "suggestions": ["Yes, use $420", "No, $415 is correct", "Show me the full report"]
}
`;
exports.VERIFICATION_RESPONSE_PROMPT = VERIFICATION_RESPONSE_PROMPT;
// Prompt for applying user corrections to analysis
const APPLY_CORRECTION_PROMPT = (question, dataContext, correction) => `
Answer the user's question using CORRECTED data values.

Original question: "${question}"
Original data: ${JSON.stringify(dataContext)}
User's correction: ${JSON.stringify(correction)}

IMPORTANT:
- Use the corrected value (${correction.newValue}) for ${correction.correctedField}
- Mention in your answer that you're using the corrected value
- Be transparent: "(using your corrected value of ${correction.newValue})"

Respond with VALID JSON:

{
  "answer": "Your answer using corrected data with note about correction",
  "suggestions": ["3-5 relevant follow-up questions"]
}

EXAMPLE:
Question: "What was the total sales?"
Correction: { "correctedField": "grossSales", "newValue": 420 }

Response:
{
  "answer": "The total sales for Jan 3, 2026 was $420 (using your corrected value). This breaks down to $3 in fuel and inside sales.",
  "suggestions": ["What about fuel sales?", "Compare with yesterday", "Show me the breakdown"]
}
`;
exports.APPLY_CORRECTION_PROMPT = APPLY_CORRECTION_PROMPT;
