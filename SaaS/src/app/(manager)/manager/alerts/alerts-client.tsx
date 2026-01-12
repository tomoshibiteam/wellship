'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { useManagerSearchParams } from '@/components/manager/use-manager-search-params';
import { useMockQuery } from '@/components/manager/use-mock-query';
import { Drawer } from '@/components/manager/drawer';
import { EmptyState, SectionCard, SeverityBadge } from '@/components/manager/manager-ui';
import { getAlerts } from '@/lib/manager/data';
import type { AlertItem, AlertStatus } from '@/lib/manager/types';

const statusOptions: { label: string; value: AlertStatus }[] = [
  { label: '未対応', value: 'open' },
  { label: '対応済み', value: 'done' },
];

export default function AlertsClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { scope, range } = useManagerSearchParams();
  const statusParam = searchParams.get('status');
  const status: AlertStatus = statusParam === 'done' ? 'done' : 'open';

  const { data, isLoading, error, retry } = useMockQuery(
    () => getAlerts(scope, range, status),
    [scope, range, status]
  );

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selected, setSelected] = useState<AlertItem | null>(null);

  useEffect(() => {
    if (data) {
      setAlerts(data);
    }
  }, [data]);

  const updateStatus = (next: AlertStatus) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleToggleStatus = () => {
    if (!selected) return;
    const nextStatus: AlertStatus = selected.status === 'open' ? 'done' : 'open';
    setAlerts((prev) => prev.filter((alert) => alert.id !== selected.id));
    setSelected({ ...selected, status: nextStatus });
  };

  const statusLabel = useMemo(() => {
    return statusOptions.find((option) => option.value === status)?.label ?? '未対応';
  }, [status]);

  if (isLoading) {
    return <PageLoading message="アラートを読み込み中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={retry} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="アラート"
        description="異常検知と対応状況を一元管理します。"
        badge="Manager"
      />

      <SectionCard title="フィルタ" description="ステータスを切り替えて確認します。">
        <div className="flex gap-2">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateStatus(option.value)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                status === option.value
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={`アラート一覧（${statusLabel}）`} description="クリックで詳細を確認します。">
        {alerts.length === 0 ? (
          <EmptyState
            title="対象アラートがありません"
            description="現在の条件で表示できるアラートはありません。"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th className="pb-3">発生日</th>
                  <th className="pb-3">船舶</th>
                  <th className="pb-3">種別</th>
                  <th className="pb-3">深刻度</th>
                  <th className="pb-3">サマリー</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => setSelected(alert)}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer border-b border-slate-100 text-slate-700 transition hover:bg-slate-50"
                  >
                    <td className="py-3 text-xs text-slate-500">
                      {new Date(alert.createdAt).toLocaleString('ja-JP', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 font-medium text-slate-900">{alert.vesselName}</td>
                    <td className="py-3">{alert.type}</td>
                    <td className="py-3">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="py-3 text-slate-600">{alert.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.vesselName} | ${selected.type}` : '詳細'}
      >
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-900">{selected.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(selected.createdAt).toLocaleString('ja-JP', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500">指標</p>
              <div className="mt-2 space-y-2">
                {selected.indicators.map((indicator) => (
                  <div key={indicator.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-600">{indicator.label}</span>
                    <span className="font-semibold text-slate-900">{indicator.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500">関連理由</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500">関連レシピ</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.recipes.map((recipe) => (
                  <span key={recipe} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {recipe}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500">対応メモ</p>
              <textarea
                rows={3}
                placeholder="対応内容を記録"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleToggleStatus}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {selected.status === 'open' ? '対応済みにする' : '未対応に戻す'}
            </button>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
