import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { MealType } from '@prisma/client';

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
            orderBy: {
                mealType: 'asc',
            },
        });

        if (!menuPlan) {
            return NextResponse.json({ menuPlan: null });
        }

        // レシピ情報を構築
        const recipes = menuPlan.recipeLinks.map((rl) => ({
            name: rl.recipe.name,
            category: rl.recipe.category,
        }));

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
