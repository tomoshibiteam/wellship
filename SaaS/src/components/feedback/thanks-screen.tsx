'use client';

import { useEffect, useState } from 'react';

interface ThanksScreenProps {
    onReset: () => void;
    autoResetSeconds?: number;
    message?: string;
}

export function ThanksScreen({
    onReset,
    autoResetSeconds = 5,
    message = 'フィードバックを送信しました',
}: ThanksScreenProps) {
    const [countdown, setCountdown] = useState(autoResetSeconds);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Defer state update to next tick to avoid updating during render
                    setTimeout(() => onReset(), 0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onReset]);

    return (
        <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-5xl text-white shadow-lg">
                ✓
            </div>
            <h2 className="text-3xl font-bold text-slate-900">
                ありがとうございます！
            </h2>
            <p className="mt-4 text-xl text-slate-600">
                {message}
            </p>
            <div className="mt-8 rounded-2xl bg-slate-50 px-8 py-4">
                <p className="text-lg text-slate-600">
                    次の方はカードをかざしてください
                </p>
                <p className="mt-2 text-sm text-slate-500">
                    {countdown}秒後に自動的に戻ります
                </p>
            </div>
            <button
                onClick={onReset}
                className="mt-6 text-sm text-slate-800 underline hover:text-slate-600"
            >
                今すぐ戻る
            </button>
        </div>
    );
}
