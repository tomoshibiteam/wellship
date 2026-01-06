import { Recipe, RecipeCategory } from '@prisma/client';

// 曜日ルールの型
type DayRules = {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
};

// 制約の型
export type MenuConstraints = {
    excludeIngredients?: string[];
    season?: 'spring' | 'summer' | 'autumn' | 'winter';
    dailyBudgetMax?: number;
    dayRules?: DayRules;
    maxCookingTimeMinutes?: number;
};

export interface MenuPromptInput {
    recipes: { id: string; name: string; category: RecipeCategory; calories: number; protein: number; salt: number; costPerServing: number }[];
    days: number;
    crewCount: number;
    dailyBudget: number; // 1人1日あたりの予算（円）
    minBudgetUsagePercent: number; // 予算消化率の下限（%）船会社が設定
    policy: {
        dailyCalorieTarget?: number;
        dailyProteinTarget?: number;
        dailySaltMax?: number;
    };
    startDate: string;
    constraints?: MenuConstraints;
}

export interface AIGeneratedMenu {
    days: {
        date: string;
        dayLabel: string;
        breakfast: string[];
        lunch: string[];
        dinner: string[];
    }[];
}

function getSeasonalDescription(season?: string): string {
    switch (season) {
        case 'spring':
            return '春（3-5月）: 新鮮な野菜、山菜、タケノコなどを優先';
        case 'summer':
            return '夏（6-8月）: 冷たい料理、さっぱりした味付け、夏野菜を優先';
        case 'autumn':
            return '秋（9-11月）: きのこ、さんま、栗、根菜などを優先';
        case 'winter':
            return '冬（12-2月）: 温かい鍋物、煮込み料理、根菜を優先';
        default:
            return '';
    }
}

function getDayRulesDescription(dayRules?: DayRules): string {
    if (!dayRules) return '';

    const rules: string[] = [];
    if (dayRules.monday) rules.push(`- 月曜日: ${dayRules.monday}`);
    if (dayRules.tuesday) rules.push(`- 火曜日: ${dayRules.tuesday}`);
    if (dayRules.wednesday) rules.push(`- 水曜日: ${dayRules.wednesday}`);
    if (dayRules.thursday) rules.push(`- 木曜日: ${dayRules.thursday}`);
    if (dayRules.friday) rules.push(`- 金曜日: ${dayRules.friday}`);
    if (dayRules.saturday) rules.push(`- 土曜日: ${dayRules.saturday}`);
    if (dayRules.sunday) rules.push(`- 日曜日: ${dayRules.sunday}`);

    return rules.length > 0 ? rules.join('\n') : '';
}

