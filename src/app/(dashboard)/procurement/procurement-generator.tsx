"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProcurementItem, ProcurementResult, DefaultStartDate } from "./types";
import { toCsv } from "@/lib/csv";

export default function ProcurementGenerator({
  initialStartDate,
  refreshKey = 0,
}: {
  initialStartDate: DefaultStartDate;
  refreshKey?: number;
}) {
  const plannedDays = Math.max(1, initialStartDate.plannedDays || 1);
  const [result, setResult] = useState<ProcurementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const recalcTotals = (items: ProcurementItem[]) => {
    const updated = items.map((item) => ({
      ...item,
      subtotal: item.inStock || item.orderAmount <= 0 ? 0 : item.orderAmount * item.unitCost,
    }));
    const totalCost = updated.reduce((sum, item) => sum + item.subtotal, 0);
    return {
      items: updated,
      totalCost,
      coverage: result?.coverage ?? {
        requestedDays: plannedDays,
        effectiveDays: plannedDays,
        matchedDays: 0,
        matchedDates: [],
        startDate: null,
        endDate: null,
        crewCount: 20,
        budgetPerPerson: 1200,
      },
    };
  };

  const totalCostDisplay = useMemo(() => {
    if (!result) return "0";
    return Math.round(result.totalCost).toLocaleString();
  }, [result]);

  const runGenerate = async () => {
    setError(null);
    setIsPending(true);
    try {
      const payload = { effectiveDays: plannedDays };
      const res = await fetch("/api/procurement/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      const safeCoverage = json.plan?.coverage ?? {
        requestedDays: plannedDays,
        effectiveDays: plannedDays,
        matchedDays: 0,
        matchedDates: [],
        startDate: null,
        endDate: null,
      };
      const safePlan: ProcurementResult = json.plan
        ? { ...json.plan, coverage: safeCoverage }
        : { items: [], totalCost: 0, coverage: safeCoverage };
      if (json.error) {
        setError(json.error);
        setResult(safePlan);
        return;
      }
      setResult(safePlan);
    } catch (err) {
      console.error("procurement error", err);
      setError("調達リスト生成に失敗しました。");
      setResult(null);
    } finally {
      setIsPending(false);
    }
  };

  // 自動生成: マウント時 または refreshKey変更時に献立があれば実行
  useEffect(() => {
    if (initialStartDate.hasPlans && initialStartDate.startDate) {
      runGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStartDate, refreshKey]);

  const handleToggleStock = (ingredientId: string, checked: boolean) => {
    if (!result) return;
    const nextItems = result.items.map((item) =>
      item.ingredientId === ingredientId ? { ...item, inStock: checked } : item
    );
    const recalculated = recalcTotals(nextItems);
    setResult(recalculated);
    persistAdjustment(ingredientId, recalculated.items.find((i) => i.ingredientId === ingredientId)!);
  };

  const handleOrderAmountChange = (ingredientId: string, value: number) => {
    if (!result) return;
    const nextItems = result.items.map((item) =>
      item.ingredientId === ingredientId ? { ...item, orderAmount: value } : item
    );
    const recalculated = recalcTotals(nextItems);
    setResult(recalculated);
  };

  const handleOrderAmountBlur = (ingredientId: string) => {
    if (!result) return;
    const item = result.items.find((i) => i.ingredientId === ingredientId);
    if (!item) return;
    setSaveError(null);
    persistAdjustment(ingredientId, item);
  };

  const persistAdjustment = (ingredientId: string, item: ProcurementItem) => {
    const fallbackDate = initialStartDate.startDate ?? new Date().toISOString().slice(0, 10);
    const payload = {
      ingredientId,
      startDate: result?.coverage.startDate ?? fallbackDate,
      endDate: result?.coverage.endDate ?? fallbackDate,
      plannedAmount: item.plannedAmount,
      orderAmount: item.orderAmount,
      inStock: item.inStock,
      unitPrice: item.unitCost,
    };
    fetch("/api/procurement/adjustment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error("save adjust error", err);
      setSaveError("保存に失敗しました。");
    });
  };

  const handleDownloadCsv = () => {
    if (!result) return;
    setDownloadError(null);
    setDownloadPending(true);
    try {
      const rows = result.items.map((item) => ({
        ingredient_name: item.name,
        storage_type: item.storageType,
        unit: item.unit,
        planned_amount: item.plannedAmount,
        order_amount: item.orderAmount,
        in_stock: item.inStock,
        unit_price: item.unitCost,
        subtotal: item.subtotal,
      }));
      const csv = toCsv(rows, [
        { key: "ingredient_name", label: "ingredient_name" },
        { key: "storage_type", label: "storage_type" },
        { key: "unit", label: "unit" },
        { key: "planned_amount", label: "planned_amount" },
        { key: "order_amount", label: "order_amount" },
        { key: "in_stock", label: "in_stock" },
        { key: "unit_price", label: "unit_price" },
        { key: "subtotal", label: "subtotal" },
      ]);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `procurement_${result.coverage?.startDate || "latest"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("CSVの生成に失敗しました。");
    } finally {
      setDownloadPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">調達リスト</h2>
            {isPending ? (
              <p className="text-xs text-slate-500">献立から食材を集計中...</p>
            ) : result?.coverage?.startDate ? (
              <p className="text-xs text-slate-500">
                献立期間: {result.coverage.startDate} 〜 {result.coverage.endDate}（{result.coverage.matchedDays}日分）
              </p>
            ) : !initialStartDate.hasPlans ? (
              <p className="text-xs text-slate-500">
                献立プランタブで献立を生成してください。
              </p>
            ) : null}
          </div>
          {result && !isPending && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={downloadPending}
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-200 hover:shadow-md disabled:opacity-60"
              >
                {downloadPending ? "生成中..." : "📦 食材CSV"}
              </button>
              <button
                type="button"
                disabled={downloadPending}
                onClick={() => {
                  if (!result?.coverage?.startDate || !result?.coverage?.endDate) return;
                  window.open(`/api/procurement/export-menu-csv?startDate=${result.coverage.startDate}&endDate=${result.coverage.endDate}`, '_blank');
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 shadow-sm transition hover:border-teal-300 hover:shadow-md disabled:opacity-60"
              >
                📅 献立付きCSV
              </button>
            </div>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        {downloadError && <p className="mt-2 text-sm text-rose-600">{downloadError}</p>}
      </div>

      {/* Content */}
      {isPending ? (
        <div className="rounded-2xl border border-dashed border-sky-200 bg-white/80 p-8 text-center text-sm text-slate-500">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
          調達リストを生成中...
        </div>
      ) : !initialStartDate.hasPlans ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
          献立プランタブで献立を生成すると、自動的に調達リストが表示されます。
        </div>
      ) : result ? (
        <div className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">食材名</th>
                  <th className="px-3 py-2 text-right">必要量</th>
                  <th className="px-3 py-2 text-center">在庫</th>
                  <th className="px-3 py-2 text-right">発注量</th>
                  <th className="px-3 py-2">単位</th>
                  <th className="px-3 py-2">保管</th>
                  <th className="px-3 py-2 text-right">単価</th>
                  <th className="px-3 py-2 text-right">小計</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={8}>
                      指定期間の献立がありません。
                    </td>
                  </tr>
                ) : null}
                {result.items.map((item) => (
                  <tr
                    key={item.ingredientId}
                    className={item.inStock ? "bg-slate-50 text-slate-500" : "text-slate-800"}
                  >
                    <td className="px-3 py-2 font-semibold">{item.name}</td>
                    <td className="px-3 py-2 text-right">{Math.round(item.plannedAmount * 10) / 10}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.inStock}
                        onChange={(e) => handleToggleStock(item.ingredientId, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={item.orderAmount}
                        onChange={(e) => handleOrderAmountChange(item.ingredientId, Number(e.target.value) || 0)}
                        onBlur={() => handleOrderAmountBlur(item.ingredientId)}
                        className="w-full rounded-lg border border-sky-100 bg-white px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">{item.unit}</td>
                    <td className="px-3 py-2">{storageLabel(item.storageType)}</td>
                    <td className="px-3 py-2 text-right">{Math.round(item.unitCost).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{Math.round(item.subtotal).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Budget Summary */}
          {(() => {
            const totalCost = result.totalCost;
            const days = result.coverage?.matchedDays ?? 1;
            const crewCount = result.coverage?.crewCount ?? 20;
            const budgetPerPerson = result.coverage?.budgetPerPerson ?? 1200;

            // 総予算 = 1人予算 × 乗船人数 × 日数
            const totalBudget = budgetPerPerson * crewCount * days;
            const minBudget = Math.floor(totalBudget * 0.9); // 最低90%
            const isWithinBudget = totalCost <= totalBudget;
            const meetsMinBudget = totalCost >= minBudget;
            const remaining = totalBudget - totalCost;

            return (
              <div className={`mt-4 rounded-xl border-2 p-4 ${isWithinBudget && meetsMinBudget
                ? 'border-emerald-200 bg-emerald-50'
                : !isWithinBudget
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-amber-200 bg-amber-50'
                }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">
                      {days}日分 × {crewCount}名の調達予算
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      1人1日: ¥{budgetPerPerson.toLocaleString()} / 最低消化: ¥{minBudget.toLocaleString()}(90%)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${isWithinBudget && meetsMinBudget ? 'text-emerald-700' :
                      !isWithinBudget ? 'text-rose-700' : 'text-amber-700'
                      }`}>
                      ¥{Math.round(totalCost).toLocaleString()} / ¥{totalBudget.toLocaleString()}
                    </div>
                    <div className={`text-xs font-medium ${isWithinBudget && meetsMinBudget ? 'text-emerald-600' :
                      !isWithinBudget ? 'text-rose-600' : 'text-amber-600'
                      }`}>
                      {isWithinBudget && meetsMinBudget ? (
                        <>✅ 予算内 (残り ¥{remaining.toLocaleString()})</>
                      ) : !isWithinBudget ? (
                        <>⚠️ 予算超過 (¥{Math.abs(remaining).toLocaleString()}オーバー)</>
                      ) : (
                        <>⚠️ 最低予算未達 (あと ¥{(minBudget - totalCost).toLocaleString()})</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {saveError && <p className="mt-1 text-xs text-rose-600">{saveError}</p>}
          <p className="mt-3 text-xs text-slate-500">
            ※このリストは献立データから自動算出した見積りです。在庫状況に応じて発注量を調整してください。
          </p>
        </div>
      ) : null}
    </div>
  );
}

function storageLabel(value: string) {
  if (value === "frozen") return "冷凍";
  if (value === "chilled") return "冷蔵";
  return "常温";
}
