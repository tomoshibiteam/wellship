'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RecipeCategory } from '@prisma/client';
import { safeJsonRequest } from '@/lib/offline/retry-queue';
import { loadDraft, saveDraft, clearDraft } from '@/lib/offline/draft-storage';

type MealType = 'breakfast' | 'lunch' | 'dinner';
type ViewMode = 'calendar' | 'day' | 'day-summary';

interface Recipe {
    id: string;
    name: string;
    category: RecipeCategory;
    calories: number;
    protein: number;
    salt: number;
    costPerServing: number;
}

interface MenuPlan {
    id: string;
    date: string;
    mealType: MealType;
    healthScore: number;
    recipes: Recipe[];
}

interface DailyMenuClientProps {
    vesselId: string;
    vesselName: string;
    recipes: Recipe[];
}

// 1日サマリー用の型
interface MealSummary {
    mealType: MealType;
    label: string;
    recipes: Array<{
        id: string;
        name: string;
        category: RecipeCategory;
        calories: number;
        protein: number;
        salt: number;
        costPerServing: number;
        ingredients: Array<{
            id: string;
            name: string;
            amount: number;
            unit: string;
        }>;
    }>;
    totalCalories: number;
    totalProtein: number;
    totalSalt: number;
    totalCost: number;
}

interface DaySummary {
    date: string;
    meals: MealSummary[];
    dailyTotals: {
        calories: number;
        protein: number;
        salt: number;
        cost: number;
    };
    ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
        storageType: string;
    }>;
}

const mealTypeLabels = {
    breakfast: { label: '朝食', icon: '🌅' },
    lunch: { label: '昼食', icon: '☀️' },
    dinner: { label: '夕食', icon: '🌙' },
};

const categoryLabels: Record<RecipeCategory, { label: string; icon: string }> = {
    main: { label: '主菜', icon: '🍖' },
    side: { label: '副菜', icon: '🥗' },
    soup: { label: '汁物', icon: '🍲' },
    dessert: { label: 'デザート', icon: '🍰' },
};

function guessMealType(): MealType {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    return 'dinner';
}

