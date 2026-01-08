import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { MealType } from '@prisma/client';

/**
 * POST /api/daily-menu/copy
 * 前日の献立をコピー
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vesselId, targetDate, mealType } = body;

        if (!vesselId || !targetDate || !mealType) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        // 前日の日付を計算
        const targetDateObj = new Date(targetDate);
        targetDateObj.setDate(targetDateObj.getDate() - 1);
        const sourceDate = targetDateObj.toISOString().slice(0, 10);

        // 前日の献立を取得
        const sourceMenuPlan = await prisma.menuPlan.findFirst({
            where: {
                vesselId,
                date: sourceDate,
                mealType: mealType as MealType,
            },
            include: {
                recipeLinks: true,
            },
        });

        if (!sourceMenuPlan || sourceMenuPlan.recipeLinks.length === 0) {
            return NextResponse.json({ error: '前日の献立が見つかりません' }, { status: 404 });
        }

        // 対象日の献立を確認
        const existingPlan = await prisma.menuPlan.findFirst({
            where: {
                vesselId,
                date: targetDate,
                mealType: mealType as MealType,
            },
        });

        if (existingPlan) {
            // 既存の献立を上書き
            await prisma.menuPlanRecipe.deleteMany({
                where: { menuPlanId: existingPlan.id },
            });

            await prisma.menuPlanRecipe.createMany({
                data: sourceMenuPlan.recipeLinks.map(rl => ({
                    menuPlanId: existingPlan.id,
                    recipeId: rl.recipeId,
                })),
            });

            return NextResponse.json({ success: true, menuPlanId: existingPlan.id });
        }

        // 新規作成
        const newPlan = await prisma.menuPlan.create({
            data: {
                vesselId,
                date: targetDate,
                mealType: mealType as MealType,
                healthScore: sourceMenuPlan.healthScore,
                recipeLinks: {
                    create: sourceMenuPlan.recipeLinks.map(rl => ({
                        recipeId: rl.recipeId,
                    })),
                },
            },
        });

        return NextResponse.json({ success: true, menuPlanId: newPlan.id });
    } catch (error) {
        console.error('POST daily-menu/copy error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
