import { NextRequest, NextResponse } from 'next/server';
import { MealType } from '@prisma/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/daily-menu?vesselId=xxx&date=2024-12-14&mealType=lunch
 * 指定日・食事タイプの献立を取得
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const vesselId = searchParams.get('vesselId');
        const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const mealType = searchParams.get('mealType') as MealType | null;

        if (!vesselId) {
            return NextResponse.json({ error: 'vesselIdが必要です' }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient();
        let query = supabase
            .from('MenuPlan')
            .select(
                'id,date,mealType,healthScore,recipeLinks:MenuPlanRecipe(recipe:Recipe(id,name,category,calories,protein,salt,costPerServing))',
            )
            .eq('vesselId', vesselId)
            .eq('date', date);
        if (mealType) {
            query = query.eq('mealType', mealType);
        }
        const { data: menuPlan, error } = await query.maybeSingle();
        if (error) {
            throw error;
        }

        if (!menuPlan) {
            return NextResponse.json({ menuPlan: null });
        }

        return NextResponse.json({
            menuPlan: {
                id: menuPlan.id,
                date: menuPlan.date,
                mealType: menuPlan.mealType,
                healthScore: menuPlan.healthScore,
                recipes: (menuPlan.recipeLinks ?? [])
                    .map((rl) => rl.recipe)
                    .filter(Boolean)
                    .map((raw) => {
                        const recipe = Array.isArray(raw) ? raw[0] : raw;
                        if (!recipe) return null;
                        return {
                            id: recipe.id,
                            name: recipe.name,
                            category: recipe.category,
                            calories: recipe.calories,
                            protein: recipe.protein,
                            salt: recipe.salt,
                            costPerServing: recipe.costPerServing,
                        };
                    })
                    .filter((r) => r !== null),
            },
        });
    } catch (error) {
        console.error('GET daily-menu error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}

/**
 * POST /api/daily-menu
 * 新規献立作成
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vesselId, date, mealType, recipeIds } = body;

        if (!vesselId || !date || !mealType) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        // 既存の献立があれば更新、なければ作成
        const supabase = await createSupabaseServerClient();
        const { data: existing, error: existingError } = await supabase
            .from('MenuPlan')
            .select('id')
            .eq('vesselId', vesselId)
            .eq('date', date)
            .eq('mealType', mealType)
            .maybeSingle();
        if (existingError) {
            throw existingError;
        }

        if (existing) {
            // 既存のリンクを削除して再作成
            await supabase
                .from('MenuPlanRecipe')
                .delete()
                .eq('menuPlanId', existing.id);

            if (recipeIds && recipeIds.length > 0) {
                const { error: insertError } = await supabase
                    .from('MenuPlanRecipe')
                    .insert(
                        recipeIds.map((recipeId: string) => ({
                            menuPlanId: existing.id,
                            recipeId,
                        })),
                    );
                if (insertError) {
                    throw insertError;
                }
            }

            return NextResponse.json({ success: true, menuPlanId: existing.id });
        }

        // 新規作成
        const { data: menuPlan, error: createError } = await supabase
            .from('MenuPlan')
            .insert({
                vesselId,
                date,
                mealType,
                healthScore: 75,
            })
            .select('id')
            .single();
        if (createError) {
            throw createError;
        }
        if (recipeIds && recipeIds.length > 0) {
            const { error: linkError } = await supabase
                .from('MenuPlanRecipe')
                .insert(
                    recipeIds.map((recipeId: string) => ({
                        menuPlanId: menuPlan.id,
                        recipeId,
                    })),
                );
            if (linkError) {
                throw linkError;
            }
        }

        return NextResponse.json({ success: true, menuPlanId: menuPlan.id });
    } catch (error) {
        console.error('POST daily-menu error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}

/**
 * PUT /api/daily-menu
 * 献立のレシピ追加/削除/入替
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { menuPlanId, action, recipeId, newRecipeId } = body;

        if (!menuPlanId || !action) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient();

        switch (action) {
            case 'add':
                if (!recipeId) {
                    return NextResponse.json({ error: 'recipeIdが必要です' }, { status: 400 });
                }
                {
                    const { error } = await supabase
                        .from('MenuPlanRecipe')
                        .insert({ menuPlanId, recipeId });
                    if (error) {
                        throw error;
                    }
                }
                break;

            case 'remove':
                if (!recipeId) {
                    return NextResponse.json({ error: 'recipeIdが必要です' }, { status: 400 });
                }
                {
                    const { error } = await supabase
                        .from('MenuPlanRecipe')
                        .delete()
                        .eq('menuPlanId', menuPlanId)
                        .eq('recipeId', recipeId);
                    if (error) {
                        throw error;
                    }
                }
                break;

            case 'replace':
                if (!recipeId || !newRecipeId) {
                    return NextResponse.json({ error: 'recipeIdとnewRecipeIdが必要です' }, { status: 400 });
                }
                {
                    const { error } = await supabase
                        .from('MenuPlanRecipe')
                        .update({ recipeId: newRecipeId })
                        .eq('menuPlanId', menuPlanId)
                        .eq('recipeId', recipeId);
                    if (error) {
                        throw error;
                    }
                }
                break;

            default:
                return NextResponse.json({ error: '不明なactionです' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT daily-menu error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
