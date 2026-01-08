'use client';

import { Recipe, RecipeCategory } from "@prisma/client";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

interface RecipeCardProps {
    recipe: Recipe;
    onReplace?: () => void;
    className?: string;
    isMain?: boolean;
}

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
    main: "主菜",
    side: "副菜",
    soup: "汁物",
    dessert: "デザート",
};

const CATEGORY_COLORS: Record<RecipeCategory, string> = {
    main: "bg-red-50 text-red-700 border-red-200",
    side: "bg-green-50 text-green-700 border-green-200",
    soup: "bg-amber-50 text-amber-700 border-amber-200",
    dessert: "bg-purple-50 text-purple-700 border-purple-200",
};

export function RecipeCard({ recipe, onReplace, className = "", isMain = false }: RecipeCardProps) {
    return (
        <div
            className={`group relative flex items-center justify-between rounded-lg border bg-white p-2.5 shadow-sm transition-all hover:shadow-md ${className} ${isMain ? 'border-l-4 border-l-orange-400' : 'border-slate-100'}`}
        >
            <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${CATEGORY_COLORS[recipe.category]}`}>
                        {CATEGORY_LABELS[recipe.category]}
                    </span>
                    <h4 className={`truncate text-sm text-slate-900 ${isMain ? 'font-bold' : 'font-medium'}`}>
                        {recipe.name}
                    </h4>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{recipe.calories} kcal</span>
                    <span className="flex items-center gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        P: {recipe.protein}g
                    </span>
                    <span className="flex items-center gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        塩: {recipe.salt}g
                    </span>
                </div>
            </div>

            {onReplace && (
                <button
                    onClick={onReplace}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 opacity-0 transition hover:bg-sky-50 hover:text-sky-600 group-hover:opacity-100"
                    title="代替（メニュー差し替え）"
                >
                    <ArrowPathIcon className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
