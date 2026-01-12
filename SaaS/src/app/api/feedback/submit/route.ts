import { NextResponse } from 'next/server';
import { VolumeFeeling, LeftoverAmount } from '@prisma/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// 現在の食事タイプを推定
function getCurrentMealType(): 'breakfast' | 'lunch' | 'dinner' {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    return 'dinner';
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            crewMemberId,
            menuPlanId,
            satisfaction,
            volumeFeeling,
            leftover,
            photoUrl,
            reasonTags,
        } = body;

        // バリデーション
        if (!crewMemberId) {
            return NextResponse.json(
                { error: '船員IDが指定されていません。' },
                { status: 400 }
            );
        }

        if (!satisfaction || satisfaction < 1 || satisfaction > 5) {
            return NextResponse.json(
                { error: '満足度を選択してください。' },
                { status: 400 }
            );
        }

        if (!leftover) {
            return NextResponse.json(
                { error: '残食量を選択してください。' },
                { status: 400 }
            );
        }

        // 船員の存在確認
        const supabase = await createSupabaseServerClient();
        const { data: crewMember } = await supabase
            .from('CrewMember')
            .select('id,vesselId')
            .eq('id', crewMemberId)
            .maybeSingle();

        if (!crewMember) {
            return NextResponse.json(
                { error: '船員が見つかりません。' },
                { status: 404 }
            );
        }

        // メニュープランの取得（ダミーの場合はnull）
        const isDummyMenu = !menuPlanId || menuPlanId === 'dummy-menu';
        let menuPlan = null;

        if (!isDummyMenu) {
            const { data } = await supabase
                .from('MenuPlan')
                .select('id,date,mealType')
                .eq('id', menuPlanId)
                .maybeSingle();
            menuPlan = data ?? null;
        }

        // 日付と食事タイプを決定
        const today = new Date().toISOString().slice(0, 10);
        const feedbackDate = menuPlan?.date || today;
        const feedbackMealType = menuPlan?.mealType || getCurrentMealType();

        // フィードバック作成
        const { data: feedback, error } = await supabase
            .from('MealFeedback')
            .insert({
                date: feedbackDate,
                mealType: feedbackMealType,
                satisfaction,
                volumeFeeling: (volumeFeeling as VolumeFeeling) || 'just',
                leftover: leftover as LeftoverAmount,
                comment: null,
                photoUrl: photoUrl || null,
                reasonTags: reasonTags || null,
                menuPlanId: menuPlan?.id ?? null,
                vesselId: crewMember.vesselId,
                crewMemberId,
            })
            .select('id')
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, feedbackId: feedback.id });
    } catch (error) {
        console.error('feedback submit error', error);
        return NextResponse.json(
            { error: 'フィードバックの保存に失敗しました。' },
            { status: 500 }
        );
    }
}
