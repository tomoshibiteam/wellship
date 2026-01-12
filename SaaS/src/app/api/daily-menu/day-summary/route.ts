import { NextRequest, NextResponse } from 'next/server';
import { MealType } from '@prisma/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/daily-menu/day-summary?vesselId=xxx&date=2024-12-15
 * 指定日の朝昼晩すべての献立と、使用する食材一覧を取得
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const vesselId = searchParams.get('vesselId');
        const date = searchParams.get('date');

        if (!vesselId || !date) {
            return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
        }

        // 1日の全食事を取得（vesselIdがnullまたは一致するもの）
        const supabase = await createSupabaseServerClient();
        const { data: menuPlans, error } = await supabase
            .from('MenuPlan')
            .select(
                'date,mealType,recipeLinks:MenuPlanRecipe(recipe:Recipe(id,name,category,calories,protein,salt,costPerServing,ingredients:RecipeIngredient(amount,ingredient:Ingredient(id,name,unit,storageType))))',
            )
            .or(`vesselId.eq.${vesselId},vesselId.is.null`)
            .eq('date', date)
            .order('mealType', { ascending: true });
        if (error) {
            throw error;
        }

        // mealTypeごとに整理
        const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner'];
        const mealLabels: Record<MealType, string> = {
            breakfast: '朝食',
            lunch: '昼食',
            dinner: '夕食',
        };

        type DaySummaryIngredient = {
            id: string;
            name: string;
            amount: number;
            unit: string;
            storageType: string;
        };

        type DaySummaryRecipe = {
            id: string;
            name: string;
            category: string;
            calories: number;
            protein: number;
            salt: number;
            costPerServing: number;
            ingredients: DaySummaryIngredient[];
        };

        const meals = mealOrder.map(mealType => {
            const plan = (menuPlans ?? []).find(p => p.mealType === mealType);
            if (!plan) {
                return {
                    mealType,
                    label: mealLabels[mealType],
                    recipes: [],
                    totalCalories: 0,
                    totalProtein: 0,
                    totalSalt: 0,
                    totalCost: 0,
                };
            }

            const recipes: DaySummaryRecipe[] = (plan.recipeLinks ?? [])
                .map((link) => link.recipe)
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
                        ingredients: (recipe.ingredients ?? [])
                            .map((ri) => {
                                const ingredient = Array.isArray(ri.ingredient) ? ri.ingredient[0] : ri.ingredient;
                                if (!ingredient) return null;
                                return {
                                    id: ingredient.id,
                                    name: ingredient.name,
                                    amount: ri.amount,
                                    unit: ingredient.unit,
                                    storageType: ingredient.storageType,
                                };
                            })
                            .filter((ing): ing is DaySummaryIngredient => ing !== null),
                    };
                })
                .filter((r): r is DaySummaryRecipe => r !== null);

            return {
                mealType,
                label: mealLabels[mealType],
                recipes,
                totalCalories: recipes.reduce((sum, r) => sum + r.calories, 0),
                totalProtein: recipes.reduce((sum, r) => sum + r.protein, 0),
                totalSalt: recipes.reduce((sum, r) => sum + r.salt, 0),
                totalCost: recipes.reduce((sum, r) => sum + r.costPerServing, 0),
            };
        });

        // 日全体の集計
        const dailyTotals = {
            calories: meals.reduce((sum, m) => sum + m.totalCalories, 0),
            protein: meals.reduce((sum, m) => sum + m.totalProtein, 0),
            salt: meals.reduce((sum, m) => sum + m.totalSalt, 0),
            cost: meals.reduce((sum, m) => sum + m.totalCost, 0),
        };

        // 使用する食材一覧を集計
        const ingredientMap = new Map<string, { name: string; amount: number; unit: string; storageType: string }>();
        for (const meal of meals) {
            for (const recipe of meal.recipes) {
                for (const ing of recipe.ingredients) {
                    const existing = ingredientMap.get(ing.id);
                    if (existing) {
                        existing.amount += ing.amount;
                    } else {
                        ingredientMap.set(ing.id, {
                            name: ing.name,
                            amount: ing.amount,
                            unit: ing.unit,
                            storageType: ing.storageType,
                        });
                    }
                }
            }
        }

        const ingredients = Array.from(ingredientMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({
            date,
            meals,
            dailyTotals,
            ingredients,
        });
    } catch (error) {
        console.error('GET day-summary error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
