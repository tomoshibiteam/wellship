import { NextRequest, NextResponse } from 'next/server';
import { MealType } from '@prisma/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/daily-menu/import-from-planning
 * AI生成された献立（MenuPlan）を日別献立にインポート
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vesselId, targetDate, mealType } = body;

        if (!vesselId || !targetDate || !mealType) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        // 既存のAI生成献立を検索
        const supabase = await createSupabaseServerClient();
        const { data: sourceMenuPlan, error } = await supabase
            .from('MenuPlan')
            .select('id,recipeLinks:MenuPlanRecipe(recipeId)')
            .eq('vesselId', vesselId)
            .eq('date', targetDate)
            .eq('mealType', mealType as MealType)
            .maybeSingle();
        if (error) {
            throw error;
        }

        if (!sourceMenuPlan || !sourceMenuPlan.recipeLinks || sourceMenuPlan.recipeLinks.length === 0) {
            return NextResponse.json({
                error: `${targetDate}の${mealType}には献立が設定されていません。先に「献立＆調達」でAI生成してください。`
            }, { status: 404 });
        }

        // 既に献立があれば成功（すでにインポート済み）
        return NextResponse.json({
            success: true,
            count: sourceMenuPlan.recipeLinks.length,
            message: '献立を取り込みました'
        });
    } catch (error) {
        console.error('POST import-from-planning error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
