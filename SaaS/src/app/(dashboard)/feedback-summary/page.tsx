import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { features } from "@/lib/config/features";
import { createSupabaseServerClient } from "@/lib/supabase/server";


export default async function ChefFeedbackSummaryPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'CHEF') {
        redirect('/login');
    }

    // 司厨が担当する船舶を取得
    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase
        .from("UserVesselMembership")
        .select("vessel:Vessel(id)")
        .eq("userId", user.id)
        .maybeSingle();

    if (!membership) {
        redirect('/planning');
    }

    const vessel = Array.isArray(membership.vessel)
        ? membership.vessel[0]
        : membership.vessel;
    const vesselId = vessel?.id;
    const today = new Date().toISOString().slice(0, 10);

    // 過去7日間のフィードバックを取得
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().slice(0, 10);

    const { data: feedbacksRaw } = await supabase
        .from("MealFeedback")
        .select("id,date,mealType,satisfaction,volumeFeeling,leftover,comment,photoUrl,createdAt")
        .eq("vesselId", vesselId ?? "")
        .gte("date", startDate)
        .lte("date", today);

    const feedbacks = feedbacksRaw ?? [];

    // 統計計算
    const totalCount = feedbacks.length;
    const avgSatisfaction = totalCount > 0
        ? feedbacks.reduce((sum, f) => sum + f.satisfaction, 0) / totalCount
        : 0;
    const completeEatRate = totalCount > 0
        ? feedbacks.filter(f => f.leftover === 'none').length / totalCount
        : 0;
    const justRightRate = totalCount > 0
        ? feedbacks.filter(f => f.volumeFeeling === 'just').length / totalCount
        : 0;

    // ポジティブなコメントのみ抽出（高評価のもの）
    const positiveComments = feedbacks
        .filter(f => f.satisfaction >= 4 && f.comment && f.comment.trim().length > 0)
        .map(f => f.comment!)
        .slice(0, 5);

    // 励みになるメッセージを生成
    const encouragingMessage = getEncouragingMessage(avgSatisfaction, completeEatRate);

    return (
        <div className="space-y-6">
            <PageHeader
                title="みんなの声"
                description="船員の皆さんからの温かいフィードバック"
                badge="感謝"
            />

            <div className="grid gap-6 lg:grid-cols-2">
                {/* 励みになるメッセージ */}
                <div className="lg:col-span-2">
                    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-teal-50 p-8 text-center shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white text-5xl shadow-lg">
                            {avgSatisfaction >= 4 ? '🌟' : avgSatisfaction >= 3 ? '😊' : '💪'}
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            {encouragingMessage.title}
                        </h2>
                        <p className="mt-3 text-lg text-slate-600">
                            {encouragingMessage.message}
                        </p>
                    </div>
                </div>

                {/* 喜びの指標 */}
                <div className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">
                        🍽️ みんなの満足度
                    </h3>
                    <div className="space-y-4">
                        <div className="rounded-xl bg-green-50 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-green-800">完食してくれた率</span>
                                <span className="text-2xl font-bold text-green-700">
                                    {Math.round(completeEatRate * 100)}%
                                </span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-green-100">
                                <div
                                    className="h-full rounded-full bg-green-500"
                                    style={{ width: `${completeEatRate * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="rounded-xl bg-sky-50 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sky-800">量がちょうどよかった率</span>
                                <span className="text-2xl font-bold text-sky-700">
                                    {Math.round(justRightRate * 100)}%
                                </span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
                                <div
                                    className="h-full rounded-full bg-sky-500"
                                    style={{ width: `${justRightRate * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    <p className="mt-4 text-center text-sm text-slate-500">
                        過去7日間のフィードバック {totalCount}件
                    </p>
                </div>

                {/* 嬉しい声 */}
                <div className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">
                        💬 嬉しい声
                    </h3>
                    {positiveComments.length > 0 ? (
                        <div className="space-y-3">
                            {positiveComments.map((comment, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
                                >
                                    <span className="mr-2">✨</span>
                                    {comment}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl bg-slate-50 p-6 text-center">
                            <p className="text-slate-500">
                                まだコメントがありません。<br />
                                毎日の料理が皆さんの力になっています！
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* 応援メッセージ */}
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-center">
                <p className="text-teal-800">
                    🙏 いつも美味しい食事をありがとうございます。これからも頑張ってください！
                </p>
            </div>

            {/* フィードバック一覧（AI分析結果付き） */}
            <div className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                    📋 フィードバック一覧
                </h3>
                {feedbacks.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {feedbacks
                            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                            .slice(0, 20)
                            .map((f) => (
                                <div
                                    key={f.id}
                                    className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="text-2xl">
                                                {f.satisfaction >= 4 ? '😊' : f.satisfaction >= 3 ? '🙂' : f.satisfaction >= 2 ? '😐' : '😔'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-slate-800">
                                                        {f.date} {f.mealType === 'breakfast' ? '朝食' : f.mealType === 'lunch' ? '昼食' : '夕食'}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        ⭐ {f.satisfaction}
                                                    </span>
                                                    {features.photoFeedback && f.photoUrl && (
                                                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-600">📷</span>
                                                    )}
                                                </div>
                                                <div className="mt-0.5 flex gap-2 text-xs text-slate-500">
                                                    <span>量: {f.volumeFeeling === 'less' ? '少ない' : f.volumeFeeling === 'just' ? 'ちょうど' : '多い'}</span>
                                                    <span>|</span>
                                                    <span>{f.leftover === 'none' ? '完食' : f.leftover === 'half' ? '半分残し' : 'ほぼ残し'}</span>
                                                </div>
                                                {f.comment && (
                                                    <p className="mt-1 text-xs text-slate-600 italic">
                                                        &quot;{f.comment}&quot;
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            ))}
                    </div>
                ) : (
                    <div className="rounded-xl bg-slate-50 p-6 text-center">
                        <p className="text-slate-500">
                            まだフィードバックがありません。
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function getEncouragingMessage(avgSatisfaction: number, completeEatRate: number): { title: string; message: string } {
    if (avgSatisfaction >= 4 && completeEatRate >= 0.7) {
        return {
            title: '素晴らしい！大好評です！',
            message: '皆さんとても喜んでいます。あなたの料理は船員の活力の源です。',
        };
    }
    if (avgSatisfaction >= 3.5) {
        return {
            title: 'いい調子です！',
            message: '皆さんに喜ばれています。この調子で頑張ってください。',
        };
    }
    if (avgSatisfaction >= 3) {
        return {
            title: '感謝されています',
            message: '毎日の食事を楽しみにしている方がたくさんいます。',
        };
    }
    return {
        title: 'いつもありがとうございます',
        message: '皆さんのためにいつも頑張ってくださってありがとうございます。',
    };
}
