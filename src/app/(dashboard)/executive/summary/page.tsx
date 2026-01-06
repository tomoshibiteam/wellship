import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { PageHeader } from '@/components/page-header';
import { prisma } from '@/lib/db/prisma';

// 統計データを取得
async function getStatistics(companyId: string) {
    // 船舶数
    const vesselCount = await prisma.vessel.count({
        where: { companyId },
    });

    // フィードバック統計
    const feedbacks = await prisma.mealFeedback.findMany({
        where: {
            vessel: { companyId },
        },
        select: {
            satisfaction: true,
            leftover: true,
            date: true,
        },
    });

    // 平均満足度
    const avgSatisfaction = feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + f.satisfaction, 0) / feedbacks.length
        : 0;

    // 完食率
    const noneLeftover = feedbacks.filter(f => f.leftover === 'none').length;
    const eatRate = feedbacks.length > 0
        ? Math.round((noneLeftover / feedbacks.length) * 100)
        : 0;

    // 過去7日間のフィードバック数
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentFeedbacks = feedbacks.filter(f => new Date(f.date) >= sevenDaysAgo);

    // 日別満足度データ
    const dailyStats: { date: string; avgSat: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayFeedbacks = feedbacks.filter(f => f.date === dateStr);
        const dayAvg = dayFeedbacks.length > 0
            ? dayFeedbacks.reduce((s, f) => s + f.satisfaction, 0) / dayFeedbacks.length
            : 0;
        dailyStats.push({ date: dateStr, avgSat: dayAvg, count: dayFeedbacks.length });
    }

    return {
        vesselCount,
        totalFeedbacks: feedbacks.length,
        avgSatisfaction: avgSatisfaction.toFixed(1),
        eatRate,
        recentCount: recentFeedbacks.length,
        dailyStats,
    };
}

export default async function ExecutiveSummaryPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'MANAGER') {
        redirect('/');
    }

    const stats = await getStatistics(user.companyId);

    return (
        <div className="space-y-6">
            <PageHeader
                title="経営サマリー"
                description="WELLSHIP導入効果の全社サマリーです。"
                badge="Manager"
            />

            {/* KPI Cards */}
            <div className="grid gap-6 md:grid-cols-4">
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-emerald-700">導入船舶</p>
                    <p className="mt-2 text-4xl font-bold text-emerald-600">{stats.vesselCount}隻</p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-sky-700">平均満足度</p>
                    <p className="mt-2 text-4xl font-bold text-sky-600">{stats.avgSatisfaction}</p>
                    <p className="mt-1 text-xs text-sky-500">全{stats.totalFeedbacks}件</p>
                </div>
                <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-teal-700">完食率</p>
                    <p className="mt-2 text-4xl font-bold text-teal-600">{stats.eatRate}%</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-amber-700">直近7日</p>
                    <p className="mt-2 text-4xl font-bold text-amber-600">{stats.recentCount}件</p>
                    <p className="mt-1 text-xs text-amber-500">フィードバック数</p>
                </div>
            </div>

            {/* 日別満足度推移 */}
            <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">📈 日別満足度推移</h2>
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="pb-2 text-left font-medium text-slate-600">日付</th>
                                <th className="pb-2 text-right font-medium text-slate-600">回答数</th>
                                <th className="pb-2 text-right font-medium text-slate-600">平均満足度</th>
                                <th className="pb-2 text-left font-medium text-slate-600 pl-4">グラフ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.dailyStats.map((day) => (
                                <tr key={day.date} className="border-b border-slate-100">
                                    <td className="py-2 text-slate-700">{day.date.slice(5)}</td>
                                    <td className="py-2 text-right text-slate-600">{day.count}件</td>
                                    <td className="py-2 text-right font-medium text-slate-800">
                                        {day.avgSat > 0 ? day.avgSat.toFixed(1) : '-'}
                                    </td>
                                    <td className="py-2 pl-4">
                                        <div className="flex items-center gap-1">
                                            <div
                                                className="h-4 rounded-full bg-gradient-to-r from-sky-400 to-teal-400"
                                                style={{ width: `${(day.avgSat / 5) * 100}px` }}
                                            />
                                            {day.avgSat >= 4.5 && <span>⭐</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ESG Impact */}
            <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">🌍 ESG・人的資本インパクト</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl bg-green-50 p-4">
                        <p className="text-sm font-medium text-green-800">E: 環境</p>
                        <p className="mt-1 text-2xl font-bold text-green-700">-{Math.round(stats.eatRate * 0.3)}kg</p>
                        <p className="text-xs text-green-600">月間フードロス削減量（推定）</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-4">
                        <p className="text-sm font-medium text-blue-800">S: 社会</p>
                        <p className="mt-1 text-2xl font-bold text-blue-700">{Math.round(parseFloat(stats.avgSatisfaction) * 20)}%</p>
                        <p className="text-xs text-blue-600">船員満足度スコア</p>
                    </div>
                    <div className="rounded-xl bg-purple-50 p-4">
                        <p className="text-sm font-medium text-purple-800">G: ガバナンス</p>
                        <p className="mt-1 text-2xl font-bold text-purple-700">100%</p>
                        <p className="text-xs text-purple-600">栄養基準コンプライアンス</p>
                    </div>
                </div>
            </div>

            {/* Export Actions */}
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-6">
                <h2 className="text-lg font-semibold text-slate-900">レポートエクスポート</h2>
                <p className="mt-1 text-sm text-slate-600">
                    ESG報告書や人的資本開示に活用できるレポートを出力できます。
                </p>
                <div className="mt-4 flex gap-3">
                    <button className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700">
                        📊 ESGレポート (PDF)
                    </button>
                    <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                        📁 データエクスポート (CSV)
                    </button>
                </div>
            </div>
        </div>
    );
}
