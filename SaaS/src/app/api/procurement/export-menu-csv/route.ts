import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/procurement/export-menu-csv
 * 献立付きCSVエクスポート（日付・食事タイプ・レシピ名を含む）
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const vesselId = searchParams.get('vesselId');

        if (!startDate || !endDate) {
            return NextResponse.json({ error: '日付範囲を指定してください' }, { status: 400 });
        }

        // 該当期間の献立を取得
        const supabase = await createSupabaseServerClient();
        let query = supabase
            .from('MenuPlan')
            .select(
                'date,mealType,recipeLinks:MenuPlanRecipe(recipe:Recipe(name,category,ingredients:RecipeIngredient(amount,ingredient:Ingredient(name,unit,costPerUnit))))',
            )
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true })
            .order('mealType', { ascending: true });
        if (vesselId) {
            query = query.eq('vesselId', vesselId);
        }
        const { data: menuPlans, error } = await query;
        if (error) {
            throw error;
        }

        // CSVデータを構築
        const rows: string[] = [];

        // ヘッダー
        rows.push('日付,食事タイプ,レシピ名,カテゴリ,食材名,使用量,単位,単価');

        for (const plan of menuPlans ?? []) {
            const links = plan.recipeLinks ?? [];
            for (const link of links) {
                const recipe = Array.isArray(link.recipe) ? link.recipe[0] : link.recipe;
                if (!recipe) continue;
                const recipeIngredients = recipe.ingredients ?? [];
                if (recipeIngredients.length > 0) {
                    for (const ing of recipeIngredients) {
                        const ingredient = Array.isArray(ing.ingredient) ? ing.ingredient[0] : ing.ingredient;
                        if (!ingredient) continue;
                        rows.push([
                            plan.date,
                            plan.mealType,
                            recipe.name,
                            recipe.category,
                            ingredient.name,
                            ing.amount.toString(),
                            ingredient.unit,
                            (ingredient.costPerUnit ?? 0).toString(),
                        ].join(','));
                    }
                } else {
                    // 食材がないレシピも含める
                    rows.push([
                        plan.date,
                        plan.mealType,
                        recipe.name,
                        recipe.category,
                        '',
                        '',
                        '',
                        '',
                    ].join(','));
                }
            }
        }

        const csv = rows.join('\n');

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="menu_plan_${startDate}_${endDate}.csv"`,
            },
        });
    } catch (error) {
        console.error('Export menu CSV error:', error);
        return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 });
    }
}
