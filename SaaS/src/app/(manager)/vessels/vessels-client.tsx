'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { useManagerSearchParams } from '@/components/manager/use-manager-search-params';
import { EmptyState, SectionCard, StatusBadge } from '@/components/manager/manager-ui';
import { Modal } from '@/components/manager/modal';

type VesselSummary = {
  id: string;
  name: string;
  imoNumber?: string | null;
  budgetPerDay?: number | null;
  chefNames: string[];
  status: 'ok' | 'warn';
};

export default function VesselsClient() {
  const { range } = useManagerSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vessels, setVessels] = useState<VesselSummary[]>([]);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newImo, setNewImo] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/manager/vessels');
        if (!res.ok) throw new Error('船舶一覧の取得に失敗しました。');
        const json = await res.json();
        const mapped = (json?.vessels ?? []).map((v: any) => ({
          id: String(v.id),
          name: v.name,
          imoNumber: v.imoNumber ?? null,
          budgetPerDay: v.budgetPerDay ?? null,
          chefNames: v.chefNames ?? [],
          status: (v.chefNames ?? []).length > 0 ? 'ok' : 'warn',
        }));
        if (isMounted) setVessels(mapped);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : '読み込みに失敗しました。');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return vessels;
    return vessels.filter((vessel) => vessel.name.toLowerCase().includes(keyword));
  }, [query, vessels]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/manager/vessels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          imoNumber: newImo.trim() || null,
          budgetPerDay: newBudget ? Number(newBudget) : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || '追加に失敗しました。');
      const vessel = json?.vessel;
      const newVessel: VesselSummary = {
        id: vessel.id,
        name: vessel.name,
        imoNumber: vessel.imoNumber ?? null,
        budgetPerDay: vessel.budgetPerDay ?? null,
        chefNames: [],
        status: 'warn',
      };
      setVessels((prev) => [newVessel, ...prev]);
      setIsModalOpen(false);
      setNewName('');
      setNewImo('');
      setNewBudget('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <PageLoading message="船舶一覧を読み込み中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={() => window.location.reload()} />;
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
                    <p className="mt-1 text-xs text-slate-500">
                      担当: {vessel.chefNames.length > 0 ? vessel.chefNames.join(', ') : '未設定'}
                    </p>
                  </div>
                  <StatusBadge status={vessel.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <p className="text-slate-400">IMO</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {vessel.imoNumber ?? '未登録'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">予算/日</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {vessel.budgetPerDay ? `¥${vessel.budgetPerDay.toLocaleString()}` : '未設定'}
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
            IMO番号（任意）
            <input
              type="text"
              value={newImo}
              onChange={(event) => setNewImo(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="例: IMO1234567"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            予算/日（任意）
            <input
              type="number"
              value={newBudget}
              onChange={(event) => setNewBudget(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="例: 1400"
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
              disabled={isSaving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? '追加中...' : '追加する'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
