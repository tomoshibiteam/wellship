import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

export function getGeminiModel(): GenerativeModel {
    if (!model) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
    return model;
}

export async function generateWithGemini(prompt: string): Promise<string> {
    const model = getGeminiModel();

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        return text;
    } catch (error) {
        console.error('Gemini API error:', error);
        throw error;
    }
}

export async function generateWithGeminiJSON<T>(prompt: string): Promise<T> {
    const model = getGeminiModel();

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // JSONブロックを抽出
        const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonString = jsonMatch ? jsonMatch[1] : text;

        // 余分な空白やコメントを除去
        const cleaned = jsonString.trim();

        return JSON.parse(cleaned) as T;
    } catch (error) {
        console.error('Gemini API JSON parse error:', error);
        throw error;
    }
}

export function isGeminiConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
}
