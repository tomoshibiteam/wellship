import { getAllRecipes } from "@/lib/repositories/recipes";

export default async function RecipeDebugTable() {
  const recipes = await getAllRecipes();

  if (!recipes.length) {
    return (
      <div className="rounded-2xl border border-sky-100 bg-white/80 p-5 text-sm text-slate-700 shadow-[0_12px_32px_rgba(14,94,156,0.05)]">
        デバッグ用に表示するレシピがまだありません。
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Debug
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            登録済みレシピ一覧
          </h2>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
          PoC data
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">カテゴリ</th>
              <th className="px-3 py-2 text-right">kcal</th>
              <th className="px-3 py-2 text-right">タンパク質(g)</th>
              <th className="px-3 py-2 text-right">塩分(g)</th>
              <th className="px-3 py-2 text-right">コスト(円)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recipes.map((recipe) => (
              <tr key={recipe.id} className="text-slate-800">
                <td className="px-3 py-2 font-semibold">{recipe.name}</td>
                <td className="px-3 py-2 text-slate-600">{recipe.category}</td>
                <td className="px-3 py-2 text-right">{recipe.calories}</td>
                <td className="px-3 py-2 text-right">{recipe.protein}</td>
                <td className="px-3 py-2 text-right">{recipe.salt}</td>
                <td className="px-3 py-2 text-right">{recipe.costPerServing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
