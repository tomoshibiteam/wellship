import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('recipeId');
    const category = searchParams.get('category');
    const vesselId = searchParams.get('vesselId');

    if (!category) {
        return NextResponse.json({ error: 'カテゴリが必要です' }, { status: 400 });
    }

    // 除外されているレシピIDを取得
    const whereConditions = [];
    whereConditions.push({ userId: user.id, scope: 'CHEF' as const });
    if (vesselId) {
        whereConditions.push({ vesselId, scope: 'VESSEL' as const });
    }

    const supabase = await createSupabaseServerClient();
    let exclusionQuery = supabase
        .from('RecipeExclusion')
        .select('recipeId');
    if (whereConditions.length === 2) {
        exclusionQuery = exclusionQuery.or(
            `and(userId.eq.${user.id},scope.eq.CHEF),and(vesselId.eq.${vesselId},scope.eq.VESSEL)`,
        );
    } else {
        exclusionQuery = exclusionQuery.eq('userId', user.id).eq('scope', 'CHEF');
    }
    const { data: userExclusions } = await exclusionQuery;

    const excludedIds = new Set((userExclusions ?? []).map((e: { recipeId: string }) => e.recipeId));
    if (recipeId) excludedIds.add(recipeId); // 現在のレシピも除外

    // 同じカテゴリの代替候補を取得
    let altQuery = supabase
        .from('Recipe')
        .select('id,name,category,calories,protein,salt,costPerServing')
        .eq('companyId', user.companyId)
        .eq('source', 'my')
        .eq('status', 'published')
        .eq('category', category as 'main' | 'side' | 'soup' | 'dessert')
        .order('protein', { ascending: false })
        .order('calories', { ascending: true })
        .limit(10);
    if (excludedIds.size > 0) {
        altQuery = altQuery.not('id', 'in', `(${Array.from(excludedIds).map((id) => `"${id}"`).join(',')})`);
    }
    const { data: alternatives } = await altQuery;

    // ヘルススコア計算（簡易版）
    const withScores = (alternatives ?? []).map(recipe => {
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
