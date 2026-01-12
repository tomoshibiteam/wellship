import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/daily-menu/import-all-from-planning
 * AI生成された献立（複数日・複数食）を一括でカレンダーに反映
 * vesselIdがnullのMenuPlanも含めて取得し、vesselIdを設定する
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vesselId } = body;

        if (!vesselId) {
            return NextResponse.json({ error: 'vesselIdが必要です' }, { status: 400 });
        }

        // AI生成済みの献立を取得（vesselIdがnullまたは一致するもの）
        const supabase = await createSupabaseServerClient();
        const { data: menuPlans, error } = await supabase
            .from('MenuPlan')
            .select('id,date,mealType,vesselId,recipeLinks:MenuPlanRecipe(id)')
            .or(`vesselId.eq.${vesselId},vesselId.is.null`)
            .order('date', { ascending: true });
        if (error) {
            throw error;
        }

        const menuPlansWithRecipes = (menuPlans ?? []).filter(
            (plan) => (plan.recipeLinks?.length ?? 0) > 0,
        );

        if (menuPlansWithRecipes.length === 0) {
            return NextResponse.json({
                error: 'インポート可能な献立がありません。先に「献立＆調達」でAI生成してください。'
            }, { status: 404 });
        }

        // vesselIdがnullのMenuPlanにvesselIdを設定
        const nullVesselPlans = menuPlansWithRecipes.filter(p => p.vesselId === null);
        if (nullVesselPlans.length > 0) {
            const { error: updateError } = await supabase
                .from('MenuPlan')
                .update({ vesselId })
                .in('id', nullVesselPlans.map(p => p.id));
            if (updateError) {
                throw updateError;
            }
        }

        // 日付の範囲を取得
        const dates = [...new Set(menuPlansWithRecipes.map(p => p.date))].sort();
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];

        // 統計情報を集計
        const mealCounts = {
            breakfast: menuPlansWithRecipes.filter(p => p.mealType === 'breakfast').length,
            lunch: menuPlansWithRecipes.filter(p => p.mealType === 'lunch').length,
            dinner: menuPlansWithRecipes.filter(p => p.mealType === 'dinner').length,
        };

        const totalRecipes = menuPlansWithRecipes.reduce((sum, p) => sum + (p.recipeLinks?.length ?? 0), 0);

        return NextResponse.json({
            success: true,
            message: `${dates.length}日分の献立（${menuPlansWithRecipes.length}食）をカレンダーに追加しました`,
            details: {
                startDate,
                endDate,
                totalDays: dates.length,
                totalMeals: menuPlansWithRecipes.length,
                totalRecipes,
                mealCounts,
            },
        });
    } catch (error) {
        console.error('POST import-all-from-planning error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
