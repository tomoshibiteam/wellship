"use client";

import { useState } from "react";

type RecipeRow = {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  salt: number;
  costPerServing: number;
};

export default function RecipeDebugButton({ isOpen }: { isOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recipes");
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      setRecipes(json.recipes ?? []);
    } catch (err) {
      console.error("recipe debug fetch error", err);
      setError("レシピ一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-sky-100 bg-white/70 p-3 text-xs text-slate-700 shadow-inner">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next && recipes.length === 0 && !loading) {
              fetchRecipes();
            }
            return next;
          });
        }}
        className="flex w-full items-center justify-between rounded-lg border border-sky-100 bg-white px-3 py-2 text-[11px] font-semibold text-sky-700 shadow-sm transition hover:border-sky-200 hover:shadow-md"
      >
        <span>{isOpen ? "デバッグ: レシピ一覧" : "レシピ一覧"}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-sky-100 bg-white p-2">
          {loading ? <div className="text-xs text-slate-500">読み込み中...</div> : null}
          {error ? <div className="text-xs text-rose-600">{error}</div> : null}
          {!loading && !error ? (
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1">名称</th>
                  <th className="px-2 py-1">カテゴリ</th>
                  <th className="px-2 py-1 text-right">kcal</th>
                  <th className="px-2 py-1 text-right">P(g)</th>
                  <th className="px-2 py-1 text-right">塩分(g)</th>
                  <th className="px-2 py-1 text-right">コスト</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 text-slate-800">
                    <td className="px-2 py-1 font-semibold">{r.name}</td>
                    <td className="px-2 py-1">{r.category}</td>
                    <td className="px-2 py-1 text-right">{r.calories}</td>
                    <td className="px-2 py-1 text-right">{r.protein}</td>
                    <td className="px-2 py-1 text-right">{r.salt}</td>
                    <td className="px-2 py-1 text-right">{r.costPerServing}</td>
                  </tr>
                ))}
                {!recipes.length && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-center text-slate-500">
                      レシピがありません
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
