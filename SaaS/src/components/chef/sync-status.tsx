'use client';

import { useRetryQueueStatus } from '@/lib/offline/use-retry-queue';

export function SyncStatusIndicator() {
  const { total, pending, error, online, retryAll, retryFailed, clearQueue } = useRetryQueueStatus();

  const statusLabel =
    error > 0
      ? `🔴 エラー ${error}件`
      : pending > 0
        ? `🟡 未送信 ${pending}件`
        : online
          ? '🟢 同期済み'
          : '🟡 オフライン';

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm">
        {statusLabel}
      </summary>
      <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
        <div className="space-y-1">
          <p>通信: {online ? 'オンライン' : 'オフライン'}</p>
          <p>未送信: {pending}件</p>
          <p>エラー: {error}件</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => retryAll()}
            disabled={!online || total === 0}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            再送
          </button>
          <button
            type="button"
            onClick={() => retryFailed()}
            disabled={!online || error === 0}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            エラー再送
          </button>
          <button
            type="button"
            onClick={() => clearQueue()}
            disabled={total === 0}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            未送信を消す
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          通信が不安定でも入力は保存され、復旧時に再送されます。
        </p>
      </div>
    </details>
  );
}