export function buildMenuGenerationPrompt(input: MenuPromptInput): string {
    const recipeList = input.recipes.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        calories: r.calories,
        protein: r.protein,
        salt: r.salt,
        cost: r.costPerServing, // 1人前のコスト（円）
    }));

    const constraints = input.constraints || {};

    // 制約セクションを構築
    let constraintsSections = '';

    // アレルギー/禁止食材
    if (constraints.excludeIngredients?.length) {
        constraintsSections += `\n### 禁止食材（アレルギー等）
以下の食材を含むレシピは**絶対に使用しないでください**：
${constraints.excludeIngredients.map(i => `- ${i}`).join('\n')}\n`;
    }

    // 季節
    if (constraints.season) {
        constraintsSections += `\n### 季節の考慮
${getSeasonalDescription(constraints.season)}\n`;
    }

    // 曜日ルール
    const dayRulesDesc = getDayRulesDescription(constraints.dayRules);
    if (dayRulesDesc) {
        constraintsSections += `\n### 曜日ごとの特別ルール
${dayRulesDesc}\n`;
    }

    // 調理時間
    if (constraints.maxCookingTimeMinutes) {
        constraintsSections += `\n### 調理時間制約
- 1食あたりの調理時間上限: ${constraints.maxCookingTimeMinutes}分
- 時間のかかる料理は朝食を避け、夕食に回す\n`;
    }

    return `あなたは船舶の司厨のためのAI献立プランナーです。
以下の条件に基づいて、${input.days}日分の献立を生成してください。

## 基本条件
- 乗員数: ${input.crewCount}名
- 期間: ${input.days}日間（${input.startDate}から）
- 1日の目標カロリー: ${input.policy.dailyCalorieTarget || 2200}kcal
- 1日の目標タンパク質: ${input.policy.dailyProteinTarget || 70}g
- 1日の塩分上限: ${input.policy.dailySaltMax || 8}g

## 📊 予算制約
- **1人1日あたりの平均予算: ${input.dailyBudget}円**
- **期間合計予算: ${input.dailyBudget * input.days}円**（${input.days}日間×${input.dailyBudget}円）
- **最低予算消化: ${Math.floor(input.dailyBudget * input.days * input.minBudgetUsagePercent / 100)}円**（${input.minBudgetUsagePercent}%以上）
- ${input.days}日間の全レシピcost合計が**${Math.floor(input.dailyBudget * input.days * input.minBudgetUsagePercent / 100)}円以上〜${input.dailyBudget * input.days}円以下**になるようにしてください
- 安すぎる献立は船員の満足度が下がるため、予算の${input.minBudgetUsagePercent}%以上は使ってください
- 日によって豪華な日（高コスト）や節約日（低コスト）があっても構いません
${constraintsSections}
## 利用可能なレシピ（cost = 1人前のコスト）
\`\`\`json
${JSON.stringify(recipeList, null, 2)}
\`\`\`

## 基本ルール
1. 各食事（朝・昼・夕）に1〜2品を選択
2. 同じレシピは連続で使わない（最低2日空ける）
3. カテゴリのバランスを考慮（main, side, soup, rice, dessert）
4. 朝食は軽め、昼・夕食は主菜を含める
5. 栄養バランスを考慮
6. **1日の合計costが${input.dailyBudget}円以下になることを最優先**

## 出力形式
以下のJSON形式で出力してください：
\`\`\`json
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "曜日",
      "breakfast": ["recipe-id-1"],
      "lunch": ["recipe-id-1", "recipe-id-2"],
      "dinner": ["recipe-id-1", "recipe-id-2"]
    }
  ]
}
\`\`\`

JSONのみを出力し、説明は不要です。`;
}

export function validateMenuResponse(response: AIGeneratedMenu, validRecipeIds: Set<string>): boolean {
    if (!response.days || !Array.isArray(response.days)) {
        return false;
    }

    // 最低限の構造チェックのみ
    for (const day of response.days) {
        if (!day.breakfast || !day.lunch || !day.dinner) {
            return false;
        }
    }

    return true;
}

// 無効なレシピIDを有効なものに置き換える
export function fixInvalidRecipeIds(
    response: AIGeneratedMenu,
    validRecipeIds: Set<string>,
    recipeMap: Map<string, { id: string; category: string }>
): AIGeneratedMenu {
    const recipesByCategory: Map<string, string[]> = new Map();
    for (const [id, recipe] of recipeMap) {
        const category = recipe.category;
        if (!recipesByCategory.has(category)) {
            recipesByCategory.set(category, []);
        }
        recipesByCategory.get(category)!.push(id);
    }

    const fixIds = (ids: string[], mealType: 'breakfast' | 'lunch' | 'dinner'): string[] => {
        const fixed: string[] = [];
        for (const id of ids) {
            if (validRecipeIds.has(id)) {
                fixed.push(id);
            } else {
                console.warn(`⚠️ 無効なレシピID "${id}" を修正中...`);
                // IDから推測してカテゴリを決定
                const categories = mealType === 'breakfast' ? ['side'] : ['main', 'side', 'soup'];
                for (const cat of categories) {
                    const available = recipesByCategory.get(cat)?.filter(rid => !fixed.includes(rid));
                    if (available && available.length > 0) {
                        const replacement = available[Math.floor(Math.random() * available.length)];
                        fixed.push(replacement);
                        console.log(`  → "${replacement}" に置換`);
                        break;
                    }
                }
            }
        }
        return fixed;
    };

    return {
        days: response.days.map(day => ({
            ...day,
            breakfast: fixIds(day.breakfast, 'breakfast'),
            lunch: fixIds(day.lunch, 'lunch'),
            dinner: fixIds(day.dinner, 'dinner'),
        })),
    };
}
