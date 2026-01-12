'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { useMockQuery } from '@/components/manager/use-mock-query';
import { Drawer } from '@/components/manager/drawer';
import { EmptyState, SectionCard } from '@/components/manager/manager-ui';
import { getCrewMembers } from '@/lib/manager/data';
import { mockVessels } from '@/lib/manager/mock-data';
import type { CrewMember } from '@/lib/manager/types';

const dietOptions = ['甲殻類NG', '乳製品NG', '卵NG', '宗教: 豚肉NG', '減塩', '辛味控えめ'];

export default function CrewClient() {
  const searchParams = useSearchParams();
  const vesselId = searchParams.get('vesselId') || '';
  const vesselName = useMemo(
    () => mockVessels.find((vessel) => vessel.id === vesselId)?.name ?? '',
    [vesselId]
  );

  const { data, isLoading, error, retry } = useMockQuery(
    () => (vesselId ? getCrewMembers(vesselId) : []),
    [vesselId]
  );

  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [selected, setSelected] = useState<CrewMember | null>(null);

  useEffect(() => {
    if (data) {
      setCrew(data);
    }
  }, [data]);

  const updateCrew = (updated: CrewMember) => {
    setCrew((prev) => prev.map((member) => (member.id === updated.id ? updated : member)));
    setSelected(updated);
  };

  if (!vesselId) {
    return (
      <EmptyState
        title="船舶を選択してください"
        description="ヘッダーの船舶セレクタで対象船舶を選ぶとクルー一覧が表示されます。"
      />
    );
  }

  if (isLoading) {
    return <PageLoading message="クルー情報を読み込み中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={retry} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="クルー管理"
        description="NFCカード紐付けと食制約の管理を行います。"
        badge="Manager"
      />

      <SectionCard
        title={`クルー一覧 (${vesselName})`}
        description="カード紐付けと食制約の状態を確認できます。"
      >
        {crew.length === 0 ? (
          <EmptyState
            title="クルーが登録されていません"
            description="カード登録やクルー追加を確認してください。"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th className="pb-3">識別子</th>
                  <th className="pb-3">カード</th>
                  <th className="pb-3">食制約</th>
                  <th className="pb-3">塩分</th>
                  <th className="pb-3">辛さ</th>
                </tr>
              </thead>
              <tbody>
                {crew.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => setSelected(member)}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer border-b border-slate-100 text-slate-700 transition hover:bg-slate-50"
                  >
                    <td className="py-3 font-medium text-slate-900">{member.alias}</td>
                    <td className="py-3">
                      {member.cardBound ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          紐付け済み
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          未設定
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {member.dietFlags.length > 0 ? member.dietFlags.join(' / ') : 'なし'}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {member.saltPreference === 'low' ? '減塩' : '通常'}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {member.spiceTolerance === 'low'
                        ? '控えめ'
                        : member.spiceTolerance === 'mid'
                          ? '普通'
                          : '強め'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="クルー詳細">
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{selected.alias}</p>
              <p className="mt-1 text-xs text-slate-500">{vesselName}</p>
            </div>

            <label className="block text-xs font-semibold text-slate-500">
              cardUid
              <input
                type="text"
                value={selected.cardUid ?? ''}
                onChange={(event) =>
                  updateCrew({
                    ...selected,
                    cardUid: event.target.value,
                    cardBound: event.target.value.trim().length > 0,
                  })
                }
                placeholder="NFC読み取り or 手入力"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </label>

            <div>
              <p className="text-xs font-semibold text-slate-500">食制約</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {dietOptions.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={selected.dietFlags.includes(option)}
                      onChange={(event) => {
                        const nextFlags = event.target.checked
                          ? [...selected.dietFlags, option]
                          : selected.dietFlags.filter((flag) => flag !== option);
                        updateCrew({ ...selected, dietFlags: nextFlags });
                      }}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-500">
                辛さ耐性
                <select
                  value={selected.spiceTolerance}
                  onChange={(event) =>
                    updateCrew({ ...selected, spiceTolerance: event.target.value as CrewMember['spiceTolerance'] })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="low">控えめ</option>
                  <option value="mid">普通</option>
                  <option value="high">強め</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                塩分希望
                <select
                  value={selected.saltPreference}
                  onChange={(event) =>
                    updateCrew({ ...selected, saltPreference: event.target.value as CrewMember['saltPreference'] })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="normal">通常</option>
                  <option value="low">減塩</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              保存
            </button>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
