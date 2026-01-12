import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { date, mealType, oldRecipeId, newRecipeId } = body;

    if (!date || !mealType || !oldRecipeId || !newRecipeId) {
        return NextResponse.json(
            { error: 'date / mealType / oldRecipeId / newRecipeId は必須です' },
            { status: 400 }
        );
    }

    const planId = `plan-${date}-${mealType}`;

    try {
        const supabase = await createSupabaseServerClient();
        await supabase
            .from('MenuPlanRecipe')
            .delete()
            .eq('menuPlanId', planId)
            .eq('recipeId', oldRecipeId);

        await supabase.from('MenuPlanRecipe').insert({
            menuPlanId: planId,
            recipeId: newRecipeId,
        });

        const { data: updatedPlan } = await supabase
            .from('MenuPlan')
            .select('id,date,mealType,healthScore,recipeLinks:MenuPlanRecipe(recipe:Recipe(*))')
            .eq('id', planId)
            .maybeSingle();

        return NextResponse.json({
            success: true,
            plan: updatedPlan,
        });
    } catch (error) {
        console.error('Replace error:', error);
        return NextResponse.json(
            { error: 'レシピの差し替えに失敗しました' },
            { status: 500 }
        );
    }
}
