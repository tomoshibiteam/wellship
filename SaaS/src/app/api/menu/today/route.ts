import { NextResponse } from 'next/server';
import { MealType } from '@prisma/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const vesselId = searchParams.get('vesselId');
        const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const mealType = searchParams.get('mealType') as MealType | null;

        if (!vesselId) {
            return NextResponse.json(
                { error: '船舶IDが指定されていません。' },
                { status: 400 }
            );
        }

        // 今日のメニュープランを取得
        const supabase = await createSupabaseServerClient();
        let query = supabase
            .from('MenuPlan')
            .select('id,date,mealType,recipeLinks:MenuPlanRecipe(recipe:Recipe(name,category))')
            .eq('vesselId', vesselId)
            .eq('date', date)
            .order('mealType', { ascending: true });
        if (mealType) {
            query = query.eq('mealType', mealType);
        }
        const { data: menuPlan } = await query.maybeSingle();

        if (!menuPlan) {
            return NextResponse.json({ menuPlan: null });
        }

        // レシピ情報を構築
        const recipes = (menuPlan.recipeLinks ?? [])
            .map((rl) => rl.recipe)
            .filter(Boolean)
            .map((raw) => {
                const recipe = Array.isArray(raw) ? raw[0] : raw;
                if (!recipe) return null;
                return {
                    name: recipe.name,
                    category: recipe.category,
                };
            })
            .filter((r) => r !== null);

        const recipeNames = recipes.map((r) => r.name);
        const menuName = recipeNames.length > 0
            ? recipeNames.join('・')
            : '本日のメニュー';

        return NextResponse.json({
            menuPlan: {
                id: menuPlan.id,
                name: menuName,
                date: menuPlan.date,
                mealType: menuPlan.mealType,
                recipes,
            },
        });
    } catch (error) {
        console.error('menu today error', error);
        return NextResponse.json(
            { error: 'メニュー取得に失敗しました。' },
            { status: 500 }
        );
    }
}
