import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { recipeId, scope, reason, vesselId } = body;

    if (!recipeId || !scope || !reason) {
        return NextResponse.json(
            { error: 'recipeId / scope / reason は必須です' },
            { status: 400 }
        );
    }

    if (!['CHEF', 'VESSEL'].includes(scope)) {
        return NextResponse.json(
            { error: 'scope は CHEF または VESSEL である必要があります' },
            { status: 400 }
        );
    }

    try {
        const data: {
            recipeId: string;
            scope: 'CHEF' | 'VESSEL';
            reason: string;
            userId?: string;
            vesselId?: string;
        } = {
            recipeId,
            scope: scope as 'CHEF' | 'VESSEL',
            reason,
        };

        if (scope === 'CHEF') {
            data.userId = user.id;
        } else if (scope === 'VESSEL') {
            if (!vesselId) {
                return NextResponse.json(
                    { error: 'VESSELスコープでは vesselId が必要です' },
                    { status: 400 }
                );
            }
            data.vesselId = vesselId;
        }

        // upsertで重複を防ぐ
        const supabase = await createSupabaseServerClient();
        const conflictTarget = scope === 'CHEF' ? 'recipeId,userId,scope' : 'recipeId,vesselId,scope';
        const { data: exclusion, error } = await supabase
            .from('RecipeExclusion')
            .upsert(data, { onConflict: conflictTarget })
            .select('*')
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, exclusion });
    } catch (error) {
        console.error('Exclusion error:', error);
        return NextResponse.json(
            { error: '除外設定の作成に失敗しました' },
            { status: 500 }
        );
    }
}

// 除外一覧取得
export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get('vesselId');

    const whereConditions = [];
    whereConditions.push({ userId: user.id, scope: 'CHEF' as const });
    if (vesselId) {
        whereConditions.push({ vesselId, scope: 'VESSEL' as const });
    }

    const supabase = await createSupabaseServerClient();
    let query = supabase
        .from('RecipeExclusion')
        .select('id,recipeId,scope,reason,createdAt,recipe:Recipe(id,name,category)')
        .order('createdAt', { ascending: false });

    if (whereConditions.length === 2) {
        query = query.or(
            `and(userId.eq.${user.id},scope.eq.CHEF),and(vesselId.eq.${vesselId},scope.eq.VESSEL)`,
        );
    } else {
        query = query.eq('userId', user.id).eq('scope', 'CHEF');
    }

    const { data: exclusions } = await query;

    return NextResponse.json({ exclusions: exclusions ?? [] });
}
