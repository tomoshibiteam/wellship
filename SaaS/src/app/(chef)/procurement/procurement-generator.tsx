"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProcurementItem, ProcurementResult, DefaultStartDate } from "./types";
import type { CheckoutResult } from "./order-types";
import { toCsv } from "@/lib/csv";
import { safeJsonRequest } from "@/lib/offline/retry-queue";
import { loadDraft, saveDraft } from "@/lib/offline/draft-storage";

export default function ProcurementGenerator({
  initialStartDate,
  refreshKey = 0,
  vesselId,
}: {
  initialStartDate: DefaultStartDate;
  refreshKey?: number;
  vesselId?: string;
}) {
  const plannedDays = Math.max(1, initialStartDate.plannedDays || 1);
  const [result, setResult] = useState<ProcurementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const draftAppliedRef = useRef<string | null>(null);

  // 発注関連の状態
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<string>("");

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

  const draftKey = useMemo(() => {
    const start = result?.coverage?.startDate ?? initialStartDate.startDate ?? "latest";
    const end = result?.coverage?.endDate ?? initialStartDate.startDate ?? "latest";
    return `wellship_procurement_draft:${vesselId ?? "unknown"}:${start}:${end}`;
  }, [result?.coverage?.startDate, result?.coverage?.endDate, initialStartDate.startDate, vesselId]);

  const totalCostDisplay = useMemo(() => {
    if (!result) return "0";
    return Math.round(result.totalCost).toLocaleString();
  }, [result]);

  // 発注対象アイテム（在庫なし & 発注量 > 0）
  const orderableItems = useMemo(() => {
    if (!result) return [];
    return result.items.filter((item) => !item.inStock && item.orderAmount > 0);
  }, [result]);

  // Boost食材の数
  const bonusItemCount = useMemo(() => {
    return orderableItems.filter((item) => item.isBonus).length;
  }, [orderableItems]);

  const runGenerate = async () => {
    setError(null);
    setIsPending(true);
    setCheckoutResult(null);
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

  useEffect(() => {
    if (!result) return;
    if (draftAppliedRef.current === draftKey) return;
    const draft = loadDraft<Record<string, { orderAmount: number; inStock: boolean }>>(draftKey, {});
    const hasDraft = Object.keys(draft).length > 0;
    if (!hasDraft) {
      draftAppliedRef.current = draftKey;
      return;
    }
    const updatedItems = result.items.map((item) => {
      const saved = draft[item.ingredientId];
      if (!saved) return item;
      return {
        ...item,
        orderAmount: saved.orderAmount ?? item.orderAmount,
        inStock: saved.inStock ?? item.inStock,
      };
    });
    setResult(recalcTotals(updatedItems));
    draftAppliedRef.current = draftKey;
  }, [result, draftKey]);

  const handleToggleStock = (ingredientId: string, checked: boolean) => {
    if (!result) return;
    const nextItems = result.items.map((item) =>
      item.ingredientId === ingredientId ? { ...item, inStock: checked } : item
    );
    const recalculated = recalcTotals(nextItems);
    setResult(recalculated);
    const draft = loadDraft<Record<string, { orderAmount: number; inStock: boolean }>>(draftKey, {});
    const current = draft[ingredientId] ?? { orderAmount: recalculated.items.find((i) => i.ingredientId === ingredientId)?.orderAmount ?? 0, inStock: checked };
    draft[ingredientId] = { ...current, inStock: checked };
    saveDraft(draftKey, draft);
    persistAdjustment(ingredientId, recalculated.items.find((i) => i.ingredientId === ingredientId)!);
  };

  const handleOrderAmountChange = (ingredientId: string, value: number) => {
    if (!result) return;
    const nextItems = result.items.map((item) =>
      item.ingredientId === ingredientId ? { ...item, orderAmount: value } : item
    );
    const recalculated = recalcTotals(nextItems);
    setResult(recalculated);
    const draft = loadDraft<Record<string, { orderAmount: number; inStock: boolean }>>(draftKey, {});
    const current = draft[ingredientId] ?? { orderAmount: value, inStock: recalculated.items.find((i) => i.ingredientId === ingredientId)?.inStock ?? false };
    draft[ingredientId] = { ...current, orderAmount: value };
    saveDraft(draftKey, draft);
  };

  const handleOrderAmountBlur = (ingredientId: string) => {
    if (!result) return;
    const item = result.items.find((i) => i.ingredientId === ingredientId);
    if (!item) return;
    setSaveError(null);
    persistAdjustment(ingredientId, item);
  };

  const persistAdjustment = async (ingredientId: string, item: ProcurementItem) => {
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
    const response = await safeJsonRequest({
      url: "/api/procurement/adjustment",
      method: "POST",
      body: payload,
      feature: "procurement",
    });
    if (response.queued) {
      setSaveError("通信が不安定です。保存を保留しました。");
      return;
    }
    if (!response.ok) {
      setSaveError("保存に失敗しました。");
      return;
    }
    setSaveError(null);
    const draft = loadDraft<Record<string, { orderAmount: number; inStock: boolean }>>(draftKey, {});
    delete draft[ingredientId];
    saveDraft(draftKey, draft);
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
        is_bonus: item.isBonus,
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
        { key: "is_bonus", label: "is_bonus" },
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

  // 発注確定処理
  const handleCheckout = async () => {
    if (!result || !vesselId) return;

    setCheckoutPending(true);
    setCheckoutResult(null);

    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: result.items,
          vesselId,
          deliveryDate: deliveryDate || undefined,
          confirmImmediately: true,
        }),
      });
      const json: CheckoutResult = await res.json();
      setCheckoutResult(json);
    } catch (err) {
      console.error("checkout error", err);
      setCheckoutResult({
        success: false,
        error: "発注処理に失敗しました。",
      });
    } finally {
      setCheckoutPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
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
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md disabled:opacity-60"
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
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md disabled:opacity-60"
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-slate-500">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
          調達リストを生成中...
        </div>
      ) : !initialStartDate.hasPlans ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
          献立プランタブで献立を生成すると、自動的に調達リストが表示されます。
        </div>
      ) : result ? (
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
          {/* Boost食材があれば表示 */}
          {bonusItemCount > 0 && (
            <div className="mb-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎁</span>
                <div>
                  <p className="font-bold text-amber-800">Special Offer!</p>
                  <p className="text-sm text-amber-700">
                    {bonusItemCount}品目のBoost食材（お得なロス食材）が含まれています
                  </p>
                </div>
              </div>
            </div>
          )}

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
                    className={`${item.inStock ? "bg-slate-50 text-slate-500" : "text-slate-800"} ${item.isBonus ? "bg-gradient-to-r from-amber-50/50 to-transparent" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.name}</span>
                        {item.isBonus && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            🎁 Boost
                          </span>
                        )}
                      </div>
                      {item.matchedProduct && (
                        <div className="mt-1 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                          <span className="font-bold text-sky-700">✓ {item.matchedProduct.supplierName}</span>
                          <span className="truncate max-w-[150px]">{item.matchedProduct.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{Math.round(item.plannedAmount * 10) / 10}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.inStock}
                        onChange={(e) => handleToggleStock(item.ingredientId, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
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
                        inputMode="decimal"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
                      />
                    </td>
                    <td className="px-3 py-2">{item.unit}</td>
                    <td className="px-3 py-2">{storageLabel(item.storageType)}</td>
                    <td className="px-3 py-2 text-right">{Math.round(item.unitCost).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium">{Math.round(item.subtotal).toLocaleString()}</td>
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
            const usagePercent = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;

            return (
              <div className={`mt-4 rounded-xl border-2 p-4 ${isWithinBudget && meetsMinBudget
                ? 'border-emerald-200 bg-emerald-50'
                : !isWithinBudget
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-amber-200 bg-amber-50'
                }`}>
                {/* Budget Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>予算消化率</span>
                    <span className="font-bold">{usagePercent}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${usagePercent > 100
                        ? 'bg-gradient-to-r from-rose-400 to-rose-600'
                        : usagePercent >= 90
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                          : 'bg-gradient-to-r from-amber-400 to-amber-600'
                        }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>0%</span>
                    <span className="text-amber-600 font-medium">90%（最低消化）</span>
                    <span>100%</span>
                  </div>
                </div>

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

          {/* Checkout Section */}
          {vesselId && orderableItems.length > 0 && (
            <div className="mt-6 rounded-xl border-2 border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-bold text-slate-800 mb-3">
                🛒 発注確定（Checkout）
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-slate-600 mb-2">発注内容</p>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-sm"><span className="font-medium">{orderableItems.length}</span> 品目</p>
                    <p className="text-2xl font-bold text-slate-900">
                      ¥{Math.round(result.totalCost).toLocaleString()}
                    </p>
                    {bonusItemCount > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-1">
                        🎁 {bonusItemCount}品目のBoost食材を含む
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-600 mb-2 block">希望納品日（任意）</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </div>

              {checkoutResult && (
                <div className={`mb-4 rounded-lg p-3 ${checkoutResult.success ? 'bg-emerald-100 border border-emerald-200' : 'bg-rose-100 border border-rose-200'}`}>
                  {checkoutResult.success ? (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-bold text-emerald-800">発注が完了しました！</p>
                        <p className="text-sm text-emerald-700">
                          発注番号: {checkoutResult.order?.orderNumber}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">❌</span>
                      <p className="text-rose-800">{checkoutResult.error}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={checkoutPending || checkoutResult?.success}
                onClick={handleCheckout}
                className={`w-full py-3 px-6 rounded-xl font-bold text-white shadow-lg transition-all duration-200 ${checkoutPending || checkoutResult?.success
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 hover:shadow-xl active:scale-98'
                  }`}
              >
                {checkoutPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    発注処理中...
                  </span>
                ) : checkoutResult?.success ? (
                  "✅ 発注完了"
                ) : (
                  `🚀 この内容で発注する（¥${Math.round(result.totalCost).toLocaleString()}）`
                )}
              </button>

              <p className="text-xs text-slate-500 mt-3 text-center">
                ※発注確定後、WELLSHIPから各仕入先へ発注が行われます
              </p>
            </div>
          )}

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
