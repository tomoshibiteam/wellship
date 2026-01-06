import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { VolumeFeeling, LeftoverAmount } from '@prisma/client';

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
        const crewMember = await prisma.crewMember.findUnique({
            where: { id: crewMemberId },
        });

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
            menuPlan = await prisma.menuPlan.findUnique({
                where: { id: menuPlanId },
            });
        }

        // 日付と食事タイプを決定
        const today = new Date().toISOString().slice(0, 10);
        const feedbackDate = menuPlan?.date || today;
        const feedbackMealType = menuPlan?.mealType || getCurrentMealType();

        // フィードバック作成
        const feedback = await prisma.mealFeedback.create({
            data: {
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
            },
        });

        return NextResponse.json({ success: true, feedbackId: feedback.id });
    } catch (error) {
        console.error('feedback submit error', error);
        return NextResponse.json(
            { error: 'フィードバックの保存に失敗しました。' },
            { status: 500 }
        );
    }
}
