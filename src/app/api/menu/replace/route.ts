import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, mealType, oldRecipeId, newRecipeId } = body;

    if (!date || !mealType || !oldRecipeId || !newRecipeId) {
        return NextResponse.json(
            { error: 'date, mealType, oldRecipeId, and newRecipeId are required' },
            { status: 400 }
        );
    }

    const planId = `plan-${date}-${mealType}`;

    try {
        // 古いレシピを削除し、新しいレシピを追加
        await prisma.$transaction(async (tx) => {
            // 古いレシピリンクを削除
            await tx.menuPlanRecipe.deleteMany({
                where: {
                    menuPlanId: planId,
                    recipeId: oldRecipeId,
                },
            });

            // 新しいレシピリンクを追加
            await tx.menuPlanRecipe.create({
                data: {
                    menuPlanId: planId,
                    recipeId: newRecipeId,
                },
            });
        });

        // 更新後のプランを取得
        const updatedPlan = await prisma.menuPlan.findUnique({
            where: { id: planId },
            include: {
                recipeLinks: {
                    include: { recipe: true },
                },
            },
        });

        return NextResponse.json({
            success: true,
            plan: updatedPlan,
        });
    } catch (error) {
        console.error('Replace error:', error);
        return NextResponse.json(
            { error: 'Failed to replace recipe' },
            { status: 500 }
        );
    }
}
