'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { EmptyState, SectionCard, StatCard, StatusBadge } from '@/components/manager/manager-ui';
import { useManagerSearchParams } from '@/components/manager/use-manager-search-params';
import { useMockQuery } from '@/components/manager/use-mock-query';
import { getVesselDetail } from '@/lib/manager/data';

const tabs = [
  { id: 'overview', label: '概要' },
  { id: 'owners', label: '担当者' },
  { id: 'notes', label: 'メモ' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function VesselDetailClient({ vesselId }: { vesselId: string }) {
  const { range } = useManagerSearchParams();
  const { data, isLoading, error, retry } = useMockQuery(
    () => getVesselDetail(vesselId, range),
    [vesselId, range]
  );
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const detail = useMemo(() => data, [data]);
  useEffect(() => {
    if (detail) {
      setNote(detail.notes);
    }
  }, [detail]);

  if (isLoading) {
    return <PageLoading message="船舶詳細を読み込み中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={retry} />;
  }

  if (!detail) {
    return (
      <EmptyState
        title="船舶情報が見つかりません"
        description="指定した船舶が存在しないか、権限がありません。"
      />
    );
  }

  const vessel = detail.vessel;

  const handleSaveNote = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`船舶詳細: ${vessel.name}`}
        description="運用の異常原因と担当者情報を確認します。"
        badge="Manager"
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">{vessel.name}</p>
              <p className="mt-1 text-xs text-slate-500">IMO: {vessel.imoNumber}</p>
              <p className="mt-2 text-xs text-slate-500">担当CHEF: {vessel.chefName}</p>
            </div>
            <StatusBadge status={vessel.status} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="👍率" value={`${Math.round(vessel.metrics.positiveRate * 100)}%`} trend="前週比 +1pt" />
            <StatCard label="回答率" value={`${Math.round(vessel.metrics.responseRate * 100)}%`} trend="前週比 -2pt" />
            <StatCard label="当日変更率" value={`${Math.round(vessel.metrics.changeRate * 100)}%`} trend="前週比 +3pt" />
          </div>

          <SectionCard title="不満理由 TOP5" description="改善に直結する要因を優先整理します。">
            <ol className="space-y-2 text-sm">
              {detail.reasons.map((reason) => (
                <li key={reason.reason} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-800">{reason.reason}</span>
                  <span className="text-xs text-slate-500">{Math.round(reason.rate * 100)}% ({reason.count}件)</span>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard title="ワーストレシピ TOP5" description="不満が集中したレシピを確認します。">
            <ol className="space-y-2 text-sm">
              {detail.recipes.map((recipe) => (
                <li key={recipe.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-800">{recipe.name}</span>
                  <span className="text-xs text-slate-500">👎 {Math.round(recipe.negativeRate * 100)}% / {recipe.responses}件</span>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      )}

      {activeTab === 'owners' && (
        <SectionCard title="担当者" description="現在の担当CHEFを表示します。">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{vessel.chefName}</p>
              <p className="mt-1 text-xs text-slate-500">担当船舶: {vessel.name}</p>
            </div>
            <p className="text-xs text-slate-500">担当変更は Settings / Users から実施してください。</p>
          </div>
        </SectionCard>
      )}

      {activeTab === 'notes' && (
        <SectionCard title="本部メモ" description="現場に共有する前の内部メモです。">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-[160px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">更新はローカル保存（MVP）</span>
            <button
              type="button"
              onClick={handleSaveNote}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {saved ? '保存済み' : '保存'}
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
