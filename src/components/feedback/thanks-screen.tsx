'use client';

import { useEffect, useState } from 'react';

interface ThanksScreenProps {
    onReset: () => void;
    autoResetSeconds?: number;
}

export function ThanksScreen({
    onReset,
    autoResetSeconds = 5,
}: ThanksScreenProps) {
    const [countdown, setCountdown] = useState(autoResetSeconds);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onReset();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onReset]);

    return (
        <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-500 text-5xl text-white shadow-lg">
                ✓
            </div>
            <h2 className="text-3xl font-bold text-green-800">
                ありがとうございます！
            </h2>
            <p className="mt-4 text-xl text-slate-600">
                フィードバックを送信しました
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
                className="mt-6 text-sm text-sky-600 underline hover:text-sky-800"
            >
                今すぐ戻る
            </button>
        </div>
    );
}
