'use client';

import { useCallback, useEffect, useState } from 'react';
import { NfcScanner } from '@/components/feedback/nfc-scanner';
import { FeedbackInputForm } from '@/components/feedback/feedback-input-form';
import { ThanksScreen } from '@/components/feedback/thanks-screen';
import { ErrorBanner } from '@/components/ui/error';

type Step = 'setup' | 'scan' | 'input' | 'thanks';


interface CrewMember {
    id: string;
    name: string;
    vesselId: string;
}

interface MenuPlan {
    id: string;
    mealType: 'breakfast' | 'lunch' | 'dinner';
    recipes: { name: string; category: string }[];
}

interface DashboardFeedbackClientProps {
    vesselId: string;
    vesselName: string;
}

const mealTypeLabels = {
    breakfast: '朝食',
    lunch: '昼食',
    dinner: '夕食',
};

const mealTypeEmojis = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
};

function guessMealType(): 'breakfast' | 'lunch' | 'dinner' {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    return 'dinner';
}

export function DashboardFeedbackClient({
    vesselId,
    vesselName,
}: DashboardFeedbackClientProps) {
    const [step, setStep] = useState<Step>('setup');
    const [crewMember, setCrewMember] = useState<CrewMember | null>(null);
    const [menuPlan, setMenuPlan] = useState<MenuPlan | null>(null);
    const [isLoadingMenu, setIsLoadingMenu] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualCardCode, setManualCardCode] = useState('');
    const [feedbackCount, setFeedbackCount] = useState(0);

    const currentMealType = guessMealType();

    // 今日のメニュープランを取得
    useEffect(() => {
        const fetchTodayMenu = async () => {
            setIsLoadingMenu(true);
            try {
                const today = new Date().toISOString().slice(0, 10);
                const res = await fetch(`/api/menu/today?vesselId=${vesselId}&date=${today}&mealType=${currentMealType}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.menuPlan) {
                        setMenuPlan({
                            id: data.menuPlan.id,
                            mealType: data.menuPlan.mealType || currentMealType,
                            recipes: data.menuPlan.recipes || [],
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch today menu:', err);
            } finally {
                setIsLoadingMenu(false);
            }
        };
        fetchTodayMenu();
    }, [vesselId, currentMealType]);

    // 司厨がセットアップ完了を押したら
    const handleStartFeedback = () => {
        setStep('scan');
        setFeedbackCount(0);
    };

    // 司厨がフィードバック収集を終了
    const handleEndFeedback = async () => {
        if (menuPlan && menuPlan.id !== 'dummy-menu') {
            try {
                // 締めるAPIを呼び出し
                await fetch('/api/feedback/close-feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ menuPlanId: menuPlan.id }),
                });
            } catch (err) {
                console.error('Failed to close feedback:', err);
            }
        }
        setStep('setup');
    };

    const handleScan = useCallback(async (cardCode: string) => {
        setError(null);

        try {
            const res = await fetch('/api/crew/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardCode }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                setError(data.error || 'カードが認識できませんでした。');
                return;
            }

            if (data.crewMember.vesselId !== vesselId) {
                setError('このカードは別の船舶の船員です。');
                return;
            }

            setCrewMember(data.crewMember);
            setStep('input');
        } catch (err) {
            console.error('Scan error:', err);
            setError('カードの読み取りに失敗しました。');
        }
    }, [vesselId]);

    const handleSubmit = async (data: {
        satisfaction: number;
        volumeFeeling: 'less' | 'just' | 'much';
        leftover: 'none' | 'half' | 'almostAll';
        photoBlob: Blob | null;
        reasonTags: string | null;
    }) => {
        if (!crewMember) return;

        setIsSubmitting(true);
        try {
            let photoUrl: string | null = null;
            if (data.photoBlob) {
                const formData = new FormData();
                formData.append('photo', data.photoBlob, 'feedback.jpg');
                const uploadRes = await fetch('/api/feedback/upload-photo', {
                    method: 'POST',
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                if (uploadRes.ok && uploadData.photoUrl) {
                    photoUrl = uploadData.photoUrl;
                }
            }

            const res = await fetch('/api/feedback/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crewMemberId: crewMember.id,
                    menuPlanId: menuPlan?.id || null,
                    satisfaction: data.satisfaction,
                    volumeFeeling: data.volumeFeeling,
                    leftover: data.leftover,
                    photoUrl,
                    reasonTags: data.reasonTags,
                }),
            });

            const result = await res.json();

            if (!res.ok || result.error) {
                setError(result.error || '送信に失敗しました。');
                return;
            }

            setFeedbackCount(prev => prev + 1);
            setStep('thanks');
        } catch (err) {
            console.error('Submit error:', err);
            setError('送信に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = useCallback(() => {
        setStep('scan');
        setCrewMember(null);
        setError(null);
    }, []);

    const handleManualSubmit = async () => {
        if (manualCardCode.trim()) {
            await handleScan(manualCardCode.trim());
            setManualCardCode('');
            setShowManualInput(false);
        }
    };

    // ===== セットアップ画面 =====
    if (step === 'setup') {
        return (
            <div className="flex flex-col items-center py-6">
                {/* ヘッダー */}
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-teal-500 shadow-lg">
                        <span className="text-2xl">🚢</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{vesselName}</h2>
                        <p className="text-sm text-slate-500">フィードバック収集</p>
                    </div>
                </div>

                {/* 食事情報 */}
                <div className="mb-6 w-full max-w-md rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-teal-50 p-6 text-center shadow">
                    <div className="mb-3 text-4xl">
                        {mealTypeEmojis[currentMealType]}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">
                        今日の{mealTypeLabels[currentMealType]}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                    </p>
                </div>

                {/* 献立表示 */}
                <div className="mb-6 w-full max-w-md">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700">📋 本日の献立</h4>
                    {isLoadingMenu ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
                            読み込み中...
                        </div>
                    ) : menuPlan && menuPlan.recipes.length > 0 ? (
                        <div className="space-y-2">
                            {menuPlan.recipes.map((recipe, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                                >
                                    <span className="text-lg">
                                        {recipe.category === 'main' ? '🍖' :
                                            recipe.category === 'side' ? '🥗' :
                                                recipe.category === 'soup' ? '🍲' : '🍰'}
                                    </span>
                                    <span className="font-medium text-slate-800">{recipe.name}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
                            ⚠️ 献立が設定されていません。<br />
                            <span className="text-xs text-amber-600">献立なしでもフィードバック収集は可能です</span>
                        </div>
                    )}
                </div>

                {/* 開始ボタン */}
                <button
                    onClick={handleStartFeedback}
                    className="w-full max-w-md rounded-xl bg-gradient-to-r from-sky-600 to-teal-500 py-4 text-lg font-bold text-white shadow-lg transition hover:shadow-xl"
                >
                    🍽️ フィードバック収集を開始
                </button>

                <p className="mt-3 text-sm text-slate-500">
                    開始するとNFCカードかざし画面に移行します
                </p>
            </div>
        );
    }

    // ===== NFC/入力/Thanks画面 =====
    return (
        <div className="flex flex-col items-center py-4">
            {/* ヘッダー（収集中） */}
            <div className="mb-4 flex w-full max-w-md items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{mealTypeEmojis[currentMealType]}</span>
                    <span className="font-medium text-slate-700">
                        {mealTypeLabels[currentMealType]}
                    </span>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        収集中
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">{feedbackCount}件</span>
                    <button
                        onClick={handleEndFeedback}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                        終了
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 w-full max-w-sm">
                    <ErrorBanner
                        message={error}
                        onClose={() => setError(null)}
                    />
                </div>
            )}

            {/* Steps */}
            {step === 'scan' && (
                <div className="flex flex-col items-center">
                    <NfcScanner onScan={handleScan} isActive={step === 'scan' && !showManualInput} />

                    {showManualInput ? (
                        <div className="mt-4 flex flex-col items-center gap-2">
                            <input
                                type="text"
                                value={manualCardCode}
                                onChange={(e) => setManualCardCode(e.target.value)}
                                placeholder="CREW-SAKURA-001"
                                className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleManualSubmit();
                                    }
                                }}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleManualSubmit}
                                    className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
                                >
                                    確認
                                </button>
                                <button
                                    onClick={() => {
                                        setShowManualInput(false);
                                        setManualCardCode('');
                                    }}
                                    className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-600 shadow-sm hover:bg-slate-50"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowManualInput(true)}
                            className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm hover:bg-slate-50"
                        >
                            📝 手入力（デモ用）
                        </button>
                    )}
                </div>
            )}

            {step === 'input' && crewMember && (
                <FeedbackInputForm
                    crewName={crewMember.name}
                    menuName={menuPlan?.recipes?.map(r => r.name).join('、') || '本日のメニュー'}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                />
            )}

            {step === 'thanks' && <ThanksScreen onReset={handleReset} />}
        </div>
    );
}
