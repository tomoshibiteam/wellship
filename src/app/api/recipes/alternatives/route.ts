import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('recipeId');
    const category = searchParams.get('category');
    const vesselId = searchParams.get('vesselId');

    if (!category) {
        return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    // 除外されているレシピIDを取得
    const whereConditions = [];
    whereConditions.push({ userId: session.user.id, scope: 'CHEF' as const });
    if (vesselId) {
        whereConditions.push({ vesselId, scope: 'VESSEL' as const });
    }

    const userExclusions = await prisma.recipeExclusion.findMany({
        where: { OR: whereConditions },
        select: { recipeId: true },
    });

    const excludedIds = new Set(userExclusions.map((e: { recipeId: string }) => e.recipeId));
    if (recipeId) excludedIds.add(recipeId); // 現在のレシピも除外

    // 同じカテゴリの代替候補を取得
    const alternatives = await prisma.recipe.findMany({
        where: {
            category: category as 'main' | 'side' | 'soup' | 'dessert',
            id: { notIn: Array.from(excludedIds) as string[] },
        },
        orderBy: [
            { protein: 'desc' },
            { calories: 'asc' },
        ],
        take: 10,
    });

    // ヘルススコア計算（簡易版）
    const withScores = alternatives.map(recipe => {
        const score = Math.round(
            50 +
            (recipe.protein / 30) * 20 +
            (1 - recipe.salt / 5) * 15 +
            (recipe.calories < 600 ? 15 : recipe.calories < 800 ? 10 : 5)
        );
        return {
            ...recipe,
            healthScore: Math.min(100, Math.max(0, score)),
        };
    });

    // スコア順にソート
    withScores.sort((a, b) => b.healthScore - a.healthScore);

    return NextResponse.json({ alternatives: withScores });
}
