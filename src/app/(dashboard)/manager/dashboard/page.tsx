import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { PageHeader } from '@/components/page-header';

export default async function ManagerDashboardPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'MANAGER') {
        redirect('/');
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="管理ダッシュボード"
                description="担当船舶のフィードバック状況をモニタリングします。"
                badge="Manager"
            />

            <div className="grid gap-6 md:grid-cols-3">
                {/* Summary Cards */}
                <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">担当船舶数</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">2</p>
                    <p className="mt-1 text-xs text-slate-500">桜丸、光丸</p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">今週のフィードバック</p>
                    <p className="mt-2 text-3xl font-bold text-sky-600">24件</p>
                    <p className="mt-1 text-xs text-green-600">+12% 先週比</p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">平均満足度</p>
                    <p className="mt-2 text-3xl font-bold text-teal-600">4.2</p>
                    <p className="mt-1 text-xs text-slate-500">5段階評価</p>
                </div>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">船舶別ステータス</h2>
                <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🚢</span>
                            <div>
                                <p className="font-medium text-slate-900">桜丸</p>
                                <p className="text-xs text-slate-500">IMO1234567</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">満足度 4.3</p>
                            <p className="text-xs text-green-600">残食率 5%</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🚢</span>
                            <div>
                                <p className="font-medium text-slate-900">光丸</p>
                                <p className="text-xs text-slate-500">IMO7654321</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">満足度 4.1</p>
                            <p className="text-xs text-amber-600">残食率 12%</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
