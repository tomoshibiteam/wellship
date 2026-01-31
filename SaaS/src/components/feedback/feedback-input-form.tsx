'use client';

import { useEffect, useState } from 'react';
import { loadDraft, saveDraft } from '@/lib/offline/draft-storage';

interface FeedbackInputFormProps {
    crewName: string;
    menuName: string;
    draftKey?: string;
    onSubmit: (data: {
        satisfaction: number;
        volumeFeeling: 'less' | 'just' | 'much';
        leftover: 'none' | 'half' | 'almostAll';
        photoBlob: Blob | null;
        reasonTags: string | null;
    }) => void;
    isSubmitting: boolean;
}

// 質問1: 満足度（ポジティブな表現）
const satisfactionOptions = [
    { label: 'また食べたい', value: 5, emoji: '😊' },
    { label: 'ふつう', value: 3, emoji: '🙂' },
    { label: '別のがいい', value: 1, emoji: '🤔' },
];

// 質問2: 量の感覚
const volumeOptions = [
    { label: '少なめ', value: 'less' as const, emoji: '📉' },
    { label: 'ちょうどいい', value: 'just' as const, emoji: '👍' },
    { label: '多め', value: 'much' as const, emoji: '📈' },
];

// 質問3: 残食状況
const leftoverOptions = [
    { label: '完食', value: 'none' as const, emoji: '🍽️' },
    { label: '半分くらい', value: 'half' as const, emoji: '🥄' },
    { label: 'ほぼ残した', value: 'almostAll' as const, emoji: '📤' },
];

export function FeedbackInputForm({
    crewName,
    menuName,
    draftKey,
    onSubmit,
    isSubmitting,
}: FeedbackInputFormProps) {
    const [satisfaction, setSatisfaction] = useState<number | null>(null);
    const [volumeFeeling, setVolumeFeeling] = useState<'less' | 'just' | 'much' | null>(null);
    const [leftover, setLeftover] = useState<'none' | 'half' | 'almostAll' | null>(null);

    useEffect(() => {
        if (!draftKey) return;
        const draft = loadDraft<{ satisfaction: number | null; volumeFeeling: 'less' | 'just' | 'much' | null; leftover: 'none' | 'half' | 'almostAll' | null }>(
            draftKey,
            { satisfaction: null, volumeFeeling: null, leftover: null },
        );
        setSatisfaction(draft.satisfaction ?? null);
        setVolumeFeeling(draft.volumeFeeling ?? null);
        setLeftover(draft.leftover ?? null);
    }, [draftKey]);

    useEffect(() => {
        if (!draftKey) return;
        saveDraft(draftKey, { satisfaction, volumeFeeling, leftover });
    }, [draftKey, satisfaction, volumeFeeling, leftover]);

    const handleSubmit = () => {
        if (satisfaction === null || volumeFeeling === null || leftover === null) return;

        onSubmit({
            satisfaction,
            volumeFeeling,
            leftover,
            photoBlob: null,
            reasonTags: null,
        });
    };

    const allAnswered = satisfaction !== null && volumeFeeling !== null && leftover !== null;

    return (
        <div className="w-full max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900">{crewName}さん</h2>
                <p className="mt-1 text-sm text-slate-600">📍 {menuName}</p>
                <p className="mt-2 text-xs text-slate-400">3つの質問に答えてください（約30秒）</p>
            </div>

            {/* 質問1: 満足度 */}
            <div>
                <p className="mb-3 text-sm font-semibold text-slate-800">
                    Q1. また食べたいですか？
                </p>
                <div className="grid grid-cols-3 gap-3">
                    {satisfactionOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSatisfaction(opt.value)}
                            className={`rounded-xl border-2 py-4 text-center transition ${satisfaction === opt.value
                                    ? 'border-slate-900 bg-slate-100 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            <span className="block text-3xl">{opt.emoji}</span>
                            <p className="mt-2 text-sm font-medium text-slate-700">{opt.label}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* 質問2: 量の感覚 */}
            <div>
                <p className="mb-3 text-sm font-semibold text-slate-800">
                    Q2. 量はどうでしたか？
                </p>
                <div className="grid grid-cols-3 gap-3">
                    {volumeOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setVolumeFeeling(opt.value)}
                            className={`rounded-xl border-2 py-4 text-center transition ${volumeFeeling === opt.value
                                    ? 'border-slate-900 bg-slate-100 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            <span className="block text-3xl">{opt.emoji}</span>
                            <p className="mt-2 text-sm font-medium text-slate-700">{opt.label}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* 質問3: 残食状況 */}
            <div>
                <p className="mb-3 text-sm font-semibold text-slate-800">
                    Q3. どのくらい食べましたか？
                </p>
                <div className="grid grid-cols-3 gap-3">
                    {leftoverOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setLeftover(opt.value)}
                            className={`rounded-xl border-2 py-4 text-center transition ${leftover === opt.value
                                    ? 'border-slate-900 bg-slate-100 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            <span className="block text-3xl">{opt.emoji}</span>
                            <p className="mt-2 text-sm font-medium text-slate-700">{opt.label}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2">
                <div className={`h-2 w-2 rounded-full ${satisfaction !== null ? 'bg-slate-900' : 'bg-slate-200'}`} />
                <div className={`h-2 w-2 rounded-full ${volumeFeeling !== null ? 'bg-slate-900' : 'bg-slate-200'}`} />
                <div className={`h-2 w-2 rounded-full ${leftover !== null ? 'bg-slate-900' : 'bg-slate-200'}`} />
            </div>

            {/* Submit button */}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={!allAnswered || isSubmitting}
                className="w-full rounded-xl bg-slate-900 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSubmitting ? '送信中...' : allAnswered ? '✓ 送信する' : '全ての質問に答えてください'}
            </button>
        </div>
    );
}
