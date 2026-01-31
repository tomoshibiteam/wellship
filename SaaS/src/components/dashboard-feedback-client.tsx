'use client';

import { useCallback, useEffect, useState } from 'react';
import { FeedbackInputForm } from '@/components/feedback/feedback-input-form';
import { ThanksScreen } from '@/components/feedback/thanks-screen';
import { ErrorBanner } from '@/components/ui/error';
import { safeJsonRequest } from '@/lib/offline/retry-queue';
import { clearDraft } from '@/lib/offline/draft-storage';

type Step = 'setup' | 'select' | 'input' | 'thanks';

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
    const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
    const [menuPlan, setMenuPlan] = useState<MenuPlan | null>(null);
    const [isLoadingMenu, setIsLoadingMenu] = useState(true);
    const [isLoadingCrew, setIsLoadingCrew] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedbackCount, setFeedbackCount] = useState(0);
    const [thanksMessage, setThanksMessage] = useState('フィードバックを送信しました');

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

    // 船員リストを取得
    const fetchCrewMembers = async () => {
        setIsLoadingCrew(true);
        try {
            const res = await fetch(`/api/crew/list?vesselId=${vesselId}`);
            if (res.ok) {
                const data = await res.json();
                setCrewMembers(data.crewMembers || []);
            }
        } catch (err) {
            console.error('Failed to fetch crew members:', err);
            setError('船員リストの取得に失敗しました。');
        } finally {
            setIsLoadingCrew(false);
        }
    };

    // 司厨がセットアップ完了を押したら
    const handleStartFeedback = async () => {
        await fetchCrewMembers();
        setStep('select');
        setFeedbackCount(0);
    };

    // 司厨がフィードバック収集を終了
    const handleEndFeedback = async () => {
        if (menuPlan && menuPlan.id !== 'dummy-menu') {
            try {
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

    // 船員カードをクリック
    const handleSelectCrew = (crew: CrewMember) => {
        setCrewMember(crew);
        setStep('input');
        setError(null);
    };

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

            const result = await safeJsonRequest({
                url: '/api/feedback/submit',
                method: 'POST',
                body: {
                    crewMemberId: crewMember.id,
                    menuPlanId: menuPlan?.id || null,
                    satisfaction: data.satisfaction,
                    volumeFeeling: data.volumeFeeling,
                    leftover: data.leftover,
                    photoUrl,
                    reasonTags: data.reasonTags,
                },
                feature: 'feedback',
            });

            if (result.queued) {
                setThanksMessage('通信が不安定なため送信を保留しました');
                const draftKey = `wellship_feedback_draft:${vesselId}:${crewMember.id}:${menuPlan?.id ?? currentMealType}`;
                clearDraft(draftKey);
                setFeedbackCount((prev) => prev + 1);
                setStep('thanks');
                return;
            }

            const json = await result.response?.json().catch(() => ({}));
            if (!result.ok || json?.error) {
                setError(json?.error || '送信に失敗しました。');
                return;
            }

            setThanksMessage('フィードバックを送信しました');
            const draftKey = `wellship_feedback_draft:${vesselId}:${crewMember.id}:${menuPlan?.id ?? currentMealType}`;
            clearDraft(draftKey);
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
        setStep('select');
        setCrewMember(null);
        setError(null);
    }, []);

    // ===== セットアップ画面 =====
    if (step === 'setup') {
        return (
            <div className="flex flex-col items-center py-6">
                {/* ヘッダー */}
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
                        <span className="text-2xl">🚢</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{vesselName}</h2>
                        <p className="text-sm text-slate-500">フィードバック収集</p>
                    </div>
                </div>

                {/* 食事情報 */}
                <div className="mb-6 w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center shadow-sm">
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
                    className="w-full max-w-md rounded-xl bg-slate-900 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-slate-800 hover:shadow-xl"
                >
                    🍽️ フィードバック収集を開始
                </button>

                <p className="mt-3 text-sm text-slate-500">
                    開始すると船員選択画面に移行します
                </p>
            </div>
        );
    }

    // ===== 船員選択/入力/Thanks画面 =====
    return (
        <div className="flex flex-col items-center py-4">
            {/* ヘッダー（収集中） */}
            <div className="mb-4 flex w-full max-w-2xl items-center justify-between">
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
            {step === 'select' && (
                <div className="w-full max-w-2xl">
                    <h3 className="mb-4 text-center text-lg font-semibold text-slate-800">
                        👥 船員を選択してください
                    </h3>
                    {isLoadingCrew ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                            読み込み中...
                        </div>
                    ) : crewMembers.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                            <p className="text-sm text-amber-700">
                                ⚠️ 船員が登録されていません。<br />
                                <span className="text-xs text-amber-600">本部管理画面から船員を登録してください。</span>
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                            {crewMembers.map((crew) => (
                                <button
                                    key={crew.id}
                                    onClick={() => handleSelectCrew(crew)}
                                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-4 transition hover:border-slate-900 hover:bg-slate-50 hover:shadow-md"
                                >
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">
                                        👤
                                    </div>
                                    <span className="text-sm font-medium text-slate-800">{crew.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {step === 'input' && crewMember && (
                <FeedbackInputForm
                    crewName={crewMember.name}
                    menuName={menuPlan?.recipes?.map(r => r.name).join('、') || '本日のメニュー'}
                    draftKey={`wellship_feedback_draft:${vesselId}:${crewMember.id}:${menuPlan?.id ?? currentMealType}`}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                />
            )}

            {step === 'thanks' && <ThanksScreen onReset={handleReset} message={thanksMessage} />}
        </div>
    );
}
