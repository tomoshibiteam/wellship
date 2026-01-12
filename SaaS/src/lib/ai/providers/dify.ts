/**
 * Dify Menu Generator
 * 
 * Implements menu generation using Dify Workflow API
 */

import type { MenuGenerator, MenuGenInput, MenuGenOutput, MenuGenerationError, MenuValidationError } from './types';

type DifySeason = 'spring' | 'summer' | 'autumn' | 'winter';

function resolveSeason(value: MenuGenInput['season'], startDate: string): DifySeason {
    if (value === 'spring' || value === 'summer' || value === 'winter') {
        return value;
    }
    if (value === 'autumn') {
        return 'autumn';
    }

    const date = new Date(startDate);
    const month = Number.isNaN(date.getTime()) ? new Date().getMonth() + 1 : date.getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
}

export class DifyMenuGenerator implements MenuGenerator {
    private apiKey: string;
    private workflowUrl: string;

    constructor() {
        this.apiKey = process.env.DIFY_API_KEY || '';
        const workflowEnv = process.env.DIFY_WORKFLOW_URL;
        const baseEnv = process.env.DIFY_BASE_URL;
        const rawUrl = workflowEnv || baseEnv || '';
        const trimmedUrl = rawUrl.replace(/\/$/, '');
        this.workflowUrl = trimmedUrl.endsWith('/workflows/run')
            ? trimmedUrl
            : trimmedUrl
                ? `${trimmedUrl}/workflows/run`
                : '';

        if (!this.apiKey) {
            throw new Error('DIFY_API_KEY is not set');
        }
        if (!this.workflowUrl) {
            throw new Error('DIFY_WORKFLOW_URL or DIFY_BASE_URL is not set');
        }
    }

    async generate(input: MenuGenInput): Promise<MenuGenOutput> {
        try {
            const seasonValue = resolveSeason(input.season, input.startDate);
            const recipes =
                input.recipes ??
                (() => {
                    if (!input.recipesJson) return [];
                    try {
                        const parsed = JSON.parse(input.recipesJson);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch {
                        return [];
                    }
                })();

            const rawCookingTime =
                typeof input.cookingTimeLimit === 'number' && Number.isFinite(input.cookingTimeLimit)
                    ? Math.round(input.cookingTimeLimit)
                    : null;
            const normalizedCookingTimeLimit = rawCookingTime === null ? 240 : Math.min(240, Math.max(5, rawCookingTime));

            const buildInputs = (mode: 'typed' | 'text') => {
                if (mode === 'typed') {
                    return {
                        crew_count: input.crewCount,
                        days: input.days,
                        budget_per_person_per_day: input.budgetPerPersonPerDay,
                        min_budget_usage_percent: input.minBudgetUsagePercent,
                        start_date: input.startDate,
                        season: seasonValue,
                        cooking_time_limit: normalizedCookingTimeLimit,
                        banned_ingredients: input.bannedIngredients ?? [],
                        weekday_rules: input.weekdayRules ?? {},
                        allowed_recipe_ids: input.allowedRecipeIds ?? [],
                        recipes,
                    };
                }

                // Dify入力フォームが text-input の場合の互換モード
                return {
                    crew_count: input.crewCount,
                    days: input.days,
                    budget_per_person_per_day: input.budgetPerPersonPerDay,
                    min_budget_usage_percent: input.minBudgetUsagePercent,
                    start_date: input.startDate,
                    season: seasonValue,
                    cooking_time_limit: String(normalizedCookingTimeLimit),
                    banned_ingredients: (input.bannedIngredients ?? []).join(','),
                    weekday_rules: JSON.stringify(input.weekdayRules ?? {}),
                    allowed_recipe_ids: (input.allowedRecipeIds ?? []).join(','),
                    recipes: JSON.stringify(recipes, null, 1),
                };
            };

            const run = async (mode: 'typed' | 'text') => {
                const debugFull = process.env.DIFY_LOG_PAYLOAD === '1';
                const built = buildInputs(mode);
                if (process.env.NODE_ENV !== 'production') {
                    if (debugFull) {
                        console.log(`📤 Dify送信ペイロード（${mode}）:`, built);
                    } else {
                        const recipesCount = Array.isArray((built as any).recipes)
                            ? (built as any).recipes.length
                            : typeof (built as any).recipes === 'string'
                                ? 'string'
                                : 0;
                        console.log(`📤 Dify送信ペイロード概要（${mode}）`, {
                            crew_count: (built as any).crew_count,
                            days: (built as any).days,
                            budget_per_person_per_day: (built as any).budget_per_person_per_day,
                            min_budget_usage_percent: (built as any).min_budget_usage_percent,
                            start_date: (built as any).start_date,
                            season: (built as any).season,
                            cooking_time_limit: (built as any).cooking_time_limit,
                            banned_ingredients: (built as any).banned_ingredients,
                            weekday_rules: (built as any).weekday_rules,
                            allowed_recipe_ids:
                                Array.isArray((built as any).allowed_recipe_ids)
                                    ? { length: (built as any).allowed_recipe_ids.length }
                                    : (built as any).allowed_recipe_ids,
                            recipes: { count: recipesCount },
                        });
                    }
                }

                return fetch(this.workflowUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: buildInputs(mode),
                        response_mode: 'blocking',
                        user: 'wellship-server',
                    }),
                });
            };
            // Call Dify Workflow API
            let response = await run('typed');