export function DailyMenuClient({
    vesselId,
    vesselName,
    recipes: allRecipes,
}: DailyMenuClientProps) {
    const viewStateKey = `wellship_daily_menu_state:${vesselId}`;
    const initialState = loadDraft(viewStateKey, {
        viewMode: 'calendar' as ViewMode,
        selectedDate: new Date().toISOString().slice(0, 10),
        mealType: guessMealType(),
    });
    const [viewMode, setViewMode] = useState<ViewMode>(initialState.viewMode);
    const [selectedDate, setSelectedDate] = useState(initialState.selectedDate);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [mealType, setMealType] = useState<MealType>(initialState.mealType);
    const [menuPlan, setMenuPlan] = useState<MenuPlan | null>(null);
    const [calendarData, setCalendarData] = useState<Record<string, boolean>>({});
    const [calendarSummary, setCalendarSummary] = useState<Record<string, {
        breakfast: { count: number; main?: string };
        lunch: { count: number; main?: string };
        dinner: { count: number; main?: string };
    }>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // 1日サマリー用ステート
    const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
    const [hasLocalDraft, setHasLocalDraft] = useState(false);

    const menuDraftKey = `${viewStateKey}:${selectedDate}:${mealType}`;


    // カレンダーデータ取得
    const fetchCalendarData = useCallback(async () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
        const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

        try {
            const res = await fetch(`/api/daily-menu/calendar?vesselId=${vesselId}&startDate=${startDate}&endDate=${endDate}`);
            if (res.ok) {
                const data = await res.json();
                setCalendarData(data.dates || {});
                setCalendarSummary(data.summary || {});
            }
        } catch {
            console.error('Failed to fetch calendar data');
        }
    }, [vesselId, calendarMonth]);

    useEffect(() => {
        if (viewMode === 'calendar') {
            fetchCalendarData();
        }
    }, [viewMode, fetchCalendarData]);

    // 日別献立取得
    const fetchMenuPlan = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/daily-menu?vesselId=${vesselId}&date=${selectedDate}&mealType=${mealType}`);
            const data = await res.json();
            if (res.ok) {
                const draft = loadDraft<{ recipeIds: string[] } | null>(menuDraftKey, null);
                if (draft?.recipeIds?.length) {
                    const draftRecipes = draft.recipeIds
                        .map((id) => allRecipes.find((r) => r.id === id))
                        .filter(Boolean) as Recipe[];
                    setMenuPlan({
                        id: data.menuPlan?.id ?? `draft-${selectedDate}-${mealType}`,
                        date: selectedDate,
                        mealType,
                        healthScore: data.menuPlan?.healthScore ?? 0,
                        recipes: draftRecipes,
                    });
                    setHasLocalDraft(true);
                } else {
                    setMenuPlan(data.menuPlan);
                    setHasLocalDraft(false);
                }
            } else {
                setError(data.error);
            }
        } catch {
            setError('献立の取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, [vesselId, selectedDate, mealType, menuDraftKey, allRecipes]);

    // 1日サマリー取得
    const fetchDaySummary = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/daily-menu/day-summary?vesselId=${vesselId}&date=${selectedDate}`);
            const data = await res.json();
            if (res.ok) {
                setDaySummary(data);
            } else {
                setError(data.error);
            }
        } catch {
            setError('1日の献立取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, [vesselId, selectedDate]);

    useEffect(() => {
        if (viewMode === 'day') {
            fetchMenuPlan();
        } else if (viewMode === 'day-summary') {
            fetchDaySummary();
        }
    }, [viewMode, fetchMenuPlan, fetchDaySummary]);

    useEffect(() => {
        saveDraft(viewStateKey, { viewMode, selectedDate, mealType });
    }, [viewMode, selectedDate, mealType, viewStateKey]);

    // 日付クリック → 1日サマリービューを表示
    const handleDayClick = (date: string) => {
        setSelectedDate(date);
        setViewMode('day-summary');
    };

    const changeMonth = (delta: number) => {
        const newMonth = new Date(calendarMonth);
        newMonth.setMonth(newMonth.getMonth() + delta);
        setCalendarMonth(newMonth);
    };


    const updateLocalDraft = (recipeIds: string[]) => {
        saveDraft(menuDraftKey, { recipeIds });
        setHasLocalDraft(true);
    };

    const clearLocalDraft = () => {
        clearDraft(menuDraftKey);
        setHasLocalDraft(false);
    };

    const buildRecipeList = (recipeIds: string[]) =>
        recipeIds
            .map((id) => allRecipes.find((recipe) => recipe.id === id))
            .filter(Boolean) as Recipe[];

    // レシピ追加
    const handleAddRecipe = async (recipeId: string) => {
        if (!menuPlan) {
            const response = await safeJsonRequest({
                url: '/api/daily-menu',
                method: 'POST',
                body: {
                    vesselId,
                    date: selectedDate,
                    mealType,
                    recipeIds: [recipeId],
                },
                feature: 'daily-menu',
            });
            if (response.queued) {
                const nextIds = [recipeId];
                setMenuPlan({
                    id: `draft-${selectedDate}-${mealType}`,
                    date: selectedDate,
                    mealType,
                    healthScore: 0,
                    recipes: buildRecipeList(nextIds),
                });
                updateLocalDraft(nextIds);
                setSuccessMessage('通信が不安定です。保存を保留しました。');
                setShowRecipeModal(false);
                setReplaceTarget(null);
                return;
            }
            if (!response.ok) {
                setError('献立の保存に失敗しました');
                return;
            }
        } else {
            const response = await safeJsonRequest({
                url: '/api/daily-menu',
                method: 'PUT',
                body: {
                    menuPlanId: menuPlan.id,
                    action: 'add',
                    recipeId,
                },
                feature: 'daily-menu',
            });
            if (response.queued) {
                const nextIds = [...menuPlan.recipes.map((r) => r.id), recipeId];
                setMenuPlan({ ...menuPlan, recipes: buildRecipeList(nextIds) });
                updateLocalDraft(nextIds);
                setSuccessMessage('通信が不安定です。保存を保留しました。');
                setShowRecipeModal(false);
                setReplaceTarget(null);
                return;
            }
            if (!response.ok) {
                setError('献立の保存に失敗しました');
                return;
            }
        }
        setShowRecipeModal(false);
        setReplaceTarget(null);
        fetchMenuPlan();
        clearLocalDraft();
    };

    // レシピ入替
    const handleReplaceRecipe = async (newRecipeId: string) => {
        if (!menuPlan || !replaceTarget) return;
        const response = await safeJsonRequest({
            url: '/api/daily-menu',
            method: 'PUT',
            body: {
                menuPlanId: menuPlan.id,
                action: 'replace',
                recipeId: replaceTarget,
                newRecipeId,
            },
            feature: 'daily-menu',
        });
        if (response.queued) {
            const nextIds = menuPlan.recipes.map((recipe) =>
                recipe.id === replaceTarget ? newRecipeId : recipe.id,
            );
            setMenuPlan({ ...menuPlan, recipes: buildRecipeList(nextIds) });
            updateLocalDraft(nextIds);
            setSuccessMessage('通信が不安定です。保存を保留しました。');
            setShowRecipeModal(false);
            setReplaceTarget(null);
            return;
        }
        if (!response.ok) {
            setError('献立の保存に失敗しました');
            return;
        }
        setShowRecipeModal(false);
        setReplaceTarget(null);
        fetchMenuPlan();
        clearLocalDraft();
    };

    // レシピ削除
    const handleRemoveRecipe = async (recipeId: string) => {
        if (!menuPlan) return;
        const response = await safeJsonRequest({
            url: '/api/daily-menu',
            method: 'PUT',
            body: {
                menuPlanId: menuPlan.id,
                action: 'remove',
                recipeId,
            },
            feature: 'daily-menu',
        });
        if (response.queued) {
            const nextIds = menuPlan.recipes.map((r) => r.id).filter((id) => id !== recipeId);
            setMenuPlan({ ...menuPlan, recipes: buildRecipeList(nextIds) });
            updateLocalDraft(nextIds);
            setSuccessMessage('通信が不安定です。保存を保留しました。');
            return;
        }
        if (!response.ok) {
            setError('献立の保存に失敗しました');
            return;
        }
        fetchMenuPlan();
        clearLocalDraft();
    };

    // 前日から複製
    const handleCopyFromYesterday = async () => {
        const result = await safeJsonRequest({
            url: '/api/daily-menu/copy',
            method: 'POST',
            body: {
                vesselId,
                targetDate: selectedDate,
                mealType,
            },
            feature: 'daily-menu',
        });
        if (result.queued) {
            setSuccessMessage('通信が不安定です。複製を保留しました。');
            return;
        }
        const data = await result.response?.json().catch(() => ({}));
        if (!result.ok) {
            setError(data.error);
        } else {
            setSuccessMessage('前日の献立を複製しました');
            fetchMenuPlan();
            setTimeout(() => setSuccessMessage(null), 3000);
        }
    };

    // AI献立をインポート
    const handleImportFromAI = async () => {
        setIsImporting(true);
        setShowImportModal(false);
        try {
            const result = await safeJsonRequest({
                url: '/api/daily-menu/import-from-planning',
                method: 'POST',
                body: {
                    vesselId,
                    targetDate: selectedDate,
                    mealType,
                },
                feature: 'daily-menu',
            });
            if (result.queued) {
                setSuccessMessage('通信が不安定です。取り込みを保留しました。');
            } else {
                const data = await result.response?.json().catch(() => ({}));
                if (!result.ok) {
                    setError(data.error || 'AI献立の取り込みに失敗しました');
                } else {
                    setSuccessMessage(`${data.count}品をAI献立から取り込みました`);
                    fetchMenuPlan();
                    setTimeout(() => setSuccessMessage(null), 3000);
                }
            }
        } catch {
            setError('AI献立の取り込みに失敗しました');
        } finally {
            setIsImporting(false);
        }
    };

    // CSVファイルアップロード（カレンダーからの一括取込対応）
    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setShowImportModal(false);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('vesselId', vesselId);
            formData.append('targetDate', selectedDate);
            formData.append('mealType', mealType);

            const res = await fetch('/api/daily-menu/import-csv', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'CSVの読み込みに失敗しました');
            } else {
                // 成功メッセージ（詳細フォーマットの場合は日数を表示）
                const message = data.message || `${data.count}件の献立を取り込みました`;
                setSuccessMessage(message);

                // カレンダーデータと日別データをリフレッシュ
                fetchCalendarData();
                if (viewMode === 'day') {
                    fetchMenuPlan();
                }
                setTimeout(() => setSuccessMessage(null), 5000);
            }
        } catch {
            setError('CSVの読み込みに失敗しました');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // 先週同曜日から複製
    const handleCopyFromLastWeek = async () => {
        setIsImporting(true);
        setShowImportModal(false);
        try {
            const result = await safeJsonRequest({
                url: '/api/daily-menu/copy-from-week',
                method: 'POST',
                body: {
                    vesselId,
                    targetDate: selectedDate,
                    mealType,
                },
                feature: 'daily-menu',
            });
            if (result.queued) {
                setSuccessMessage('通信が不安定です。複製を保留しました。');
            } else {
                const data = await result.response?.json().catch(() => ({}));
                if (!result.ok) {
                    setError(data.error || '先週の献立の複製に失敗しました');
                } else {
                    setSuccessMessage('先週の同曜日から複製しました');
                    fetchMenuPlan();
                    setTimeout(() => setSuccessMessage(null), 3000);
                }
            }
        } catch {
            setError('先週の献立の複製に失敗しました');
        } finally {
            setIsImporting(false);
        }
    };

    const generateCalendar = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date().toISOString().slice(0, 10);

        const weeks: (number | null)[][] = [];
        let week: (number | null)[] = Array(firstDay).fill(null);

        for (let day = 1; day <= daysInMonth; day++) {
            week.push(day);
            if (week.length === 7) {
                weeks.push(week);
                week = [];
            }
        }
        if (week.length > 0) {
            while (week.length < 7) week.push(null);
            weeks.push(week);
        }

        return { weeks, year, month, today };
    };

    const filteredRecipes = allRecipes.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ===== カレンダービュー =====
    if (viewMode === 'calendar') {
        const { weeks, year, month, today } = generateCalendar();
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

        return (
            <div className="space-y-6">
                {/* ヘッダー */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🚢</span>
                        <span className="font-semibold text-slate-800">{vesselName}</span>
                        {hasLocalDraft && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                未送信あり
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => changeMonth(-1)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                            ◀ 前月
                        </button>
                        <div className="px-4 text-lg font-bold text-slate-900">
                            📅 {year}年 {monthNames[month]}
                        </div>
                        <button
                            onClick={() => changeMonth(1)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                            翌月 ▶
                        </button>
                    </div>
                </div>

                {/* インプット方法 */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
                    <span className="text-xs font-medium text-slate-500">📥 インプット:</span>
                    <button
                        onClick={() => {
                            setSelectedDate(today);
                            setViewMode('day');
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    >
                        ✏️ 手動入力
                    </button>
                    <button
                        onClick={() => window.location.href = '/planning'}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    >
                        🤖 AI生成
                    </button>
                    <button
                        onClick={async () => {
                            setIsImporting(true);
                            try {
                                const res = await fetch('/api/daily-menu/import-all-from-planning', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ vesselId }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                    setSuccessMessage(data.message);
                                    fetchCalendarData();
                                } else {
                                    setError(data.error);
                                }
                            } catch {
                                setError('一括取込に失敗しました');
                            } finally {
                                setIsImporting(false);
                            }
                        }}
                        disabled={isImporting}
                        className="rounded-lg border-2 border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                        {isImporting ? '取込中...' : '📋 AI献立を一括追加'}
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
                    >
                        {isImporting ? '取込中...' : '📄 CSV取込'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleCsvUpload}
                        className="hidden"
                    />
                </div>

                {/* エラー/成功メッセージ */}
                {error && (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        ⚠️ {error}
                        <button onClick={() => setError(null)} className="ml-2 underline">閉じる</button>
                    </div>
                )}
                {successMessage && (
                    <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
                        ✅ {successMessage}
                    </div>
                )}

                {/* カレンダー */}
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">📅 日付をクリックして詳細を編集</h3>
                    </div>
                    <div className="mb-2 grid grid-cols-7 gap-1 text-center text-sm font-medium text-slate-500">
                        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                            <div key={d} className={i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}>
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {weeks.flat().map((day, idx) => {
                            if (day === null) {
                                return <div key={idx} className="min-h-[100px]" />;
                            }
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isToday = dateStr === today;
                            const hasMenu = calendarData[dateStr];
                            const summary = calendarSummary[dateStr];
                            const dayOfWeek = idx % 7;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleDayClick(dateStr)}
                                    className={`min-h-[100px] rounded-xl border-2 p-2 text-left transition hover:shadow-md ${isToday
                                        ? 'border-slate-900 bg-slate-50'
                                        : hasMenu
                                            ? 'border-slate-300 bg-slate-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`text-lg font-bold ${dayOfWeek === 0 ? 'text-red-600' : dayOfWeek === 6 ? 'text-blue-600' : 'text-slate-700'
                                            }`}>
                                            {day}
                                        </span>
                                        {isToday && <span className="rounded bg-slate-900 px-1 text-[10px] text-white">今日</span>}
                                    </div>
                                    {summary && (
                                        <div className="mt-1 space-y-0.5 text-[10px]">
                                            {summary.breakfast?.count > 0 && (
                                                <div className="flex items-center gap-1 text-orange-600">
                                                    <span>🌅</span>
                                                    <span className="truncate">{summary.breakfast.main || `${summary.breakfast.count}品`}</span>
                                                </div>
                                            )}
                                            {summary.lunch?.count > 0 && (
                                                <div className="flex items-center gap-1 text-amber-600">
                                                    <span>☀️</span>
                                                    <span className="truncate">{summary.lunch.main || `${summary.lunch.count}品`}</span>
                                                </div>
                                            )}
                                            {summary.dinner?.count > 0 && (
                                                <div className="flex items-center gap-1 text-indigo-600">
                                                    <span>🌙</span>
                                                    <span className="truncate">{summary.dinner.main || `${summary.dinner.count}品`}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {!summary && !hasMenu && (
                                        <div className="mt-2 text-center text-xs text-slate-400">—</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="inline-block h-3 w-3 rounded border-2 border-slate-300 bg-slate-50" />
                            献立あり
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block h-3 w-3 rounded border-2 border-slate-900 bg-slate-50" />
                            今日
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ===== 1日サマリービュー =====
    if (viewMode === 'day-summary') {
        const dateObj = new Date(selectedDate);
        const dateDisplay = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})`;

        return (
            <div className="space-y-6">
                {/* ヘッダー */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                    <button
                        onClick={() => setViewMode('calendar')}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                    >
                        ◀ カレンダーに戻る
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🚢</span>
                        <span className="font-semibold text-slate-800">{vesselName}</span>
                        {hasLocalDraft && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                未送信あり
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 text-lg font-bold text-slate-900">
                            📅 {dateDisplay} の献立
                        </div>
                        <button
                            onClick={() => setViewMode('day')}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            ✏️ 編集モード
                        </button>
                    </div>
                </div>

                {/* エラー/成功メッセージ */}
                {error && (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        ⚠️ {error}
                        <button onClick={() => setError(null)} className="ml-2 underline">閉じる</button>
                    </div>
                )}
                {successMessage && (
                    <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
                        ✅ {successMessage}
                    </div>
                )}

                {isLoading ? (
                    <div className="py-12 text-center text-slate-500">読み込み中...</div>
                ) : daySummary ? (
                    <>
                        {/* 1日の総合情報 */}
                        <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5">
                            <h3 className="mb-3 text-lg font-bold text-slate-800">📊 1日の栄養・コスト</h3>
                            <div className="grid grid-cols-4 gap-4 text-center">
                                <div className="rounded-xl bg-white p-3 shadow-sm">
                                    <div className="text-2xl font-bold text-orange-600">{daySummary.dailyTotals.calories}</div>
                                    <div className="text-xs text-slate-500">カロリー(kcal)</div>
                                </div>
                                <div className="rounded-xl bg-white p-3 shadow-sm">
                                    <div className="text-2xl font-bold text-slate-900">{daySummary.dailyTotals.protein.toFixed(1)}</div>
                                    <div className="text-xs text-slate-500">タンパク質(g)</div>
                                </div>
                                <div className="rounded-xl bg-white p-3 shadow-sm">
                                    <div className="text-2xl font-bold text-rose-600">{daySummary.dailyTotals.salt.toFixed(1)}</div>
                                    <div className="text-xs text-slate-500">塩分(g)</div>
                                </div>
                                <div className="rounded-xl bg-white p-3 shadow-sm">
                                    <div className="text-2xl font-bold text-emerald-600">¥{Math.round(daySummary.dailyTotals.cost).toLocaleString()}</div>
                                    <div className="text-xs text-slate-500">食材コスト/人</div>
                                </div>
                            </div>
                        </div>

                        {/* 朝昼晩の献立 */}
                        <div className="grid gap-4 md:grid-cols-3">
                            {daySummary.meals.map(meal => (
                                <div key={meal.mealType} className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                                    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                                        <span className="text-2xl">{mealTypeLabels[meal.mealType].icon}</span>
                                        <h4 className="text-lg font-bold text-slate-800">{meal.label}</h4>
                                        <span className="ml-auto text-sm text-slate-500">
                                            {meal.totalCalories}kcal / ¥{Math.round(meal.totalCost)}
                                        </span>
                                    </div>
                                    {meal.recipes.length === 0 ? (
                                        <div className="py-4 text-center text-sm text-slate-400">
                                            献立がありません
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {meal.recipes.map(recipe => (
                                                <div key={recipe.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                                    <span className="text-lg">{categoryLabels[recipe.category]?.icon || '🍽️'}</span>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-slate-800">{recipe.name}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {recipe.calories}kcal・P{recipe.protein}g
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* 使用食材一覧 */}
                        {daySummary.ingredients.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-800">
                                    <span>🥕</span> 本日使用する食材
                                </h3>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                                    {daySummary.ingredients.map((ing, idx) => (
                                        <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                                            <span className="text-slate-700">{ing.name}</span>
                                            <span className="text-slate-500">{ing.amount}{ing.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-12 text-center text-slate-500">
                        この日の献立データがありません
                    </div>
                )}
            </div>
        );
    }

    // ===== 日別ビュー（編集モード） =====
    const dateObj = new Date(selectedDate);
    const dateDisplay = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})`;

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <button
                    onClick={() => setViewMode('calendar')}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                    ◀ カレンダーに戻る
                </button>
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🚢</span>
                    <span className="font-semibold text-slate-800">{vesselName}</span>
                    {hasLocalDraft && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            未送信あり
                        </span>
                    )}
                </div>
                <div className="px-4 text-lg font-bold text-slate-900">
                    📅 {dateDisplay}
                </div>
            </div>

            {/* 食事タイプ切替 */}
            <div className="flex gap-2">
                {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(mt => (
                    <button
                        key={mt}
                        onClick={() => setMealType(mt)}
                        className={`flex-1 rounded-xl border-2 px-4 py-3 text-center font-medium transition ${mealType === mt
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                    >
                        <span className="mr-2 text-lg">{mealTypeLabels[mt].icon}</span>
                        {mealTypeLabels[mt].label}
                    </button>
                ))}
            </div>

            {/* エラー/成功メッセージ */}
            {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                    ⚠️ {error}
                    <button onClick={() => setError(null)} className="ml-2 underline">閉じる</button>
                </div>
            )}
            {successMessage && (
                <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
                    ✅ {successMessage}
                </div>
            )}

            {/* 献立カード */}
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <span>{mealTypeLabels[mealType].icon}</span>
                    {mealTypeLabels[mealType].label}の献立
                </h3>

                {isLoading || isImporting ? (
                    <div className="py-8 text-center text-slate-500">
                        {isImporting ? '取り込み中...' : '読み込み中...'}
                    </div>
                ) : menuPlan && menuPlan.recipes.length > 0 ? (
                    <div className="space-y-3">
                        {menuPlan.recipes.map(recipe => (
                            <div
                                key={recipe.id}
                                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">
                                        {categoryLabels[recipe.category]?.icon || '🍽️'}
                                    </span>
                                    <div>
                                        <div className="font-medium text-slate-800">{recipe.name}</div>
                                        <div className="text-xs text-slate-500">
                                            {recipe.calories}kcal・P{recipe.protein}g・塩分{recipe.salt}g・¥{recipe.costPerServing}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setReplaceTarget(recipe.id);
                                            setShowRecipeModal(true);
                                        }}
                                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                        入替
                                    </button>
                                    <button
                                        onClick={() => handleRemoveRecipe(recipe.id)}
                                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-slate-500">
                        この枠にはまだ献立がありません
                    </div>
                )}

                {/* アクションボタン（追加・複製） */}
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <button
                        onClick={() => {
                            setReplaceTarget(null);
                            setShowRecipeModal(true);
                        }}
                        className="rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        ＋ 1品追加
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                        📥 インポート
                    </button>
                    <button
                        onClick={handleCopyFromYesterday}
                        className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                        📋 前日から複製
                    </button>
                    <button
                        onClick={handleCopyFromLastWeek}
                        className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                        📆 先週から複製
                    </button>
                </div>
            </div>

            {/* インポートモーダル */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <h4 className="text-lg font-semibold text-slate-900">📥 献立をインポート</h4>
                        </div>
                        <div className="space-y-3 p-6">
                            <button
                                onClick={handleImportFromAI}
                                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50"
                            >
                                <span className="text-2xl">🤖</span>
                                <div>
                                    <div className="font-medium text-slate-800">AI献立から取り込む</div>
                                    <div className="text-xs text-slate-500">献立＆調達で生成済みの献立を反映</div>
                                </div>
                            </button>
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    fileInputRef.current?.click();
                                }}
                                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50"
                            >
                                <span className="text-2xl">📄</span>
                                <div>
                                    <div className="font-medium text-slate-800">CSVファイルから取り込む</div>
                                    <div className="text-xs text-slate-500">調達リストのCSVを読み込み</div>
                                </div>
                            </button>
                            <button
                                onClick={handleCopyFromLastWeek}
                                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50"
                            >
                                <span className="text-2xl">📆</span>
                                <div>
                                    <div className="font-medium text-slate-800">先週の同曜日から複製</div>
                                    <div className="text-xs text-slate-500">1週間前の献立をコピー</div>
                                </div>
                            </button>
                        </div>
                        <div className="border-t border-slate-200 px-6 py-4">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* レシピ選択モーダル */}
            {showRecipeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <h4 className="text-lg font-semibold text-slate-900">
                                {replaceTarget ? 'レシピを入替' : 'レシピを追加'}
                            </h4>
                            <input
                                type="text"
                                placeholder="🔍 レシピを検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto p-4">
                            <div className="space-y-2">
                                {filteredRecipes.map(recipe => (
                                    <button
                                        key={recipe.id}
                                        onClick={() => replaceTarget ? handleReplaceRecipe(recipe.id) : handleAddRecipe(recipe.id)}
                                        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
                                    >
                                        <span className="text-xl">{categoryLabels[recipe.category]?.icon || '🍽️'}</span>
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-800">{recipe.name}</div>
                                            <div className="text-xs text-slate-500">
                                                {categoryLabels[recipe.category]?.label || recipe.category} | {recipe.calories}kcal
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="border-t border-slate-200 px-6 py-4">
                            <button
                                onClick={() => {
                                    setShowRecipeModal(false);
                                    setReplaceTarget(null);
                                    setSearchQuery('');
                                }}
                                className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden file input for CSV */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
            />
        </div>
    );
}
