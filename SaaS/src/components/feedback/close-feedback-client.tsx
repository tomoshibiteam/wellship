'use client';

import { useState } from 'react';

interface CloseFeedbackButtonProps {
    menuPlanId: string;
    isClosed: boolean;
    stats: {
        pending: number;
        success: number;
        failed: number;
        skipped: number;
        unanalyzed: number;
    };
}

export function CloseFeedbackButton({
    menuPlanId,
    isClosed: initialIsClosed,
    stats: initialStats,
}: CloseFeedbackButtonProps) {
    const [isClosed, setIsClosed] = useState(initialIsClosed);
    const [stats, setStats] = useState(initialStats);
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{
        success: number;
        failed: number;
        skipped: number;
        total: number;
    } | null>(null);

    const handleClose = async () => {
        setShowConfirm(false);
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/feedback/close-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menuPlanId }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '締め処理に失敗しました');
            }

            setIsClosed(true);
            setResult(data.results);
            setStats({
                pending: 0,
                success: data.results.success,
                failed: data.results.failed,
                skipped: data.results.skipped,
                unanalyzed: 0,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    if (isClosed) {
        return (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">✅</span>
                        <span className="font-medium text-teal-800">この食事は締め済みです</span>
                    </div>
                </div>

                {/* 分析結果サマリー */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg bg-green-100 px-3 py-2 text-center">
                        <div className="text-lg font-bold text-green-700">{stats.success}</div>
                        <div className="text-green-600">分析成功</div>
                    </div>
                    <div className="rounded-lg bg-amber-100 px-3 py-2 text-center">
                        <div className="text-lg font-bold text-amber-700">{stats.skipped}</div>
                        <div className="text-amber-600">スキップ</div>
                    </div>
                    <div className="rounded-lg bg-red-100 px-3 py-2 text-center">
                        <div className="text-lg font-bold text-red-700">{stats.failed}</div>
                        <div className="text-red-600">失敗</div>
                    </div>
                </div>

                {result && (
                    <p className="mt-2 text-sm text-teal-600">
                        対象{result.total}件のうち、{result.success}件を正常に分析しました
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            {/* 確認ダイアログ */}
            {showConfirm && (
                <div className="mb-4 rounded-lg border border-amber-300 bg-white p-4">
                    <p className="font-medium text-slate-800">
                        ⚠️ この食事のフィードバックを締めますか？
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                        締めると、残食画像のAI分析が開始されます。この操作は取り消せません。
                    </p>
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                            {isLoading ? '処理中...' : '締める'}
                        </button>
                        <button
                            onClick={() => setShowConfirm(false)}
                            disabled={isLoading}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">
                    ⚠️ {error}
                </div>
            )}

            {!showConfirm && (
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-amber-800">📋 フィードバック受付中</p>
                        <p className="text-sm text-amber-600">
                            「締める」を押すとAI分析が開始されます
                        </p>
                    </div>
                    <button
                        onClick={() => setShowConfirm(true)}
                        className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
                    >
                        フィードバックを締める
                    </button>
                </div>
            )}
        </div>
    );
}

interface AIAnalysisResultProps {
    aiAnalysisStatus: string | null;
    aiLeftoverPercent: number | null;
    aiLeftoverLevel: string | null;
    aiConfidence: string | null;
    aiNote: string | null;
    leftover: string; // 人間が入力した値
}

export function AIAnalysisResult({
    aiAnalysisStatus,
    aiLeftoverPercent,
    aiLeftoverLevel,
    aiConfidence,
    aiNote,
    leftover,
}: AIAnalysisResultProps) {
    if (!aiAnalysisStatus || aiAnalysisStatus === 'skipped') {
        return null;
    }

    if (aiAnalysisStatus === 'failed') {
        return (
            <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
                ⚠️ AI分析失敗: {aiNote || '不明なエラー'}
            </div>
        );
    }

    if (aiAnalysisStatus === 'pending') {
        return (
            <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-600">
                ⏳ AI分析中...
            </div>
        );
    }

    if (aiAnalysisStatus === 'success') {
        const confidenceEmoji = aiConfidence === 'high' ? '🟢' : aiConfidence === 'medium' ? '🟡' : '🔴';
        const confidenceLabel = aiConfidence === 'high' ? '高' : aiConfidence === 'medium' ? '中' : '低';

        return (
            <div className="mt-2 rounded bg-purple-50 px-2 py-1 text-xs">
                <div className="flex items-center gap-2 text-purple-700">
                    <span>🤖 AI推定:</span>
                    <span className="font-medium">{aiLeftoverPercent}%残 ({aiLeftoverLevel})</span>
                    <span title={`信頼度: ${confidenceLabel}`}>{confidenceEmoji}</span>
                </div>
                {aiNote && (
                    <p className="mt-0.5 text-purple-600 italic">📝 {aiNote}</p>
                )}
            </div>
        );
    }

    return null;
}
