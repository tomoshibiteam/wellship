'use client';

import { Fragment, useState } from "react";
import { Recipe } from "@prisma/client";
import { GeneratedDay } from "@/app/(chef)/planning/actions";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface WeekMenuTableProps {
    plan: GeneratedDay[];
    budget?: number; // 1人1日あたりの予算（円）
    onReplaceRecipe: (
        dayIndex: number,
        meal: keyof GeneratedDay["meals"],
        recipeIndex: number,
        date: string
    ) => void;
}

const DAYS_PER_PAGE = 7;

export function WeekMenuTable({ plan, budget = 1200, onReplaceRecipe }: WeekMenuTableProps) {
    const [currentPage, setCurrentPage] = useState(0);
    const [expandedDay, setExpandedDay] = useState<number | null>(null);

    const totalPages = Math.ceil(plan.length / DAYS_PER_PAGE);
    const startIdx = currentPage * DAYS_PER_PAGE;
    const visibleDays = plan.slice(startIdx, startIdx + DAYS_PER_PAGE);

    const goToPrev = () => setCurrentPage((p) => Math.max(0, p - 1));
    const goToNext = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
    };

    const getMainDish = (recipes: Recipe[]) => {
        const main = recipes.find(r => r.category === 'main');
        return main?.name ?? recipes[0]?.name ?? '-';
    };

    const toggleExpand = (dayIndex: number) => {
        setExpandedDay(expandedDay === dayIndex ? null : dayIndex);
    };

    return (
        <div className="space-y-3">
            {/* Navigation */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                    {plan.length}日分の献立
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={goToPrev}
                        disabled={currentPage === 0}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium text-slate-700">
                        {startIdx + 1}〜{Math.min(startIdx + DAYS_PER_PAGE, plan.length)}日目
                    </span>
                    <button
                        onClick={goToNext}
                        disabled={currentPage >= totalPages - 1}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="w-8 px-3 py-2.5"></th>
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-600">日付</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                                    朝食
                                </span>
                            </th>
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                                    昼食
                                </span>
                            </th>
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
                                    夕食
                                </span>
                            </th>
                            <th className="w-20 px-3 py-2.5 text-center font-semibold text-slate-600">1人/日</th>
                            <th className="w-16 px-3 py-2.5 text-center font-semibold text-slate-600">Score</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {visibleDays.map((day, idx) => {
                            const globalIdx = startIdx + idx;
                            const isExpanded = expandedDay === globalIdx;

                            return (
                                <Fragment key={day.date}>
                                    {/* Main Row */}
                                    <tr
                                        onClick={() => toggleExpand(globalIdx)}
                                        className={`cursor-pointer transition hover:bg-sky-50/50 ${isExpanded ? 'bg-sky-50/70' : ''}`}
                                    >
                                        <td className="px-3 py-2.5 text-slate-400">
                                            {isExpanded ? (
                                                <ChevronUpIcon className="h-4 w-4" />
                                            ) : (
                                                <ChevronDownIcon className="h-4 w-4" />
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="font-medium text-slate-900">{formatDate(day.date)}</div>
                                            <div className="text-[10px] text-slate-400">{day.dayLabel}</div>
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-700">{getMainDish(day.meals.breakfast)}</td>
                                        <td className="px-3 py-2.5 text-slate-700">{getMainDish(day.meals.lunch)}</td>
                                        <td className="px-3 py-2.5 text-slate-700">{getMainDish(day.meals.dinner)}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            {(() => {
                                                const cost = day.totals.cost ?? 0;
                                                return (
                                                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${cost <= budget ? 'bg-emerald-100 text-emerald-700' :
                                                        cost <= budget * 1.1 ? 'bg-amber-100 text-amber-700' :
                                                            'bg-rose-100 text-rose-700'
                                                        }`}>
                                                        ¥{Math.round(cost)}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${day.healthScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                day.healthScore >= 60 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                {day.healthScore}
                                            </span>
                                        </td>
                                    </tr>

                                    {/* Expanded Details - Visual Health Report */}
                                    {isExpanded && (
                                        <tr className="bg-gradient-to-r from-slate-50 to-sky-50/30">
                                            <td colSpan={7} className="px-4 py-5">
                                                <div className="grid gap-5 lg:grid-cols-4">
                                                    {/* Health Score Visual */}
                                                    <div className="flex flex-col items-center justify-center rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
                                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Health Score</p>
                                                        <div className="relative flex h-24 w-24 items-center justify-center">
                                                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                                                <path
                                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                    fill="none"
                                                                    stroke="#e2e8f0"
                                                                    strokeWidth="3"
                                                                />
                                                                <path
                                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                    fill="none"
                                                                    stroke={day.healthScore >= 80 ? '#10b981' : day.healthScore >= 60 ? '#f59e0b' : '#ef4444'}
                                                                    strokeWidth="3"
                                                                    strokeDasharray={`${day.healthScore}, 100`}
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                            <span className={`absolute text-2xl font-bold ${day.healthScore >= 80 ? 'text-emerald-600' : day.healthScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                                {day.healthScore}
                                                            </span>
                                                        </div>
                                                        <p className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${day.healthScore >= 80 ? 'bg-emerald-100 text-emerald-700' : day.healthScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {day.healthScore >= 80 ? '優秀' : day.healthScore >= 60 ? '良好' : '要改善'}
                                                        </p>
                                                    </div>

                                                    {/* Nutrition Breakdown */}
                                                    <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm lg:col-span-2">
                                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">栄養バランス</p>
                                                        <div className="space-y-3">
                                                            {/* Calories */}
                                                            <div>
                                                                <div className="mb-1 flex items-center justify-between text-xs">
                                                                    <span className="font-medium text-slate-600">🔥 カロリー</span>
                                                                    <span className="font-bold text-slate-800">{Math.round(day.totals.calories)} / 2200 kcal</span>
                                                                </div>
                                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
                                                                        style={{ width: `${Math.min(100, (day.totals.calories / 2200) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {/* Protein */}
                                                            <div>
                                                                <div className="mb-1 flex items-center justify-between text-xs">
                                                                    <span className="font-medium text-slate-600">💪 タンパク質</span>
                                                                    <span className="font-bold text-slate-800">{Math.round(day.totals.protein)} / 60 g</span>
                                                                </div>
                                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all"
                                                                        style={{ width: `${Math.min(100, (day.totals.protein / 60) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {/* Salt */}
                                                            <div>
                                                                <div className="mb-1 flex items-center justify-between text-xs">
                                                                    <span className="font-medium text-slate-600">🧂 塩分</span>
                                                                    <span className={`font-bold ${day.totals.salt > 7.5 ? 'text-rose-600' : 'text-slate-800'}`}>{day.totals.salt.toFixed(1)} / 7.5 g</span>
                                                                </div>
                                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${day.totals.salt > 7.5 ? 'bg-gradient-to-r from-rose-400 to-red-600' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}
                                                                        style={{ width: `${Math.min(100, (day.totals.salt / 7.5) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Health Tips */}
                                                        <div className="mt-4 rounded-lg bg-gradient-to-r from-sky-50 to-teal-50 p-2.5">
                                                            <p className="text-xs text-slate-600">
                                                                {day.totals.protein >= 60 && day.totals.salt <= 7.5 ? '✨ 栄養バランスが理想的です！' :
                                                                    day.totals.salt > 7.5 ? '⚠️ 塩分が高めです。汁物を控えめに。' :
                                                                        day.totals.protein < 50 ? '💡 タンパク質をもう少し増やしましょう。' :
                                                                            '👍 良いバランスですが、微調整で改善可能です。'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Cost Analysis */}
                                                    <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
                                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">コスト分析</p>
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-3xl font-bold ${day.totals.cost <= budget ? 'text-emerald-600' : day.totals.cost <= budget * 1.1 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                                ¥{Math.round(day.totals.cost)}
                                                            </span>
                                                            <span className="text-xs text-slate-500">/ 1人1日</span>
                                                            <div className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${day.totals.cost <= budget ? 'bg-emerald-100 text-emerald-700' : day.totals.cost <= budget * 1.1 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                予算{day.totals.cost <= budget ? '内' : day.totals.cost <= budget * 1.1 ? '+10%' : 'オーバー'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Meals Grid */}
                                                <div className="mt-5 grid gap-4 md:grid-cols-3">
                                                    {(['breakfast', 'lunch', 'dinner'] as const).map((mealKey) => (
                                                        <div key={mealKey} className={`rounded-xl border-2 bg-white p-4 shadow-sm ${mealKey === 'breakfast' ? 'border-amber-200' :
                                                            mealKey === 'lunch' ? 'border-sky-200' : 'border-indigo-200'
                                                            }`}>
                                                            <h4 className={`mb-3 flex items-center gap-2 text-sm font-bold ${mealKey === 'breakfast' ? 'text-amber-600' :
                                                                mealKey === 'lunch' ? 'text-sky-600' : 'text-indigo-600'
                                                                }`}>
                                                                <span className="text-lg">
                                                                    {mealKey === 'breakfast' ? '🌅' : mealKey === 'lunch' ? '☀️' : '🌙'}
                                                                </span>
                                                                {mealKey === 'breakfast' ? '朝食' : mealKey === 'lunch' ? '昼食' : '夕食'}
                                                            </h4>
                                                            <ul className="space-y-2">
                                                                {day.meals[mealKey].map((recipe, recipeIdx) => (
                                                                    <li key={recipe.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2">
                                                                        <div className="min-w-0 flex-1">
                                                                            <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${recipe.category === 'main' ? 'bg-red-100 text-red-600' :
                                                                                recipe.category === 'side' ? 'bg-green-100 text-green-600' :
                                                                                    recipe.category === 'soup' ? 'bg-amber-100 text-amber-600' :
                                                                                        'bg-purple-100 text-purple-600'
                                                                                }`}>
                                                                                {recipe.category === 'main' ? '主菜' : recipe.category === 'side' ? '副菜' : recipe.category === 'soup' ? '汁物' : '他'}
                                                                            </span>
                                                                            <span className="text-sm font-medium text-slate-800">{recipe.name}</span>
                                                                            <div className="mt-0.5 flex gap-2 text-[10px] text-slate-500">
                                                                                <span>{recipe.calories}kcal</span>
                                                                                <span>P:{recipe.protein}g</span>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onReplaceRecipe(globalIdx, mealKey, recipeIdx, day.date);
                                                                            }}
                                                                            className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm transition hover:bg-sky-50 hover:text-sky-600"
                                                                        >
                                                                            代替
                                                                        </button>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Page indicator */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-1">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`h-2 rounded-full transition ${i === currentPage ? 'w-6 bg-sky-500' : 'w-2 bg-slate-200 hover:bg-slate-300'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
