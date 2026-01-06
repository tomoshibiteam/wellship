import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * POST /api/daily-menu/import-all-from-planning
 * AI生成された献立（複数日・複数食）を一括でカレンダーに反映
 * vesselIdがnullのMenuPlanも含めて取得し、vesselIdを設定する
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vesselId } = body;

        if (!vesselId) {
            return NextResponse.json({ error: 'vesselIdが必要です' }, { status: 400 });
        }

        // AI生成済みの献立を取得（vesselIdがnullまたは一致するもの）
        const menuPlans = await prisma.menuPlan.findMany({
            where: {
                OR: [
                    { vesselId: vesselId },
                    { vesselId: null }, // vesselIdが未設定のものも対象
                ],
                recipeLinks: {
                    some: {}, // レシピが1つ以上リンクされている
                },
            },
            include: {
                recipeLinks: true,
            },
            orderBy: {
                date: 'asc',
            },
        });

        if (menuPlans.length === 0) {
            return NextResponse.json({
                error: 'インポート可能な献立がありません。先に「献立＆調達」でAI生成してください。'
            }, { status: 404 });
        }

        // vesselIdがnullのMenuPlanにvesselIdを設定
        const nullVesselPlans = menuPlans.filter(p => p.vesselId === null);
        if (nullVesselPlans.length > 0) {
            await prisma.menuPlan.updateMany({
                where: {
                    id: {
                        in: nullVesselPlans.map(p => p.id),
                    },
                },
                data: {
                    vesselId,
                },
            });
        }

        // 日付の範囲を取得
        const dates = [...new Set(menuPlans.map(p => p.date))].sort();
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];

        // 統計情報を集計
        const mealCounts = {
            breakfast: menuPlans.filter(p => p.mealType === 'breakfast').length,
            lunch: menuPlans.filter(p => p.mealType === 'lunch').length,
            dinner: menuPlans.filter(p => p.mealType === 'dinner').length,
        };

        const totalRecipes = menuPlans.reduce((sum, p) => sum + p.recipeLinks.length, 0);

        return NextResponse.json({
            success: true,
            message: `${dates.length}日分の献立（${menuPlans.length}食）をカレンダーに追加しました`,
            details: {
                startDate,
                endDate,
                totalDays: dates.length,
                totalMeals: menuPlans.length,
                totalRecipes,
                mealCounts,
            },
        });
    } catch (error) {
        console.error('POST import-all-from-planning error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
