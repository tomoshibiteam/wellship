"use client";

import { useEffect, useMemo, useState } from "react";

type RecipeScope = "master" | "my" | "draft";
type ReferenceFilter = "all" | "on" | "off";

type Recipe = {
  id: string;
  name: string | null;
  category: string | null;
  calories: number | null;
  protein: number | null;
  salt: number | null;
  costPerServing: number | null;
  source?: string | null;
  status?: string | null;
  // `referenceEnabled` は最終参照（override優先）
  referenceEnabled?: boolean | null;
  // 司厨の意思（恒久参照）
  chefReferenceEnabled?: boolean | null;
  // 会社の強制（override）。null=未設定
  overrideReferenceEnabled?: boolean | null;
  // 最終参照（override優先）
  effectiveReferenceEnabled?: boolean | null;
  draftText?: string | null;
  ingredientCount?: number | null;
};

type Me = {
  id: string;
  role: "CHEF" | "MANAGER";
  companyId: string;
  name: string | null;
  email: string;
};

type ChefUser = {
  id: string;
  name: string | null;
  email: string;
};

type FormState = {
  name: string;
  category: string;
  calories: string;
  protein: string;
  salt: string;
  costPerServing: string;
  draftText: string;
};

const categoryLabels: Record<string, string> = {
  main: "主菜",
  side: "副菜",
  soup: "汁物",
  dessert: "デザート",
};

const scopeLabels: Record<RecipeScope, string> = {
  master: "マスターライブラリ",
  my: "自社レシピ",
  draft: "取り込み下書き",
};

const defaultForm: FormState = {
  name: "",
  category: "",
  calories: "",
  protein: "",
  salt: "",
  costPerServing: "",
  draftText: "",
};

function toNumberOrNull(value: string) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return "—";
  return value.toFixed(digits);
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `¥${Math.round(value)}`;
}

