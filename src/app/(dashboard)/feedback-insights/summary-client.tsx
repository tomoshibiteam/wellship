"use client";

import { useEffect, useState, useTransition } from "react";

type Summary = {
  count: number;
  startDate: string;
  endDate: string;
  avgSatisfaction: number;
  noLeftoverRatio: number; // 0-1
  volumeJustRatio: number; // 0-1
};

type TrendRow = {
  date: string;
  mealType: string;
  avgSatisfaction: number;
  noLeftoverRatio: number;
  count: number;
};

type RankingRow = {
  id: string;
  name: string;
  count: number;
  avgSatisfaction: number;
  noLeftoverRatio: number;
};

export default function SummaryClient({
  defaultRange,
}: {
  defaultRange: { startDate: string; endDate: string };
}) {
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [favorites, setFavorites] = useState<RankingRow[]>([]);
  const [improvables, setImprovables] = useState<RankingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchSummary = () =>
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/feedback-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate, endDate }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || "集計に失敗しました。");
        }
        setSummary(json.summary);
        setTrends(json.trends ?? []);
        setFavorites(json.rankings?.favorites ?? []);
        setImprovables(json.rankings?.improvables ?? []);
      } catch (err) {
        console.error("summary fetch error", err);
        setError((err as Error).message);
        setSummary(null);
        setTrends([]);
        setFavorites([]);
        setImprovables([]);
      }
    });

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = [
    {
      title: "食事の印象（平均）",
      value:
        summary && summary.count > 0
          ? summary.avgSatisfaction.toFixed(1)
          : "-",
      suffix: summary && summary.count > 0 ? "/ 4.0" : "",
      note: "みなさんの温かい声に感謝します",
    },
    {
      title: "ほとんど残さなかった",
      value:
        summary && summary.count > 0
          ? Math.round(summary.noLeftoverRatio * 100).toString()
          : "-",
      suffix: summary && summary.count > 0 ? "%" : "",
      note: "しっかり食べていただけた日が多いです",
    },
    {
      title: "量がちょうどよかった",
      value:
        summary && summary.count > 0
          ? Math.round(summary.volumeJustRatio * 100).toString()
          : "-",
      suffix: summary && summary.count > 0 ? "%" : "",
      note: "ボリューム感の参考にしてください",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              期間フィルター
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              最新のフィードバックをやさしくサマリー
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">開始日</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-40 rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">終了日</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-40 rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <button
              type="button"
              onClick={fetchSummary}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "集計中..." : "この期間で集計"}
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        {summary ? (
          <p className="mt-2 text-xs text-slate-500">
            {summary.startDate} 〜 {summary.endDate}（{summary.count} 件のフィードバック）
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              ありがとうございます
            </p>
            <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
            <div className="mt-3 flex items-end gap-1 text-3xl font-bold text-slate-900">
              <span>{card.value}</span>
              <span className="text-lg font-semibold text-slate-500">{card.suffix}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{card.note}</p>
          </div>
        ))}
      </div>
      {summary ? (
        <p className="text-xs text-slate-500">
          この期間のフィードバック件数：{summary.count}件
        </p>
      ) : null}

      <div className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              日別トレンド
            </p>
            <h3 className="text-lg font-semibold text-slate-900">日付 × 食事区分のサマリー</h3>
          </div>
          <p className="text-xs text-slate-500">いつもありがとうございます。やさしい色で傾向を確認できます。</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">日付</th>
                <th className="px-3 py-2">食事区分</th>
                <th className="px-3 py-2 text-right">平均印象</th>
                <th className="px-3 py-2 text-right">ほとんど残さず</th>
                <th className="px-3 py-2 text-right">件数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!trends || trends.length === 0) && (
                <tr>
                  <td className="px-3 py-3 text-sm text-slate-600" colSpan={5}>
                    データがまだありません。期間を変えてお試しください。
                  </td>
                </tr>
              )}
              {trends.map((row) => (
                <tr key={`${row.date}-${row.mealType}`} className="text-slate-800">
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{mealLabel(row.mealType)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={heatColor(row.avgSatisfaction)}>
                      {row.avgSatisfaction.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {Math.round(row.noLeftoverRatio * 100)}%
                  </td>
                  <td className="px-3 py-2 text-right">{row.count}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-amber-600">
                    {row.count > 0 && row.count <= 2 ? "※件数少なめ（参考値）" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RankingPanel
          title="よく食べられているメニュー"
          note="平均スコアと残さなかった割合が高いものを上位に表示しています。引き続き自信を持って提供しましょう。"
          rows={favorites}
        />
        <RankingPanel
          title="改善のヒントになりそうなメニュー"
          note="少し残りやすい傾向のものです。量や味付けを少し調整するヒントにしてください。"
          rows={improvables}
        />
      </div>
    </div>
  );
}

function mealLabel(meal: string) {
  if (meal === "breakfast") return "朝食";
  if (meal === "lunch") return "昼食";
  if (meal === "dinner") return "夕食";
  return meal;
}

// やわらかいヒートマップ用クラス
function heatColor(score: number) {
  if (score >= 3.5) return "inline-flex rounded-lg bg-sky-50 px-2 py-1 font-semibold text-sky-800";
  if (score >= 2.5) return "inline-flex rounded-lg bg-teal-50 px-2 py-1 font-semibold text-teal-800";
  return "inline-flex rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-800";
}

function RankingPanel({
  title,
  note,
  rows,
}: {
  title: string;
  note: string;
  rows: RankingRow[];
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            メニューランキング
          </p>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        <p className="text-xs text-slate-500 max-w-[200px] text-right">{note}</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">メニュー</th>
              <th className="px-3 py-2 text-right">平均スコア</th>
              <th className="px-3 py-2 text-right">残さず割合</th>
              <th className="px-3 py-2 text-right">提供回数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-sm text-slate-600" colSpan={4}>
                  データがまだありません。期間を変えてお試しください。
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="text-slate-800">
                <td className="px-3 py-2 font-semibold">{r.name}</td>
                <td className="px-3 py-2 text-right">
                  <span className={heatColor(r.avgSatisfaction)}>{r.avgSatisfaction.toFixed(1)}</span>
                </td>
                <td className="px-3 py-2 text-right">{Math.round(r.noLeftoverRatio * 100)}%</td>
                <td className="px-3 py-2 text-right">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
