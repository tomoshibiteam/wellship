'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { useManagerSearchParams } from '@/components/manager/use-manager-search-params';
import { useMockQuery } from '@/components/manager/use-mock-query';
import { EmptyState, SectionCard } from '@/components/manager/manager-ui';
import { Modal } from '@/components/manager/modal';
import { getFeedbackSummary } from '@/lib/manager/data';
import type { RecipeStat } from '@/lib/manager/types';

export default function FeedbackClient() {
  const { scope, range } = useManagerSearchParams();
  const { data, isLoading, error, retry } = useMockQuery(
    () => getFeedbackSummary(scope, range),
    [scope, range]
  );
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeStat | null>(null);

  if (isLoading) {
    return <PageLoading message="フィードバック分析を更新中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={retry} />;
  }

  if (!data) {
    return (
      <EmptyState
        title="データがありません"
        description="対象期間にフィードバックが存在しません。"
      />
    );
  }

  const popular = useMemo(
    () =>
      [...data.recipes]
        .sort((a, b) => b.positiveRate - a.positiveRate)
        .slice(0, 5),
    [data.recipes]
  );
  const unpopular = useMemo(
    () =>
      [...data.recipes]
        .sort((a, b) => b.negativeRate - a.negativeRate)
        .slice(0, 5),
    [data.recipes]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="フィードバック分析"
        description="船隊全体の満足度と不満要因を確認します。"
        badge="Manager"
      />

      <SectionCard title="サマリー" description="直近の推移を簡易表示します。">
        <div className="grid gap-3 md:grid-cols-3">
          {data.trend.map((point) => (
            <div key={point.date} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
              <p className="font-semibold text-slate-800">{point.date}</p>
              <p className="mt-1 text-slate-500">👍率 {Math.round(point.positiveRate * 100)}%</p>
              <p className="text-slate-500">👎率 {Math.round(point.negativeRate * 100)}%</p>
              <p className="text-slate-500">回答率 {Math.round(point.responseRate * 100)}%</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="不満理由 TOP" description="全体で目立つ課題を整理します。">
          <ol className="space-y-2 text-sm">
            {data.reasons.map((reason) => (
              <li key={reason.reason} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">{reason.reason}</span>
                <span className="text-xs text-slate-500">{Math.round(reason.rate * 100)}% ({reason.count}件)</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="レシピランキング" description="人気・不評のレシピを比較します。">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-emerald-700">人気 TOP</p>
              <ul className="mt-2 space-y-2 text-sm">
                {popular.map((recipe) => (
                  <li key={recipe.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipe(recipe)}
                      className="flex w-full items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-left text-emerald-700"
                    >
                      <span className="font-medium">{recipe.name}</span>
                      <span className="text-xs">👍 {Math.round(recipe.positiveRate * 100)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-700">不評 TOP</p>
              <ul className="mt-2 space-y-2 text-sm">
                {unpopular.map((recipe) => (
                  <li key={recipe.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipe(recipe)}
                      className="flex w-full items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-left text-rose-700"
                    >
                      <span className="font-medium">{recipe.name}</span>
                      <span className="text-xs">👎 {Math.round(recipe.negativeRate * 100)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>
      </div>

      <Modal
        open={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        title="レシピ分析"
        size="sm"
      >
        {selectedRecipe ? (
          <div className="space-y-3 text-sm">
            <p className="text-base font-semibold text-slate-900">{selectedRecipe.name}</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-slate-600">👍率 {Math.round(selectedRecipe.positiveRate * 100)}%</p>
              <p className="text-slate-600">👎率 {Math.round(selectedRecipe.negativeRate * 100)}%</p>
              <p className="text-slate-600">回答数 {selectedRecipe.responses}件</p>
            </div>
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              船別内訳・コメントはAPI連携後に表示予定です。
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