            if (!response.ok) {
                const errorText = await response.text();
                // Dify側入力フォームが text-input の場合に備えて、文字列モードで1回だけリトライ
                if (response.status === 400 && /must be a string/i.test(errorText)) {
                    response = await run('text');
                } else {
                    throw new Error(`Dify API error (${response.status}): ${errorText}`);
                }
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Dify API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            // Extract output from Dify response
            // Dify response structure: { data: { outputs: { ... } } }
            const outputs = data.data?.outputs ?? data.outputs;
            if (outputs?.error && typeof outputs.error === 'string') {
                throw new Error(outputs.error);
            }
            const pickOutput = (value: any): any => {
                if (!value) return null;

                // 新フォーマットの plan 配列だけが返るケース
                if (Array.isArray(value)) {
                    const first = value[0];
                    if (first && typeof first === 'object' && ('date' in first) && ('meals' in first)) {
                        return { plan: value };
                    }
                    return null;
                }

                // 既に { days: [...] } の形
                if (typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as any).days)) {
                    return value;
                }

                // 代表的なキー
                const direct =
                    value.menu ??
                    value.menu_json ??
                    value.menuPlan ??
                    value.menu_plan ??
                    value.result ??
                    value.output ??
                    value.final ??
                    value.plan; // 強化ワークフローで plan を直に返す場合
                if (direct) return pickOutput(direct);

                // 検証ラッパーを返す場合（validation_obj / validationResult など）
                const validation =
                    value.validation_obj ??
                    value.validationResult ??
                    value.validation ??
                    value.validated_menu ??
                    value.validatedMenu;
                if (validation) {
                    return pickOutput(validation.menu ?? validation.final ?? validation.output ?? validation);
                }

                // 出力が1要素だけのobjectならそれを採用
                if (typeof value === 'object' && !Array.isArray(value)) {
                    const values = Object.values(value);
                    if (values.length === 1) {
                        return pickOutput(values[0]);
                    }
                }

