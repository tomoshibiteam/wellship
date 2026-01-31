'use client';

import { useEffect, useState, useCallback } from 'react';

interface NfcScannerProps {
    onScan: (cardCode: string) => void;
    isActive: boolean;
}

export function NfcScanner({ onScan, isActive }: NfcScannerProps) {
    const [isSupported, setIsSupported] = useState<boolean | null>(null);
    const [isReading, setIsReading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startReading = useCallback(async () => {
        if (!('NDEFReader' in window)) {
            setIsSupported(false);
            setError('このブラウザはNFC機能に対応していません。Chrome (Android) をお使いください。');
            return;
        }

        setIsSupported(true);
        setError(null);
        setIsReading(true);

        try {
            // @ts-expect-error - NDEFReader is not in TypeScript's lib yet
            const ndef = new NDEFReader();
            await ndef.scan();

            ndef.addEventListener('reading', ({ serialNumber, message }: { serialNumber: string; message: { records: Array<{ recordType: string; data: DataView }> } }) => {
                // NFCタグのシリアル番号をカードコードとして使用
                // または、NDEFメッセージからカードコードを読み取る
                let cardCode = serialNumber;

                // NDEFメッセージにテキストレコードがあれば、それを優先
                for (const record of message.records) {
                    if (record.recordType === 'text') {
                        const textDecoder = new TextDecoder();
                        cardCode = textDecoder.decode(record.data);
                        break;
                    }
                }

                if (cardCode) {
                    onScan(cardCode);
                }
            });

            ndef.addEventListener('readingerror', () => {
                setError('カードの読み取りに失敗しました。もう一度お試しください。');
            });
        } catch (err) {
            console.error('NFC error:', err);
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    setError('NFCへのアクセスが許可されていません。ブラウザの設定でNFCの許可を有効にしてください。');
                } else if (err.name === 'NotSupportedError') {
                    setError('このデバイスはNFC機能に対応していません。');
                } else {
                    setError('NFCを起動できませんでした。');
                }
            }
            setIsReading(false);
        }
    }, [onScan]);

    useEffect(() => {
        if (isActive) {
            startReading();
        }
        return () => {
            setIsReading(false);
        };
    }, [isActive, startReading]);

    return (
        <div className="flex flex-col items-center">
            {/* NFC Icon Area */}
            <div className="relative flex h-48 w-48 items-center justify-center rounded-2xl border-3 border-slate-200 bg-slate-50 shadow-inner">
                {/* Animated NFC Icon */}
                <div className="relative">
                    {/* Pulse rings */}
                    {isReading && (
                        <>
                            <div className="absolute inset-0 -m-6 animate-ping rounded-full border-3 border-slate-400 opacity-20" style={{ animationDuration: '2s' }} />
                            <div className="absolute inset-0 -m-10 animate-ping rounded-full border-3 border-slate-300 opacity-10" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                        </>
                    )}
                    {/* NFC Symbol */}
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 shadow-lg">
                        <svg
                            className="h-10 w-10 text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            {/* NFC wave symbol */}
                            <path d="M6 8.5a6 6 0 0 1 12 0" />
                            <path d="M8 11.5a3 3 0 0 1 8 0" />
                            <circle cx="12" cy="14" r="1" fill="currentColor" />
                            <rect x="4" y="16" width="16" height="6" rx="1" />
                        </svg>
                    </div>
                </div>

                {/* Status indicator */}
                {isReading && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                        <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5">
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                            <span className="text-xs font-medium text-green-700">読み取り中</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="mt-3 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700">
                    {error}
                </div>
            )}

            {/* Not supported message */}
            {isSupported === false && (
                <div className="mt-3 max-w-xs rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
                    💡 NFC非対応ブラウザ。手入力ボタンをお使いください。
                </div>
            )}

            {/* Instructions */}
            <p className="mt-4 text-center text-base font-medium text-slate-600">
                NFCカードをかざしてください
            </p>
            <p className="mt-1 text-center text-xs text-slate-400">
                デバイスの背面にタッチ
            </p>
        </div>
    );
}
