import { NextRequest, NextResponse } from 'next/server';
import { MealType } from '@prisma/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/daily-menu/calendar?vesselId=xxx&startDate=2024-12-01&endDate=2024-12-31
 * 期間内の献立サマリーを返す（各日の朝昼晩の献立情報含む）
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const vesselId = searchParams.get('vesselId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!vesselId || !startDate || !endDate) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        // 期間内の献立を取得（レシピ情報含む）
        const supabase = await createSupabaseServerClient();
        const { data: menuPlans, error } = await supabase
            .from('MenuPlan')
            .select(
                'date,mealType,recipeLinks:MenuPlanRecipe(recipe:Recipe(name,category))',
            )
            .or(`vesselId.eq.${vesselId},vesselId.is.null`)
            .gte('date', startDate)
            .lte('date', endDate);
        if (error) {
            throw error;
        }

        // 日付ごとにサマリーを作成
        const dates: Record<string, boolean> = {};
        const summary: Record<string, {
            breakfast: { count: number; main?: string };
            lunch: { count: number; main?: string };
            dinner: { count: number; main?: string };
        }> = {};

        for (const plan of menuPlans ?? []) {
            dates[plan.date] = true;

            if (!summary[plan.date]) {
                summary[plan.date] = {
                    breakfast: { count: 0 },
                    lunch: { count: 0 },
                    dinner: { count: 0 },
                };
            }

            const mealKey = plan.mealType as MealType;
            const links = plan.recipeLinks ?? [];
            const recipeCount = links.length;
            const mainRecipe = links.find((r: any) => {
                const recipe = Array.isArray(r.recipe) ? r.recipe[0] : r.recipe;
                return recipe?.category === 'main';
            });
            const mainRecipeResolved = mainRecipe
                ? Array.isArray((mainRecipe as any).recipe)
                    ? (mainRecipe as any).recipe[0]
                    : (mainRecipe as any).recipe
                : null;

            summary[plan.date][mealKey] = {
                count: recipeCount,
                main: mainRecipeResolved?.name,
            };
        }

        return NextResponse.json({ dates, summary });
    } catch (error) {
        console.error('GET daily-menu/calendar error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
