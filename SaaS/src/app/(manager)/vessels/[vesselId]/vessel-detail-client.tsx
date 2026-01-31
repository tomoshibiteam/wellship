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
  { id: 'crew', label: '船員管理' },
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

  // Crew management state
  const [crewMembers, setCrewMembers] = useState<Array<{ id: string; name: string; cardCode: string }>>([]);
  const [isLoadingCrew, setIsLoadingCrew] = useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [isAddingCrew, setIsAddingCrew] = useState(false);

  const detail = useMemo(() => data, [data]);
  useEffect(() => {
    if (detail) {
      setNote(detail.notes);
    }
  }, [detail]);

  // Fetch crew members when crew tab is active
  useEffect(() => {
    if (activeTab === 'crew') {
      fetchCrewMembers();
    }
  }, [activeTab, vesselId]);

  const fetchCrewMembers = async () => {
    setIsLoadingCrew(true);
    try {
      const res = await fetch(`/api/crew/list?vesselId=${vesselId}`);
      if (res.ok) {
        const data = await res.json();
        setCrewMembers(data.crewMembers || []);
      }
    } catch (error) {
      console.error('Failed to fetch crew members:', error);
    } finally {
      setIsLoadingCrew(false);
    }
  };

  const handleAddCrew = async () => {
    if (!newCrewName.trim()) return;

    setIsAddingCrew(true);
    try {
      const res = await fetch('/api/crew/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vesselId,
          name: newCrewName.trim(),
        }),
      });

      if (res.ok) {
        setNewCrewName('');
        await fetchCrewMembers();
      }
    } catch (error) {
      console.error('Failed to add crew member:', error);
    } finally {
      setIsAddingCrew(false);
    }
  };

  const handleDeleteCrew = async (crewId: string) => {
    if (!confirm('この船員を削除しますか？')) return;

    try {
      const res = await fetch('/api/crew/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewId }),
      });

      if (res.ok) {
        await fetchCrewMembers();
      }
    } catch (error) {
      console.error('Failed to delete crew member:', error);
    }
  };

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
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${activeTab === tab.id
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

      {activeTab === 'crew' && (
        <SectionCard title="船員管理" description="この船舶に所属する船員を管理します。">
          <div className="space-y-4">
            {/* Add crew form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newCrewName}
                onChange={(e) => setNewCrewName(e.target.value)}
                placeholder="船員名を入力"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCrew();
                  }
                }}
              />
              <button
                onClick={handleAddCrew}
                disabled={!newCrewName.trim() || isAddingCrew}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isAddingCrew ? '追加中...' : '追加'}
              </button>
            </div>

            {/* Crew list */}
            {isLoadingCrew ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                読み込み中...
              </div>
            ) : crewMembers.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <p className="text-sm text-amber-700">
                  ⚠️ 船員が登録されていません。<br />
                  <span className="text-xs text-amber-600">上のフォームから船員を追加してください。</span>
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {crewMembers.map((crew) => (
                  <div
                    key={crew.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg">
                        👤
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{crew.name}</p>
                        <p className="text-xs text-slate-500">ID: {crew.cardCode}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCrew(crew.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-500">
              💡 ヒント: 船員を追加すると、司厨側のフィードバック画面で選択できるようになります。
            </p>
          </div>
        </SectionCard>
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
