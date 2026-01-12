import { NextRequest, NextResponse } from 'next/server';
import { MealType } from '@prisma/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/daily-menu/copy-from-week
 * 先週の同曜日から献立をコピー
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vesselId, targetDate, mealType } = body;

        if (!vesselId || !targetDate || !mealType) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        // 1週間前の日付を計算
        const targetDateObj = new Date(targetDate);
        targetDateObj.setDate(targetDateObj.getDate() - 7);
        const sourceDate = targetDateObj.toISOString().slice(0, 10);

        // 先週の献立を取得
        const supabase = await createSupabaseServerClient();
        const { data: sourceMenuPlan, error: sourceError } = await supabase
            .from('MenuPlan')
            .select('id,healthScore,recipeLinks:MenuPlanRecipe(recipeId)')
            .eq('vesselId', vesselId)
            .eq('date', sourceDate)
            .eq('mealType', mealType as MealType)
            .maybeSingle();
        if (sourceError) {
            throw sourceError;
        }

        if (!sourceMenuPlan || !sourceMenuPlan.recipeLinks || sourceMenuPlan.recipeLinks.length === 0) {
            return NextResponse.json({ error: '先週の同曜日に献立が見つかりません' }, { status: 404 });
        }

        // 対象日の献立を確認
        const { data: existingPlan, error: existingError } = await supabase
            .from('MenuPlan')
            .select('id')
            .eq('vesselId', vesselId)
            .eq('date', targetDate)
            .eq('mealType', mealType as MealType)
            .maybeSingle();
        if (existingError) {
            throw existingError;
        }

        if (existingPlan) {
            // 既存の献立を上書き
            await supabase
                .from('MenuPlanRecipe')
                .delete()
                .eq('menuPlanId', existingPlan.id);

            const { error: insertError } = await supabase
                .from('MenuPlanRecipe')
                .insert(
                    sourceMenuPlan.recipeLinks.map((rl) => ({
                        menuPlanId: existingPlan.id,
                        recipeId: rl.recipeId,
                    })),
                );
            if (insertError) {
                throw insertError;
            }

            return NextResponse.json({ success: true, menuPlanId: existingPlan.id });
        }

        // 新規作成
        const { data: newPlan, error: createError } = await supabase
            .from('MenuPlan')
            .insert({
                vesselId,
                date: targetDate,
                mealType: mealType as MealType,
                healthScore: sourceMenuPlan.healthScore,
            })
            .select('id')
            .single();
        if (createError) {
            throw createError;
        }
        const { error: linkError } = await supabase
            .from('MenuPlanRecipe')
            .insert(
                sourceMenuPlan.recipeLinks.map((rl) => ({
                    menuPlanId: newPlan.id,
                    recipeId: rl.recipeId,
                })),
            );
        if (linkError) {
            throw linkError;
        }

        return NextResponse.json({ success: true, menuPlanId: newPlan.id });
    } catch (error) {
        console.error('POST copy-from-week error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
