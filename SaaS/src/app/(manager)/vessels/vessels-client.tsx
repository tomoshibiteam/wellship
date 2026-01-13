'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { useManagerSearchParams } from '@/components/manager/use-manager-search-params';
import { useMockQuery } from '@/components/manager/use-mock-query';
import { EmptyState, SectionCard, StatusBadge } from '@/components/manager/manager-ui';
import { Modal } from '@/components/manager/modal';
import { getManagerVessels } from '@/lib/manager/data';
import type { Vessel } from '@/lib/manager/types';

export default function VesselsClient() {
  const { scope, range } = useManagerSearchParams();
  const { data, isLoading, error, retry } = useMockQuery(
    () => getManagerVessels(scope, range),
    [scope, range]
  );
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCrewSize, setNewCrewSize] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (data) {
      setVessels(data);
    }
  }, [data]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return vessels;
    return vessels.filter((vessel) => vessel.name.toLowerCase().includes(keyword));
  }, [query, vessels]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const newVessel: Vessel = {
      id: `vessel-${Date.now()}`,
      name: newName.trim(),
      imoNumber: 'IMO0000000',
      chefName: '未設定',
      crewSize: newCrewSize ? Number(newCrewSize) : 0,
      status: 'warn',
      metrics: {
        responseRate: 0,
        positiveRate: 0,
        negativeRate: 0,
        changeRate: 0,
        lastUpdated: new Date().toISOString(),
        alerts: 0,
      },
      note: newNote.trim() || undefined,
    };
    setVessels((prev) => [newVessel, ...prev]);
    setIsModalOpen(false);
    setNewName('');
    setNewCrewSize('');
    setNewNote('');
  };

  if (isLoading) {
    return <PageLoading message="船舶一覧を読み込み中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={retry} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="船舶（フリート）"
        description="船舶の基本情報と運用状況を一覧で確認します。"
        badge="Manager"
      />

      <SectionCard title="船舶一覧" description="担当CHEFと状態を確認し、詳細へ移動します。">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="船名で検索"
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            船舶追加
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {filtered.length === 0 ? (
            <EmptyState
              title="該当する船舶がありません"
              description="検索条件を変更するか、新しい船舶を追加してください。"
            />
          ) : (
            filtered.map((vessel) => (
              <Link
                key={vessel.id}
                href={`/manager/vessels/${vessel.id}?scope=vessel:${vessel.id}&range=${range}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{vessel.name}</p>
                    <p className="mt-1 text-xs text-slate-500">担当: {vessel.chefName}</p>
                  </div>
                  <StatusBadge status={vessel.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <p className="text-slate-400">👍率</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {Math.round(vessel.metrics.positiveRate * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">回答率</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {Math.round(vessel.metrics.responseRate * 100)}%
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </SectionCard>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="船舶追加" size="md">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            船名
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="例: 桜丸"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            乗組員規模レンジ（任意）
            <input
              type="number"
              value={newCrewSize}
              onChange={(event) => setNewCrewSize(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="例: 24"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            厨房メモ（任意）
            <textarea
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              rows={3}
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              追加する
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