                return null;
            };

            const output = pickOutput(outputs);

            if (!output) {
                if (process.env.NODE_ENV !== 'production') {
                    try {
                        const keys =
                            outputs && typeof outputs === 'object' && !Array.isArray(outputs)
                                ? Object.keys(outputs)
                                : [];
                        console.error('Dify outputs keys:', keys);
                        console.error('Dify outputs raw:', outputs);
                    } catch {
                        // noop
                    }
                }
                throw new Error('No menu output from Dify workflow');
            }

            // Validate and parse output
            const parsedOutput = this.parseAndValidate(output);

            return parsedOutput;
        } catch (error) {
            console.error('Dify menu generation error:', error);
            const err = new Error(
                `Dify menu generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            ) as MenuGenerationError;
            err.provider = 'dify';
            err.originalError = error;
            throw err;
        }
    }

    /**
     * Parse and validate Dify output
     */
    private parseAndValidate(output: unknown): MenuGenOutput {
        // If output is a string, try to parse as JSON
        let data: unknown = output;
        if (typeof output === 'string') {
            try {
                data = JSON.parse(output);
            } catch {
                throw new Error('Dify output is not valid JSON');
            }
        }

        // Validate structure
        if (!data || typeof data !== 'object') {
            const err = new Error('Dify output is not an object') as MenuValidationError;
            err.invalidData = data;
            throw err;
        }

        const weekdayJa = (dateString: string) => {
            const d = new Date(dateString);
            const day = Number.isNaN(d.getTime()) ? new Date().getDay() : d.getDay();
            return ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][day] ?? '曜日';
        };

        // 新フォーマット: { plan: [{ date, meals: { breakfast/lunch/dinner: { recipe_ids: [] } } }] }
        const obj = data as any;
        if (Array.isArray(obj.plan)) {
            return {
                days: obj.plan.map((day: any) => ({
                    date: String(day.date ?? ''),
                    dayLabel: String(day.dayLabel ?? weekdayJa(String(day.date ?? ''))),
                    breakfast: Array.isArray(day?.meals?.breakfast?.recipe_ids)
                        ? day.meals.breakfast.recipe_ids.map(String)
                        : [],
                    lunch: Array.isArray(day?.meals?.lunch?.recipe_ids)
                        ? day.meals.lunch.recipe_ids.map(String)
                        : [],
                    dinner: Array.isArray(day?.meals?.dinner?.recipe_ids)
                        ? day.meals.dinner.recipe_ids.map(String)
                        : [],
                })),
            };
        }

        const menu = data as { days?: unknown };

        if (!Array.isArray(menu.days)) {
            const err = new Error('Dify output missing "days" array') as MenuValidationError;
            err.invalidData = data;
            throw err;
        }

        // Validate each day
        for (const day of menu.days) {
            if (
                !day ||
                typeof day !== 'object' ||
                !('date' in day) ||
                !('dayLabel' in day) ||
                !('breakfast' in day) ||
                !('lunch' in day) ||
                !('dinner' in day)
            ) {
                const err = new Error('Invalid day structure in Dify output') as MenuValidationError;
                err.invalidData = day;
                throw err;
            }

            // Validate meal arrays
            const dayObj = day as MenuGenOutput['days'][0];
            if (
                !Array.isArray(dayObj.breakfast) ||
                !Array.isArray(dayObj.lunch) ||
                !Array.isArray(dayObj.dinner)
            ) {
                const err = new Error('Invalid meal arrays in Dify output') as MenuValidationError;
                err.invalidData = day;
                throw err;
            }
        }

        return menu as MenuGenOutput;
    }

    /**
     * Helper: Resolve recipe names to IDs (if Dify returns names instead of IDs)
     * This can be called from the actions layer if needed
     */
    static async resolveRecipeNames(
        menu: MenuGenOutput,
        recipeMap: Map<string, string> // name -> id mapping
    ): Promise<MenuGenOutput> {
        return {
            days: menu.days.map(day => ({
                ...day,
                breakfast: day.breakfast.map(name => recipeMap.get(name) || name),
                lunch: day.lunch.map(name => recipeMap.get(name) || name),
                dinner: day.dinner.map(name => recipeMap.get(name) || name),
            })),
        };
    }
}
