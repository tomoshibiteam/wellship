import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || (user.role !== 'CHEF' && user.role !== 'MANAGER')) {
            return NextResponse.json(
                { error: '権限がありません。' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const vesselId = searchParams.get('vesselId');

        // 対象船舶のフィードバックを集計
        const whereClause: {
            date: string;
            vesselId?: string;
        } = { date: dateParam };

        if (vesselId) {
            whereClause.vesselId = vesselId;
        }

        const supabase = await createSupabaseServerClient();
        let query = supabase
            .from('MealFeedback')
            .select('satisfaction,volumeFeeling,leftover');
        query = query.eq('date', whereClause.date);
        if (whereClause.vesselId) {
            query = query.eq('vesselId', whereClause.vesselId);
        }
        const { data: feedbacks } = await query;

        if (!feedbacks || feedbacks.length === 0) {
            return NextResponse.json({
                date: dateParam,
                count: 0,
                avgSatisfaction: 0,
                volumeDistribution: { less: 0, just: 0, much: 0 },
                leftoverDistribution: { none: 0, half: 0, almostAll: 0 },
            });
        }

        const count = feedbacks.length;
        const avgSatisfaction =
            feedbacks.reduce((sum, f) => sum + f.satisfaction, 0) / count;

        // 量の分布
        const volumeCounts = { less: 0, just: 0, much: 0 };
        feedbacks.forEach((f) => {
            const key = f.volumeFeeling as keyof typeof volumeCounts;
            if (key in volumeCounts) volumeCounts[key] += 1;
        });
        const volumeDistribution = {
            less: volumeCounts.less / count,
            just: volumeCounts.just / count,
            much: volumeCounts.much / count,
        };

        // 残量の分布
        const leftoverCounts = { none: 0, half: 0, almostAll: 0 };
        feedbacks.forEach((f) => {
            const key = f.leftover as keyof typeof leftoverCounts;
            if (key in leftoverCounts) leftoverCounts[key] += 1;
        });
        const leftoverDistribution = {
            none: leftoverCounts.none / count,
            half: leftoverCounts.half / count,
            almostAll: leftoverCounts.almostAll / count,
        };

        return NextResponse.json({
            date: dateParam,
            count,
            avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
            volumeDistribution,
            leftoverDistribution,
        });
    } catch (error) {
        console.error('chef feedback summary error', error);
        return NextResponse.json(
            { error: 'サマリー取得に失敗しました。' },
            { status: 500 }
        );
    }
}
