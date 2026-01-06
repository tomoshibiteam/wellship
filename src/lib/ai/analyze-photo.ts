import { getGeminiModel } from './gemini';
import * as fs from 'fs';
import * as path from 'path';

export interface PhotoAnalysisResult {
    leftoverPercent: 0 | 25 | 50 | 75 | 100;
    leftoverLevel: '少' | '中' | '多' | 'ほぼ全部';
    confidence: 'low' | 'medium' | 'high';
    note: string | null;
}

interface GeminiAnalysisResponse {
    leftoverPercent: number;
    leftoverLevel: string;
    confidence: string;
    note: string;
}

/**
 * 残食写真をGeminiで分析して残食割合を推定する
 * @param photoPath 写真のパス（/uploads/feedback/xxx.jpg形式）
 * @param menuContext 献立情報（精度向上用）
 */
export async function analyzeLeftoverPhoto(
    photoPath: string,
    menuContext: string
): Promise<PhotoAnalysisResult> {
    const model = getGeminiModel();

    // 画像ファイルを読み込む
    const absolutePath = path.join(process.cwd(), 'public', photoPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Photo not found: ${absolutePath}`);
    }

    const imageBuffer = fs.readFileSync(absolutePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = photoPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const prompt = `あなたは船上食堂の残食分析AIです。
食事の写真を見て、残食の割合を推定してください。

## 献立情報
${menuContext}

## 分析ルール
1. 皿に残っている食べ物の量を見て、残食割合を推定
2. 元の量が分からない場合は、一般的な1人前を基準に判断
3. 画像が暗い、皿が隠れているなどの問題があれば注意メモに記載

## 出力形式（JSON）
\`\`\`json
{
  "leftoverPercent": 0,  // 0, 25, 50, 75, 100 のいずれか
  "leftoverLevel": "少",  // "少", "中", "多", "ほぼ全部" のいずれか
  "confidence": "high",  // "low", "medium", "high" のいずれか
  "note": ""  // 注意メモ（問題があれば記載、なければ空文字）
}
\`\`\`

## 対応表
- 0%（残食なし）→ leftoverLevel: "少"（実質空）
- 25%（少し残っている）→ leftoverLevel: "少"
- 50%（半分残っている）→ leftoverLevel: "中"
- 75%（かなり残っている）→ leftoverLevel: "多"
- 100%（ほぼ全部残っている）→ leftoverLevel: "ほぼ全部"

写真を分析して、JSON形式で回答してください。`;

    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: base64Image,
                },
            },
            { text: prompt },
        ]);

        const response = result.response;
        const text = response.text();

        // JSONブロックを抽出
        const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonString = jsonMatch ? jsonMatch[1] : text;
        const parsed: GeminiAnalysisResponse = JSON.parse(jsonString.trim());

        // バリデーションと正規化
        const validPercents = [0, 25, 50, 75, 100] as const;
        const validLevels = ['少', '中', '多', 'ほぼ全部'] as const;
        const validConfidences = ['low', 'medium', 'high'] as const;

        const leftoverPercent = validPercents.includes(parsed.leftoverPercent as typeof validPercents[number])
            ? parsed.leftoverPercent as typeof validPercents[number]
            : 50; // デフォルト

        const leftoverLevel = validLevels.includes(parsed.leftoverLevel as typeof validLevels[number])
            ? parsed.leftoverLevel as typeof validLevels[number]
            : '中'; // デフォルト

        const confidence = validConfidences.includes(parsed.confidence as typeof validConfidences[number])
            ? parsed.confidence as typeof validConfidences[number]
            : 'low'; // デフォルト

        return {
            leftoverPercent,
            leftoverLevel,
            confidence,
            note: parsed.note || null,
        };
    } catch (error) {
        console.error('Gemini photo analysis error:', error);
        throw error;
    }
}

/**
 * 献立情報からコンテキスト文字列を生成
 */
export function buildMenuContext(recipes: { name: string; category: string }[]): string {
    if (recipes.length === 0) {
        return '献立情報なし';
    }
    return recipes.map(r => `- ${r.name}（${r.category}）`).join('\n');
}
