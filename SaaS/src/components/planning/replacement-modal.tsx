'use client';

import { useState, useEffect } from 'react';
import { Recipe, RecipeCategory } from '@prisma/client';

type ExclusionReason = {
    id: string;
    label: string;
    scope: 'CHEF' | 'VESSEL' | null; // nullは一時的変更
    description: string;
};

const EXCLUSION_REASONS: ExclusionReason[] = [
    { id: 'cant_make', label: '作れない（スキル）', scope: 'CHEF', description: '今後このレシピは表示されません' },
    { id: 'no_equipment', label: '設備がない', scope: 'VESSEL', description: '船全体で表示されなくなります' },
    { id: 'hard_to_get', label: '食材が入手困難', scope: 'VESSEL', description: '船全体で表示されなくなります' },
    { id: 'preference', label: '乗員の好みに合わない', scope: null, description: '今回のみ変更します' },
    { id: 'other', label: 'その他', scope: null, description: '今回のみ変更します' },
];

type AlternativeRecipe = Recipe & { healthScore: number };

interface ReplacementModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentRecipe: Recipe;
    date: string;
    mealType: string;
    vesselId: string;
    onReplaced: () => void;
}

export function ReplacementModal({
    isOpen,
    onClose,
    currentRecipe,
    date,
    mealType,
    vesselId,
    onReplaced,
}: ReplacementModalProps) {
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [alternatives, setAlternatives] = useState<AlternativeRecipe[]>([]);
    const [loading, setLoading] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchAlternatives();
            setSelectedReasons([]);
            setSelectedAlternative(null);
        }
    }, [isOpen, currentRecipe.id]);

    const fetchAlternatives = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                recipeId: currentRecipe.id,
                category: currentRecipe.category,
                vesselId,
            });
            const res = await fetch(`/api/recipes/alternatives?${params}`);
            const data = await res.json();
            setAlternatives(data.alternatives || []);
        } catch (error) {
            console.error('Failed to fetch alternatives:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReasonToggle = (reasonId: string) => {
        setSelectedReasons(prev =>
            prev.includes(reasonId)
                ? prev.filter(r => r !== reasonId)
                : [...prev, reasonId]
        );
    };

    const handleReplace = async () => {
        if (!selectedAlternative || selectedReasons.length === 0) return;

        setReplacing(true);
        try {
            // 除外理由を登録（永続的なものだけ）
            for (const reasonId of selectedReasons) {
                const reason = EXCLUSION_REASONS.find(r => r.id === reasonId);
                if (reason?.scope) {
                    await fetch('/api/recipes/exclude', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            recipeId: currentRecipe.id,
                            scope: reason.scope,
                            reason: reason.label,
                            vesselId: reason.scope === 'VESSEL' ? vesselId : undefined,
                        }),
                    });
                }
            }

            // レシピを置き換え
            await fetch('/api/menu/replace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    mealType,
                    oldRecipeId: currentRecipe.id,
                    newRecipeId: selectedAlternative,
                }),
            });

            onReplaced();
            onClose();
        } catch (error) {
            console.error('Failed to replace:', error);
        } finally {
            setReplacing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">🔄 代替レシピを選択</h2>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                            ✕
                        </button>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        「{currentRecipe.name}」の代わりを選択
                    </p>
                </div>

                {/* Reasons */}
                <div className="border-b border-slate-100 px-6 py-4">
                    <p className="mb-3 text-sm font-semibold text-slate-700">代替理由（複数選択可）</p>
                    <div className="space-y-2">
                        {EXCLUSION_REASONS.map(reason => (
                            <label
                                key={reason.id}
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selectedReasons.includes(reason.id)
                                        ? 'border-sky-400 bg-sky-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedReasons.includes(reason.id)}
                                    onChange={() => handleReasonToggle(reason.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                                />
                                <div className="flex-1">
                                    <p className="font-medium text-slate-800">{reason.label}</p>
                                    <p className="text-xs text-slate-500">{reason.description}</p>
                                </div>
                                {reason.scope && (
                                    <span className={`rounded-full px-2 py-0.5 text-xs ${reason.scope === 'CHEF' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {reason.scope === 'CHEF' ? '個人' : '船全体'}
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Alternatives */}
                <div className="px-6 py-4">
                    <p className="mb-3 text-sm font-semibold text-slate-700">代替候補</p>
                    {loading ? (
                        <div className="flex h-32 items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
                        </div>
                    ) : alternatives.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-500">
                            代替候補が見つかりませんでした
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {alternatives.map(recipe => (
                                <label
                                    key={recipe.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selectedAlternative === recipe.id
                                            ? 'border-teal-400 bg-teal-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="alternative"
                                        checked={selectedAlternative === recipe.id}
                                        onChange={() => setSelectedAlternative(recipe.id)}
                                        className="h-4 w-4 border-slate-300 text-teal-600"
                                    />
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-800">{recipe.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {recipe.calories}kcal / タンパク質{recipe.protein}g / 塩分{recipe.salt}g
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-lg">⭐</span>
                                        <span className={`text-lg font-bold ${recipe.healthScore >= 80 ? 'text-green-600' :
                                                recipe.healthScore >= 60 ? 'text-amber-600' : 'text-slate-500'
                                            }`}>
                                            {recipe.healthScore}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 px-6 py-4">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-slate-200 py-3 font-medium text-slate-600 hover:bg-slate-50"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleReplace}
                            disabled={!selectedAlternative || selectedReasons.length === 0 || replacing}
                            className="flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-teal-500 py-3 font-medium text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {replacing ? '変更中...' : '変更する'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
