"use client";

import { useMemo, useState, useTransition } from "react";
import type { MealType, Recipe } from "@prisma/client";
import { computeHealthScore } from "./health-score";
import type { GenerateRequest, GeneratedDay, NutritionPolicy } from "./actions";
import { ReplacementModal } from "@/components/planning/replacement-modal";
import { WeekMenuTable } from "@/components/planning/week-menu-table";
import type { VesselSettings } from "./unified-planning-client";

type PlanRangeMeta = {
  startDate: string;
  endDate: string;
  days: number;
} | null;

type FormState = GenerateRequest;
type FormErrors = Partial<Record<keyof GenerateRequest, string>>;

const defaultForm: FormState = {
  crewCount: 20,
  days: 7,
  budget: 1200,
  policy: "バランス重視",
};

const mealLabels: Record<keyof GeneratedDay["meals"], string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
};

type SwapTarget = {
  dayIndex: number;
  meal: keyof GeneratedDay["meals"];
  recipeIndex: number;
};

type ReplacementTarget = {
  recipe: Recipe;
  date: string;
  mealType: keyof GeneratedDay["meals"];
};

export default function PlanningGenerator({
  initialPlan,
  latestRange,
  vesselId = "",
  vesselSettings,
}: {
  initialPlan: GeneratedDay[] | null;
  latestRange: PlanRangeMeta;
  vesselId?: string;
  vesselSettings?: VesselSettings;
}) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [plan, setPlan] = useState<GeneratedDay[] | null>(initialPlan);
  const [isPending, startTransition] = useTransition();

  // 季節・調理時間のstate（Vesselデフォルト値で初期化）
  const [season, setSeason] = useState<string>(vesselSettings?.defaultSeason ?? "");
  const [maxCookingTime, setMaxCookingTime] = useState<number | "">(vesselSettings?.defaultMaxCookingTime ?? "");

  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const [candidates, setCandidates] = useState<Recipe[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [swapSaving, setSwapSaving] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [scoreDelta, setScoreDelta] = useState<Record<number, number>>({});
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Replacement modal state
  const [replacementTarget, setReplacementTarget] = useState<ReplacementTarget | null>(null);

  const openReplacement = (
    dayIndex: number,
    meal: keyof GeneratedDay["meals"],
    recipeIndex: number,
    date: string
  ) => {
    if (!plan) return;
    const recipe = plan[dayIndex].meals[meal][recipeIndex];
    setReplacementTarget({
      recipe,
      date,
      mealType: meal,
    });
  };

  const handleReplacedCallback = () => {
    // リフレッシュ（実際はプランを再取得）
    window.location.reload();
  };

  const handleChange = (key: keyof FormState, value: string | number) => {
    const next = { ...form };
    if (key === "policy") {
      next[key] = value as NutritionPolicy;
    } else {
      const num = Number(value);
      next[key] = Number.isNaN(num) ? 0 : num;
    }
    setForm(next);
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!form.crewCount || form.crewCount < 1) nextErrors.crewCount = "1以上の数値を入力してください";
    if (!form.days || form.days < 1) nextErrors.days = "1以上の数値を入力してください";
    if (!form.budget || form.budget < 1) nextErrors.budget = "1以上の数値を入力してください";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    startTransition(async () => {
      setGenerateError(null);
      try {
        const payload = {
          ...form,
          constraints: {
            season: season || undefined,
            maxCookingTimeMinutes: maxCookingTime || undefined,
          },
        };
        const res = await fetch("/api/menu/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("failed");
        const json = await res.json();
        setPlan(json.plan ?? null);
      } catch (err) {
        console.error("generate error", err);
        setGenerateError("生成に失敗しました。ネットワークを確認して再試行してください。");
      }
    });
  };

  const planRange: PlanRangeMeta = useMemo(() => {
    if (plan?.length) {
      const dates = [...plan.map((d) => d.date)].sort();
      return { startDate: dates[0], endDate: dates[dates.length - 1], days: plan.length };
    }
    if (latestRange) return latestRange;
    return null;
  }, [plan, latestRange]);


  const recalcDay = (day: GeneratedDay) => {
    const totals = Object.values(day.meals).flat().reduce(
      (acc, r) => {
        acc.calories += r.calories;
        acc.protein += r.protein;
        acc.salt += r.salt;
        acc.cost += r.costPerServing;
        return acc;
      },
      { calories: 0, protein: 0, salt: 0, cost: 0 },
    );
    const newScore = computeHealthScore(totals.calories, totals.protein, totals.salt);
    return { ...day, totals, healthScore: newScore };
  };

  const openSwap = (dayIndex: number, meal: keyof GeneratedDay["meals"], recipeIndex: number) => {
    if (!plan) return;
    const recipe = plan[dayIndex].meals[meal][recipeIndex];
    setSwapTarget({ dayIndex, meal, recipeIndex });
    setSelectedCandidate(recipe.id);
    setCandidateLoading(true);
    setCandidateError(null);
    fetch(`/api/recipes?category=${recipe.category}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        const json = await res.json();
        setCandidates(json.recipes ?? []);
      })
      .catch((err) => {
        console.error("候補取得エラー", err);
        setCandidateError("候補の取得に失敗しました。再度お試しください。");
        setCandidates([]);
      })
      .finally(() => setCandidateLoading(false));
  };

  const applySwap = async () => {
    if (!plan || !swapTarget || !selectedCandidate) return;
    const targetDay = plan[swapTarget.dayIndex];
    const recipeList = targetDay.meals[swapTarget.meal];
    const oldRecipe = recipeList[swapTarget.recipeIndex];
    const newRecipe = candidates.find((c) => c.id === selectedCandidate);
    if (!newRecipe) return;

    const nextPlan = [...plan];
    const updatedDay = { ...targetDay, meals: { ...targetDay.meals } };
    const newRecipes = [...updatedDay.meals[swapTarget.meal]];
    newRecipes[swapTarget.recipeIndex] = newRecipe;
    updatedDay.meals[swapTarget.meal] = newRecipes;
    const recalculated = recalcDay(updatedDay);
    nextPlan[swapTarget.dayIndex] = recalculated;

    // optimistic delta badge
    const delta = recalculated.healthScore - targetDay.healthScore;
    setScoreDelta((prev) => ({ ...prev, [recalculated.day]: delta }));
    setTimeout(() => {
      setScoreDelta((prev) => {
        const copy = { ...prev };
        delete copy[recalculated.day];
        return copy;
      });
    }, 2500);

    setPlan(nextPlan);
    setSwapSaving(true);
    setSwapError(null);

    const payload = {
      date: targetDay.date,
      mealType: swapTarget.meal as MealType,
      oldRecipeId: oldRecipe.id,
      newRecipeId: newRecipe.id,
    };

    try {
      const res = await fetch("/api/menu/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");
      setSwapTarget(null);
    } catch (err) {
      console.error("保存エラー", err);
      setSwapError("保存に失敗しました。ネットワークを確認して再試行してください。");
      // revert on failure
      setPlan(plan);
    } finally {
      setSwapSaving(false);
    }
  };

  const activeRecipeName = useMemo(() => {
    if (!plan || !swapTarget) return "";
    return plan[swapTarget.dayIndex].meals[swapTarget.meal][swapTarget.recipeIndex].name;
  }, [plan, swapTarget]);

  return (
    <>
      <div className="space-y-4" data-testid="planning-generator">
        <form
          onSubmit={handleGenerate}
          className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Step 1
              </p>
              <h2 className="text-lg font-semibold text-slate-900">条件入力フォーム</h2>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
              フェーズ3-1
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FormField
              label="乗船人数"
              value={form.crewCount}
              onChange={(v) => handleChange("crewCount", v)}
              error={errors.crewCount}
            />
            <FormField
              label="日数"
              value={form.days}
              onChange={(v) => handleChange("days", v)}
              error={errors.days}
            />
            <FormField
              label="1人1日予算（円）"
              value={form.budget}
              onChange={(v) => handleChange("budget", v)}
              error={errors.budget}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-800">栄養方針</label>
              <select
                value={form.policy}
                onChange={(e) => handleChange("policy", e.target.value)}
                className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="バランス重視">バランス重視</option>
                <option value="高たんぱく">高たんぱく</option>
                <option value="塩分控えめ">塩分控えめ</option>
                <option value="ボリューム重視">ボリューム重視</option>
              </select>
            </div>
          </div>

          {/* 季節・調理時間設定 */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-800">季節</label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="">自動判定</option>
                <option value="spring">春（3-5月）</option>
                <option value="summer">夏（6-8月）</option>
                <option value="autumn">秋（9-11月）</option>
                <option value="winter">冬（12-2月）</option>
              </select>
              <p className="text-xs text-slate-500">季節に合った食材・料理を優先</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-800">調理時間上限（分）</label>
              <input
                type="number"
                min={10}
                max={180}
                value={maxCookingTime}
                onChange={(e) => setMaxCookingTime(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="例: 60"
                className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <p className="text-xs text-slate-500">空欄は制限なし</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              AI連携は後続フェーズで差し込み予定（現在はダミー表示）
            </p>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "生成中..." : "AIで献立を作成"}
            </button>
          </div>
          {generateError ? <p className="mt-2 text-sm text-rose-600">{generateError}</p> : null}
        </form>


        {plan ? (
          <div className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
            <WeekMenuTable plan={plan} budget={form.budget} onReplaceRecipe={openReplacement} />
          </div>
        ) : null}
      </div>

      {swapTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  メニュー差し替え
                </p>
                <h4 className="text-lg font-semibold text-slate-900">
                  {plan?.[swapTarget.dayIndex].dayLabel} {mealLabels[swapTarget.meal]} / 現在:{" "}
                  {activeRecipeName}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSwapTarget(null)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                閉じる
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  現在のメニュー
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{activeRecipeName}</p>
              </div>
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">代替レシピ候補</p>
                  {candidateLoading ? (
                    <span className="text-xs text-slate-500">読み込み中...</span>
                  ) : null}
                </div>
                {candidateError ? (
                  <p className="mt-3 text-sm text-rose-600">{candidateError}</p>
                ) : null}
                <div className="mt-3 max-h-80 overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">料理名</th>
                        <th className="px-3 py-2">カテゴリ</th>
                        <th className="px-3 py-2 text-right">kcal</th>
                        <th className="px-3 py-2 text-right">P(g)</th>
                        <th className="px-3 py-2 text-right">塩分(g)</th>
                        <th className="px-3 py-2 text-right">コスト</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!candidateLoading && candidates.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-sm text-slate-600" colSpan={6}>
                            該当カテゴリの候補がありません。
                          </td>
                        </tr>
                      ) : null}
                      {candidates.map((r) => (
                        <tr
                          key={r.id}
                          className={`cursor-pointer transition hover:bg-sky-50 ${selectedCandidate === r.id ? "bg-sky-50" : ""
                            }`}
                          onClick={() => setSelectedCandidate(r.id)}
                        >
                          <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                          <td className="px-3 py-2 text-slate-600">{r.category}</td>
                          <td className="px-3 py-2 text-right">{r.calories}</td>
                          <td className="px-3 py-2 text-right">{r.protein}</td>
                          <td className="px-3 py-2 text-right">{r.salt}</td>
                          <td className="px-3 py-2 text-right">{r.costPerServing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    同カテゴリのレシピのみ表示しています。保存時に DB の MenuPlan も更新します。
                  </p>
                  <button
                    type="button"
                    disabled={!selectedCandidate || swapSaving}
                    onClick={applySwap}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {swapSaving ? "保存中..." : "このレシピに差し替え"}
                  </button>
                </div>
                {swapError ? <p className="mt-2 text-sm text-rose-600">{swapError}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Replacement Modal with exclusion tracking */}
      {replacementTarget && (
        <ReplacementModal
          isOpen={!!replacementTarget}
          onClose={() => setReplacementTarget(null)}
          currentRecipe={replacementTarget.recipe}
          date={replacementTarget.date}
          mealType={replacementTarget.mealType}
          vesselId={vesselId}
          onReplaced={handleReplacedCallback}
        />
      )}
    </>
  );
}

function FormField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-800">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
