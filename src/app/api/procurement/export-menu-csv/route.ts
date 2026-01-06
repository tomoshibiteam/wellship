import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * GET /api/procurement/export-menu-csv
 * 献立付きCSVエクスポート（日付・食事タイプ・レシピ名を含む）
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const vesselId = searchParams.get('vesselId');

        if (!startDate || !endDate) {
            return NextResponse.json({ error: '日付範囲を指定してください' }, { status: 400 });
        }

        // 該当期間の献立を取得
        const menuPlans = await prisma.menuPlan.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
                ...(vesselId ? { vesselId } : {}),
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
            orderBy: [
                { date: 'asc' },
                { mealType: 'asc' },
            ],
        });

        // CSVデータを構築
        const rows: string[] = [];

        // ヘッダー
        rows.push('日付,食事タイプ,レシピ名,カテゴリ,食材名,使用量,単位,単価');

        for (const plan of menuPlans) {
            for (const link of plan.recipeLinks) {
                const recipe = link.recipe;
                if (recipe.ingredients.length > 0) {
                    for (const ing of recipe.ingredients) {
                        rows.push([
                            plan.date,
                            plan.mealType,
                            recipe.name,
                            recipe.category,
                            ing.ingredient.name,
                            ing.amount.toString(),
                            ing.ingredient.unit,
                            ing.ingredient.costPerUnit.toString(),
                        ].join(','));
                    }
                } else {
                    // 食材がないレシピも含める
                    rows.push([
                        plan.date,
                        plan.mealType,
                        recipe.name,
                        recipe.category,
                        '',
                        '',
                        '',
                        '',
                    ].join(','));
                }
            }
        }

        const csv = rows.join('\n');

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="menu_plan_${startDate}_${endDate}.csv"`,
            },
        });
    } catch (error) {
        console.error('Export menu CSV error:', error);
        return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 });
    }
}
