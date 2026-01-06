'use client';

import { useState, useCallback } from 'react';

export type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorBannerProps {
    message: string;
    severity?: ErrorSeverity;
    onClose?: () => void;
    onRetry?: () => void;
}

/**
 * 共通エラーバナー
 */
export function ErrorBanner({
    message,
    severity = 'error',
    onClose,
    onRetry,
}: ErrorBannerProps) {
    const severityStyles = {
        error: 'bg-red-50 border-red-200 text-red-700',
        warning: 'bg-amber-50 border-amber-200 text-amber-700',
        info: 'bg-sky-50 border-sky-200 text-sky-700',
    };

    const icons = {
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
    };

    return (
        <div className={`rounded-xl border px-4 py-3 ${severityStyles[severity]}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span>{icons[severity]}</span>
                    <span className="text-sm">{message}</span>
                </div>
                <div className="flex items-center gap-2">
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="rounded-lg bg-white/50 px-3 py-1 text-xs font-medium hover:bg-white"
                        >
                            再試行
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-sm opacity-60 hover:opacity-100"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * エラー状態管理フック
 */
export function useError() {
    const [error, setError] = useState<string | null>(null);
    const [severity, setSeverity] = useState<ErrorSeverity>('error');

    const showError = useCallback((message: string, sev: ErrorSeverity = 'error') => {
        setError(message);
        setSeverity(sev);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return { error, severity, showError, clearError };
}

/**
 * APIエラーをユーザーフレンドリーなメッセージに変換
 */
export function formatApiError(error: unknown, fallback = 'エラーが発生しました。'): string {
    if (error instanceof Error) {
        // ネットワークエラー
        if (error.message.includes('fetch') || error.message.includes('network')) {
            return 'ネットワーク接続を確認してください。';
        }
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return fallback;
}