function draftSnippet(text: string | null | undefined) {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 80)}…`;
}

function isPublishReady(recipe: Recipe) {
  return (
    Boolean(recipe.name?.trim()) &&
    Boolean(recipe.category) &&
    typeof recipe.costPerServing === "number" &&
    recipe.costPerServing > 0
  );
}

export function RecipesClient() {
  const [tab, setTab] = useState<RecipeScope>("my");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [chefs, setChefs] = useState<ChefUser[]>([]);
  const [selectedChefId, setSelectedChefId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [referenceFilter, setReferenceFilter] = useState<ReferenceFilter>("on");
  const [refreshKey, setRefreshKey] = useState(0);

  const [showImporter, setShowImporter] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [showPaste, setShowPaste] = useState(false);
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasting, setPasting] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorSource, setEditorSource] = useState<"draft" | "my">("draft");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "ユーザー情報の取得に失敗しました。");
        if (!active) return;
        setMe(json.user);
      })
      .catch((err) => {
        console.error(err);
        if (!active) return;
        setError("ユーザー情報の取得に失敗しました。再ログインしてください。");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!me || me.role !== "MANAGER") return;
    let active = true;
    fetch("/api/users/chefs", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "司厨一覧の取得に失敗しました。");
        if (!active) return;
        const list: ChefUser[] = (json.chefs ?? []).map((c: ChefUser) => ({
          id: c.id,
          name: c.name ?? null,
          email: c.email,
        }));
        setChefs(list);
        if (!selectedChefId && list.length > 0) {
          setSelectedChefId(list[0].id);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!active) return;
        setError("司厨一覧の取得に失敗しました。");
      });
    return () => {
      active = false;
    };
  }, [me, selectedChefId]);

  useEffect(() => {
    setReferenceFilter(tab === "my" ? "on" : "all");
  }, [tab]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("scope", tab);
        if (category !== "all") params.set("category", category);
        if (search.trim()) params.set("q", search.trim());
        if (tab === "my" && referenceFilter !== "all") {
          params.set("reference", referenceFilter);
        }
        if (tab === "my" && me?.role === "MANAGER" && selectedChefId) {
          params.set("chefUserId", selectedChefId);
        }
        const res = await fetch(`/api/recipes?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "レシピ一覧の取得に失敗しました。");
        }
        if (!active) return;
        setRecipes(json.recipes ?? []);
      } catch (err) {
        if (!active) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "レシピ一覧の取得に失敗しました。");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [tab, search, category, referenceFilter, refreshKey, me?.role, selectedChefId]);

  const refreshRecipes = () => setRefreshKey((prev) => prev + 1);

  const totals = useMemo(() => {
    return recipes.reduce(
      (acc, recipe) => {
        acc.total += 1;
        const key = recipe.category ?? "none";
        acc.byCategory[key] = (acc.byCategory[key] ?? 0) + 1;
        return acc;
      },
      { total: 0, byCategory: {} as Record<string, number> },
    );
  }, [recipes]);

  const resetEditor = () => {
    setShowEditor(false);
    setEditingId(null);
    setEditorSource("draft");
    setForm(defaultForm);
  };

  const openEditor = (recipe?: Recipe) => {
    if (recipe) {
      setEditingId(recipe.id);
      setEditorSource(recipe.source === "my" ? "my" : "draft");
      setForm({
        name: recipe.name ?? "",
        category: recipe.category ?? "",
        calories: recipe.calories === null || recipe.calories === undefined ? "" : recipe.calories.toString(),
        protein: recipe.protein === null || recipe.protein === undefined ? "" : recipe.protein.toString(),
        salt: recipe.salt === null || recipe.salt === undefined ? "" : recipe.salt.toString(),
        costPerServing:
          recipe.costPerServing === null || recipe.costPerServing === undefined
            ? ""
            : recipe.costPerServing.toString(),
        draftText: recipe.draftText ?? "",
      });
    } else {
      setEditingId(null);
      setEditorSource("draft");
      setForm(defaultForm);
    }
    setShowEditor(true);
    setMessage(null);
    setError(null);
  };

  const handleTabChange = (next: RecipeScope) => {
    setTab(next);
    setMessage(null);
    setError(null);
    setShowImporter(false);
    setShowPaste(false);
    setShowEditor(false);
  };

  const openImporter = () => {
    setTab("draft");
    setShowImporter((value) => !value);
    setShowPaste(false);
    setShowEditor(false);
    setMessage(null);
    setError(null);
  };

  const openPaste = () => {
    setTab("draft");
    setShowPaste((value) => !value);
    setShowImporter(false);
    setShowEditor(false);
    setMessage(null);
    setError(null);
  };

  const openManual = () => {
    setTab("draft");
    setShowImporter(false);
    setShowPaste(false);
    openEditor();
  };

  const saveRecipe = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const name = form.name.trim();
      const draftText = form.draftText.trim();
      const nextCost = toNumberOrNull(form.costPerServing);
      if (editorSource === "my" && !name) {
        throw new Error("レシピ名を入力してください。");
      }
      if (editorSource === "my" && !form.category) {
        throw new Error("カテゴリを選択してください。");
      }
      if (editorSource === "my" && (nextCost === null || nextCost <= 0)) {
        throw new Error("原価を入力してください。");
      }
      if (editorSource === "draft" && !name && !draftText) {
        throw new Error("レシピ名か下書きテキストを入力してください。");
      }

      const payload = {
        id: editingId ?? undefined,
        name: name || null,
        category: form.category || null,
        calories: toNumberOrNull(form.calories),
        protein: toNumberOrNull(form.protein),
        salt: toNumberOrNull(form.salt),
        costPerServing: nextCost,
        draftText: draftText || null,
      };

      const res = await fetch("/api/recipes", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "保存に失敗しました。");
      }
      setMessage(editingId ? "レシピを更新しました。" : "下書きを追加しました。");
      resetEditor();
      setRecipes((prev) => {
        if (editingId) {
          return prev.map((item) => (item.id === editingId ? { ...item, ...json.recipe } : item));
        }
        if (json.recipe) {
          return [json.recipe, ...prev];
        }
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const publishDraftFromEditor = async () => {
    if (!editingId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const name = form.name.trim();
      const draftText = form.draftText.trim();
      const nextCost = toNumberOrNull(form.costPerServing);
      if (!name || !form.category || nextCost === null || nextCost <= 0) {
        throw new Error("公開にはレシピ名・カテゴリ・原価が必要です。");
      }
      const res = await fetch("/api/recipes/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name,
          category: form.category,
          calories: toNumberOrNull(form.calories),
          protein: toNumberOrNull(form.protein),
          salt: toNumberOrNull(form.salt),
          costPerServing: nextCost,
          draftText: draftText || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "公開に失敗しました。");
      }
      setMessage("公開しました。自社レシピに移動しました。");
      resetEditor();
      setRecipes((prev) => prev.filter((item) => item.id !== editingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "公開に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const handlePaste = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/recipes/draft-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pasteName.trim() || null,
          draftText: pasteText.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "下書きの作成に失敗しました。");
      }
      setMessage("テキストから下書きを作成しました。");
      setPasteName("");
      setPasteText("");
      setShowPaste(false);
      setRecipes((prev) => [json.recipe, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "下書きの作成に失敗しました。");
    } finally {
      setPasting(false);
    }
  };

  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!csvFile) {
      setError("CSVファイルを選択してください。");
      return;
    }
    setImporting(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      const res = await fetch("/api/recipes/import-csv", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "CSVインポートに失敗しました。");
      }
      setMessage(
        `CSVを取り込みました（${json.createdRecipes ?? 0}件追加 / ${json.updatedRecipes ?? 0}件更新）`,
      );
      setCsvFile(null);
      setShowImporter(false);
      refreshRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSVインポートに失敗しました。");
    } finally {
      setImporting(false);
    }
  };

  const handleCopy = async (recipe: Recipe) => {
    setActionId(recipe.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/recipes/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterId: recipe.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "コピーに失敗しました。");
      }
      setMessage("自社レシピに追加しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "コピーに失敗しました。");
    } finally {
      setActionId(null);
    }
  };

  const handleReference = async (recipe: Recipe) => {
    setActionId(recipe.id);
    setMessage(null);
    setError(null);
    try {
      const isManager = me?.role === "MANAGER";
      const targetUserId = isManager ? selectedChefId : null;
      if (isManager && !targetUserId) {
        throw new Error("対象の司厨を選択してください。");
      }
      const reason = isManager ? window.prompt("変更理由（短文）を入力してください", "") : "";
      if (isManager && (!reason || !reason.trim())) {
        throw new Error("変更理由が必要です。");
      }
      const chefEnabled = recipe.chefReferenceEnabled ?? false;
      const res = await fetch("/api/recipes/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: recipe.id,
          enabled: !chefEnabled,
          mode: "chef",
          targetUserId,
          reason,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "参照切替に失敗しました。");
      }
      setRecipes((prev) =>
        prev.map((item) => (item.id === recipe.id ? { ...item, ...json.recipe } : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "参照切替に失敗しました。");
    } finally {
      setActionId(null);
    }
  };

  const handleArchive = async (recipe: Recipe) => {
    if (!confirm("このレシピをアーカイブしますか？")) return;
    setActionId(recipe.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/recipes/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recipe.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "アーカイブに失敗しました。");
      }
      setMessage("アーカイブしました。");
      setRecipes((prev) => prev.filter((item) => item.id !== recipe.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "アーカイブに失敗しました。");
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteDraft = async (recipe: Recipe) => {
    if (!confirm("この下書きを削除しますか？")) return;
    setActionId(recipe.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/recipes?id=${recipe.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "削除に失敗しました。");
      }
      setMessage("下書きを削除しました。");
      setRecipes((prev) => prev.filter((item) => item.id !== recipe.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました。");
    } finally {
      setActionId(null);
    }
  };

  const handlePublishDraft = async (recipe: Recipe) => {
    if (!isPublishReady(recipe)) {
      openEditor(recipe);
      setMessage("公開にはレシピ名・カテゴリ・原価が必要です。");
      return;
    }
    setActionId(recipe.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/recipes/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          calories: recipe.calories,
          protein: recipe.protein,
          salt: recipe.salt,
          costPerServing: recipe.costPerServing,
          draftText: recipe.draftText ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "公開に失敗しました。");
      }
      setMessage("公開しました。自社レシピに移動しました。");
      setRecipes((prev) => prev.filter((item) => item.id !== recipe.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "公開に失敗しました。");
    } finally {
      setActionId(null);
    }
  };

  const categoryOptions = [
    { value: "", label: "未設定" },
    { value: "main", label: "主菜" },
    { value: "side", label: "副菜" },
    { value: "soup", label: "汁物" },
    { value: "dessert", label: "デザート" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              レシピ管理
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{scopeLabels[tab]}</h2>
            <p className="mt-1 text-xs text-slate-600">
              参照ONの自社レシピのみが献立AIに渡されます。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openPaste}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              テキスト貼り付け
            </button>
            <button
              type="button"
              onClick={openImporter}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              CSVインポート
            </button>
            {tab === "draft" ? (
              <button
                type="button"
                onClick={openManual}
                className="flex items-center gap-2 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <span className="text-base leading-none">＋</span>
                <span>手入力</span>
              </button>
            ) : null}
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {totals.total}件
            </span>
          </div>
        </div>

        {tab === "my" && me?.role === "MANAGER" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              対象司厨
            </span>
            <select
              value={selectedChefId ?? ""}
              onChange={(event) => setSelectedChefId(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              {chefs.length === 0 ? <option value="">（司厨がいません）</option> : null}
              {chefs.map((chef) => (
                <option key={chef.id} value={chef.id}>
                  {chef.name ? `${chef.name}（${chef.email}）` : chef.email}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["master", "my", "draft"] as RecipeScope[]).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => handleTabChange(scope)}
              className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                tab === scope
                  ? "bg-sky-600 text-white shadow-sm"
                  : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {scopeLabels[scope]}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            キーワード
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="レシピ名で検索"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            カテゴリ
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">すべて</option>
              {categoryOptions
                .filter((option) => option.value)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          {tab === "my" ? (
            <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              参照状態
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { value: "all", label: "すべて" },
                  { value: "on", label: "参照ONのみ" },
                  { value: "off", label: "未参照" },
                ] as const).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setReferenceFilter(item.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      referenceFilter === item.value
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              {tab === "draft"
                ? "下書きは公開後に参照ONできます。"
                : "マスターは読み取り専用です。"}
            </div>
          )}
        </div>

        {showImporter ? (
          <form
            onSubmit={handleImport}
            className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/50 p-4"
          >
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  CSVインポート（下書きに追加）
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  レシピ名,カテゴリ,カロリー,たんぱく質,塩分,原価,食材名,使用量,単位,保管区分,単価
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setCsvFile(file);
                  }}
                  className="text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-700"
                />
                <button
                  type="submit"
                  disabled={importing || !csvFile}
                  className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importing ? "取り込み中..." : "CSV取り込み"}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {showPaste ? (
          <form
            onSubmit={handlePaste}
            className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  テキスト貼り付け（下書き作成）
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  既存の献立表やレシピメモを貼り付けて下書きを作成します。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaste(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              >
                閉じる
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                仮タイトル（任意）
                <input
                  value={pasteName}
                  onChange={(event) => setPasteName(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="例: 港別メニュー案"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
                貼り付けテキスト
                <textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="レシピや献立メモを貼り付けてください"
                />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={pasting || !pasteText.trim()}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {pasting ? "作成中..." : "下書きを作成"}
              </button>
            </div>
          </form>
        ) : null}

        {showEditor ? (
          <form
            onSubmit={saveRecipe}
            className="mt-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_10px_24px_rgba(14,94,156,0.08)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {editingId ? "レシピ編集" : "例外: 手入力"}
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  {editingId ? "レシピを編集" : "新しい下書きを追加"}
                </h3>
                {editorSource === "draft" ? (
                  <p className="mt-1 text-xs text-slate-500">
                    公開には「レシピ名・カテゴリ・原価」が必要です。
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={resetEditor}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              >
                閉じる
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  レシピ名
                </span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="例: 鶏の照り焼き"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  カテゴリ
                </span>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  カロリー
                </span>
                <input
                  value={form.calories}
                  onChange={(event) => setForm({ ...form, calories: event.target.value })}
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="例: 520"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  たんぱく質
                </span>
                <input
                  value={form.protein}
                  onChange={(event) => setForm({ ...form, protein: event.target.value })}
                  type="number"
                  min={0}
                  step="0.1"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="例: 28"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  塩分
                </span>
                <input
                  value={form.salt}
                  onChange={(event) => setForm({ ...form, salt: event.target.value })}
                  type="number"
                  min={0}
                  step="0.1"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="例: 1.2"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  原価
                </span>
                <input
                  value={form.costPerServing}
                  onChange={(event) => setForm({ ...form, costPerServing: event.target.value })}
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="例: 320"
                />
              </label>

              {editorSource === "draft" ? (
                <label className="space-y-2 text-sm text-slate-600 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    下書きテキスト
                  </span>
                  <textarea
                    value={form.draftText}
                    onChange={(event) => setForm({ ...form, draftText: event.target.value })}
                    className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder="取り込み内容をメモしておくと整理が楽になります"
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {saving ? "保存中..." : editingId ? "更新する" : "下書きを保存"}
              </button>
              {editorSource === "draft" && editingId ? (
                <button
                  type="button"
                  onClick={publishDraftFromEditor}
                  disabled={saving}
                  className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  公開する
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {message ? <p className="mt-4 text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        {tab === "master" && !loading && recipes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            マスターライブラリが空です。シードパック（CSV/SQL）を投入してください。
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">レシピ名</th>
                <th className="px-3 py-2">カテゴリ</th>
                <th className="px-3 py-2 text-right">kcal</th>
                <th className="px-3 py-2 text-right">P(g)</th>
                <th className="px-3 py-2 text-right">塩分(g)</th>
                <th className="px-3 py-2 text-right">原価</th>
                <th className="px-3 py-2 text-right">食材数</th>
                {tab === "my" ? <th className="px-3 py-2 text-right">参照（司厨）</th> : null}
                {tab === "my" && me?.role === "MANAGER" ? (
                  <th className="px-3 py-2 text-right">参照（会社強制）</th>
                ) : null}
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    className="px-3 py-4 text-slate-600"
                    colSpan={tab === "my" ? (me?.role === "MANAGER" ? 10 : 9) : 8}
                  >
                    読み込み中...
                  </td>
                </tr>
              ) : null}
              {!loading && recipes.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-4 text-slate-600"
                    colSpan={tab === "my" ? (me?.role === "MANAGER" ? 10 : 9) : 8}
                  >
                    レシピが見つかりません。
                  </td>
                </tr>
              ) : null}
              {!loading &&
                recipes.map((recipe) => {
                  const name = recipe.name?.trim() || "（未設定）";
                  const snippet = draftSnippet(recipe.draftText);
                  const categoryLabel = recipe.category
                    ? categoryLabels[recipe.category] ?? recipe.category
                    : "未設定";
                  return (
                    <tr key={recipe.id} className="text-slate-800">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900">{name}</div>
                        {tab === "draft" && snippet ? (
                          <div className="mt-1 text-xs text-slate-500">{snippet}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{categoryLabel}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(recipe.calories)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(recipe.protein, 1)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(recipe.salt, 1)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(recipe.costPerServing)}</td>
                      <td className="px-3 py-2 text-right">{recipe.ingredientCount ?? 0}</td>
                      {tab === "my" ? (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleReference(recipe)}
                            disabled={actionId === recipe.id}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              (recipe.chefReferenceEnabled ?? false)
                                ? "bg-emerald-600 text-white"
                                : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                            }`}
                          >
                            {(recipe.chefReferenceEnabled ?? false) ? "ON" : "OFF"}
                          </button>
                        </td>
                      ) : null}
                      {tab === "my" && me?.role === "MANAGER" ? (
                        <td className="px-3 py-2 text-right">
                          <select
                            value={
                              recipe.overrideReferenceEnabled === null ||
                              recipe.overrideReferenceEnabled === undefined
                                ? ""
                                : recipe.overrideReferenceEnabled
                                  ? "on"
                                  : "off"
                            }
                            onChange={async (event) => {
                              const next = event.target.value;
                              const targetUserId = selectedChefId;
                              if (!targetUserId) return;
                              const reason = window.prompt("変更理由（短文）を入力してください", "");
                              if (!reason || !reason.trim()) return;
                              setActionId(recipe.id);
                              setMessage(null);
                              setError(null);
                              try {
                                const res = await fetch("/api/recipes/reference", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    id: recipe.id,
                                    enabled: next === "" ? null : next === "on",
                                    mode: "override",
                                    targetUserId,
                                    reason,
                                  }),
                                });
                                const json = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  throw new Error(json?.error || "会社強制の更新に失敗しました。");
                                }
                                setRecipes((prev) =>
                                  prev.map((item) =>
                                    item.id === recipe.id ? { ...item, ...json.recipe } : item,
                                  ),
                                );
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "会社強制の更新に失敗しました。",
                                );
                              } finally {
                                setActionId(null);
                              }
                            }}
                            disabled={actionId === recipe.id}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
                          >
                            <option value="">未設定</option>
                            <option value="on">強制ON</option>
                            <option value="off">強制OFF</option>
                          </select>
                          <div className="mt-1 text-[11px] text-slate-500">
                            最終:{(recipe.effectiveReferenceEnabled ?? recipe.referenceEnabled) ? "ON" : "OFF"}
                          </div>
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {tab === "master" ? (
                            <button
                              type="button"
                              onClick={() => handleCopy(recipe)}
                              disabled={actionId === recipe.id}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-60"
                            >
                              自社に追加
                            </button>
                          ) : null}
                          {tab === "my" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditor(recipe)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                onClick={() => handleArchive(recipe)}
                                disabled={actionId === recipe.id}
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-60"
                              >
                                アーカイブ
                              </button>
                            </>
                          ) : null}
                          {tab === "draft" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePublishDraft(recipe)}
                                disabled={actionId === recipe.id}
                                className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-60"
                              >
                                公開
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditor(recipe)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDraft(recipe)}
                                disabled={actionId === recipe.id}
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-60"
                              >
                                破棄
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
