'use client';

import { Recipe } from "@prisma/client";
import { GeneratedDay } from "@/app/(dashboard)/planning/actions";
import { RecipeCard } from "./recipe-card";
import { SunIcon, CloudIcon, MoonIcon } from "@heroicons/react/24/outline";

interface DayPlanCardProps {
    day: GeneratedDay;
    onReplaceRecipe: (
        dayIndex: number,
        meal: keyof GeneratedDay["meals"],
        recipeIndex: number,
        date: string
    ) => void;
    dayIndex: number;
}

export function DayPlanCard({ day, onReplaceRecipe, dayIndex }: DayPlanCardProps) {
    return (
        <div className="flex h-full min-w-[320px] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            {/* Header */}
            <div className="relative border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {day.dayLabel}
                        </p>
                        <h3 className="font-outfit text-xl font-bold text-slate-900">
                            {new Date(day.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </h3>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5">
                            <span className="text-2xl font-bold bg-gradient-to-br from-sky-600 to-teal-500 bg-clip-text text-transparent">
                                {day.healthScore}
                            </span>
                            <span className="text-[10px] font-bold uppercase text-slate-400">Score</span>
                        </div>

                        {/* 簡易スコアバー */}
                        <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
                                style={{ width: `${day.healthScore}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-6 scrollbar-hide">
                {/* Breakfast */}
                <section>
                    <div className="mb-2 flex items-center gap-2 text-amber-600">
                        <SunIcon className="h-4 w-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Breakfast</h4>
                    </div>
                    <div className="space-y-2">
                        {day.meals.breakfast.map((recipe, idx) => (
                            <RecipeCard
                                key={`${day.date}-breakfast-${idx}`}
                                recipe={recipe}
                                onReplace={() => onReplaceRecipe(dayIndex, 'breakfast', idx, day.date)}
                                isMain={idx === 0} // 一般的に最初が主菜
                                className="hover:border-amber-200"
                            />
                        ))}
                    </div>
                </section>

                {/* Lunch */}
                <section>
                    <div className="mb-2 flex items-center gap-2 text-sky-600">
                        <CloudIcon className="h-4 w-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Lunch</h4>
                    </div>
                    <div className="space-y-2">
                        {day.meals.lunch.map((recipe, idx) => (
                            <RecipeCard
                                key={`${day.date}-lunch-${idx}`}
                                recipe={recipe}
                                onReplace={() => onReplaceRecipe(dayIndex, 'lunch', idx, day.date)}
                                isMain={idx === 0}
                                className="hover:border-sky-200"
                            />
                        ))}
                    </div>
                </section>

                {/* Dinner */}
                <section>
                    <div className="mb-2 flex items-center gap-2 text-indigo-600">
                        <MoonIcon className="h-4 w-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Dinner</h4>
                    </div>
                    <div className="space-y-2">
                        {day.meals.dinner.map((recipe, idx) => (
                            <RecipeCard
                                key={`${day.date}-dinner-${idx}`}
                                recipe={recipe}
                                onReplace={() => onReplaceRecipe(dayIndex, 'dinner', idx, day.date)}
                                isMain={idx === 0}
                                className="hover:border-indigo-200"
                            />
                        ))}
                    </div>
                </section>
            </div>

            {/* Footer (Nutrition) */}
            <div className="border-t border-slate-100 bg-white px-5 py-3">
                <div className="grid grid-cols-3 gap-2 divide-x divide-slate-100 text-center">
                    <div>
                        <p className="text-[10px] text-slate-500">kcal</p>
                        <p className="text-sm font-bold text-slate-700">{Math.round(day.totals.calories)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500">Protein</p>
                        <p className="text-sm font-bold text-slate-700">{Math.round(day.totals.protein)}g</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500">Salt</p>
                        <p className="text-sm font-bold text-slate-700">{day.totals.salt.toFixed(1)}g</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
