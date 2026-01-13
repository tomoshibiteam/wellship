'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { useManagerSearchParams } from '@/components/manager/use-manager-search-params';
import { useMockQuery } from '@/components/manager/use-mock-query';
import { EmptyState, SectionCard, SeverityBadge, StatCard, StatusBadge } from '@/components/manager/manager-ui';
import { getDashboardSummary } from '@/lib/manager/data';

export default function DashboardClient() {
  const router = useRouter();
  const { scope, range } = useManagerSearchParams();
  const { data, isLoading, error, retry } = useMockQuery(
    () => getDashboardSummary(scope, range),
    [scope, range]
  );

  if (isLoading) {
    return <PageLoading message="ダッシュボードを更新中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={retry} />;
  }

  if (!data || data.vessels.length === 0) {
    return (
      <EmptyState
        title="対象船舶がありません"
        description="スコープを変更するか、船舶登録を確認してください。"
      />
    );
  }

  const { kpis, vessels, alerts, summaryText } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ダッシュボード"
        description="船隊全体の状態を俯瞰し、優先すべき船を確認します。"
        badge="Manager"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} trend={kpi.trend} />
        ))}
      </div>

      <SectionCard title="船舶一覧" description="状態の悪化している船を優先的に確認します。">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                <th className="pb-3">船名</th>
                <th className="pb-3">状態</th>
                <th className="pb-3">👍率</th>
                <th className="pb-3">回答率</th>
                <th className="pb-3">アラート</th>
                <th className="pb-3">最終更新</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((vessel) => (
                <tr
                  key={vessel.id}
                  onClick={() =>
                    router.push(
                      `/manager/vessels/${vessel.id}?scope=vessel:${vessel.id}&range=${range}`
                    )
                  }
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer border-b border-slate-100 text-slate-700 transition hover:bg-slate-50"
                >
                  <td className="py-3 font-medium text-slate-900">{vessel.name}</td>
                  <td className="py-3">
                    <StatusBadge status={vessel.status} />
                  </td>
                  <td className="py-3">{Math.round(vessel.metrics.positiveRate * 100)}%</td>
                  <td className="py-3">{Math.round(vessel.metrics.responseRate * 100)}%</td>
                  <td className="py-3">{vessel.metrics.alerts}件</td>
                  <td className="py-3 text-xs text-slate-500">
                    {new Date(vessel.metrics.lastUpdated).toLocaleString('ja-JP', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <SectionCard title="直近アラート" description="優先度の高いアラート上位5件">
          {alerts.length === 0 ? (
            <EmptyState
              title="アラートはありません"
              description="現在対応が必要なアラートはありません。"
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {alert.vesselName} · {alert.summary}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(alert.createdAt).toLocaleString('ja-JP', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-xs font-semibold text-slate-500">{alert.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="週次要約" description="直近の変化を短文で整理します。">
          <p className="text-sm leading-relaxed text-slate-600">{summaryText}</p>
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            スコープと期間を切り替えると要約も更新されます。
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
