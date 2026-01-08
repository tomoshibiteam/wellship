import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { MealType } from '@prisma/client';

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

        const menuPlan = await prisma.menuPlan.findFirst({
            where: {
                vesselId,
                date,
                ...(mealType ? { mealType } : {}),
            },
            include: {
                recipeLinks: {
                    include: {
                        recipe: true,
                    },
                },
            },
        });

        if (!menuPlan) {
            return NextResponse.json({ menuPlan: null });
        }

        return NextResponse.json({
            menuPlan: {
                id: menuPlan.id,
                date: menuPlan.date,
                mealType: menuPlan.mealType,
                healthScore: menuPlan.healthScore,
                recipes: menuPlan.recipeLinks.map(rl => ({
                    id: rl.recipe.id,
                    name: rl.recipe.name,
                    category: rl.recipe.category,
                    calories: rl.recipe.calories,
                    protein: rl.recipe.protein,
                    salt: rl.recipe.salt,
                    costPerServing: rl.recipe.costPerServing,
                })),
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
        const existing = await prisma.menuPlan.findFirst({
            where: { vesselId, date, mealType },
        });

        if (existing) {
            // 既存のリンクを削除して再作成
            await prisma.menuPlanRecipe.deleteMany({
                where: { menuPlanId: existing.id },
            });

            if (recipeIds && recipeIds.length > 0) {
                await prisma.menuPlanRecipe.createMany({
                    data: recipeIds.map((recipeId: string) => ({
                        menuPlanId: existing.id,
                        recipeId,
                    })),
                });
            }

            return NextResponse.json({ success: true, menuPlanId: existing.id });
        }

        // 新規作成
        const menuPlan = await prisma.menuPlan.create({
            data: {
                vesselId,
                date,
                mealType,
                healthScore: 75,
                recipeLinks: {
                    create: (recipeIds || []).map((recipeId: string) => ({
                        recipeId,
                    })),
                },
            },
        });

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

        switch (action) {
            case 'add':
                if (!recipeId) {
                    return NextResponse.json({ error: 'recipeIdが必要です' }, { status: 400 });
                }
                await prisma.menuPlanRecipe.create({
                    data: { menuPlanId, recipeId },
                });
                break;

            case 'remove':
                if (!recipeId) {
                    return NextResponse.json({ error: 'recipeIdが必要です' }, { status: 400 });
                }
                await prisma.menuPlanRecipe.deleteMany({
                    where: { menuPlanId, recipeId },
                });
                break;

            case 'replace':
                if (!recipeId || !newRecipeId) {
                    return NextResponse.json({ error: 'recipeIdとnewRecipeIdが必要です' }, { status: 400 });
                }
                await prisma.menuPlanRecipe.updateMany({
                    where: { menuPlanId, recipeId },
                    data: { recipeId: newRecipeId },
                });
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
