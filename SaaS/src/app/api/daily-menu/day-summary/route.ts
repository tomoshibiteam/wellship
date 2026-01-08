import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { MealType } from '@prisma/client';

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
        const menuPlans = await prisma.menuPlan.findMany({
            where: {
                OR: [
                    { vesselId },
                    { vesselId: null },
                ],
                date,
            },
            include: {
                recipeLinks: {
                    include: {
                        recipe: {
                            include: {
                                ingredients: {
                                    include: {
                                        ingredient: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                mealType: 'asc', // breakfast, dinner, lunch → alphabetical
            },
        });

        // mealTypeごとに整理
        const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner'];
        const mealLabels: Record<MealType, string> = {
            breakfast: '朝食',
            lunch: '昼食',
            dinner: '夕食',
        };

        const meals = mealOrder.map(mealType => {
            const plan = menuPlans.find(p => p.mealType === mealType);
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

            const recipes = plan.recipeLinks.map(link => ({
                id: link.recipe.id,
                name: link.recipe.name,
                category: link.recipe.category,
                calories: link.recipe.calories,
                protein: link.recipe.protein,
                salt: link.recipe.salt,
                costPerServing: link.recipe.costPerServing,
                ingredients: link.recipe.ingredients.map(ri => ({
                    id: ri.ingredient.id,
                    name: ri.ingredient.name,
                    amount: ri.amount,
                    unit: ri.ingredient.unit,
                    storageType: ri.ingredient.storageType,
                })),
            }));

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
