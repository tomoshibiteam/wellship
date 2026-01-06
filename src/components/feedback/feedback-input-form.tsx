'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ReasonTags, ReasonTag, serializeReasonTags } from '@/components/feedback/reason-tags';

type Step = 'capture' | 'form';

interface FeedbackInputFormProps {
    crewName: string;
    menuName: string;
    onSubmit: (data: {
        satisfaction: number;
        volumeFeeling: 'less' | 'just' | 'much';
        leftover: 'none' | 'half' | 'almostAll';
        photoBlob: Blob | null;
        reasonTags: string | null;
    }) => void;
    isSubmitting: boolean;
}

// A案: 次も食べたい？（否定語なし）
const tasteOptions = [
    { label: 'また食べたい', value: 5, emoji: '😊' },
    { label: 'ふつう', value: 3, emoji: '🙂' },
    { label: '別メニューがいい', value: 1, emoji: '🤔' },
];

// 残食オプション
const leftoverOptions = [
    { label: '完食', value: 'none' as const, emoji: '🍽️' },
    { label: '少し残した', value: 'half' as const, emoji: '🥄' },
    { label: '半分くらい', value: 'half' as const, emoji: '📊' },
    { label: 'ほぼ全部', value: 'almostAll' as const, emoji: '📤' },
];

export function FeedbackInputForm({
    crewName,
    menuName,
    onSubmit,
    isSubmitting,
}: FeedbackInputFormProps) {
    const [step, setStep] = useState<Step>('capture');
    const [satisfaction, setSatisfaction] = useState<number | null>(null);
    const [leftover, setLeftover] = useState<'none' | 'half' | 'almostAll' | null>(null);
    const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [reasonTags, setReasonTags] = useState<ReasonTag[]>([]);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // カメラ起動
    const startCamera = useCallback(async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch {
            setCameraError('カメラを起動できませんでした');
        }
    }, []);

    // カメラ停止
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    // 撮影
    const takePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) {
                setPhotoBlob(blob);
                setPhotoPreview(URL.createObjectURL(blob));
                stopCamera();
                setStep('form');
            }
        }, 'image/jpeg', 0.8);
    }, [stopCamera]);

    // 写真なしで進む
    const skipPhoto = useCallback(() => {
        stopCamera();
        setStep('form');
    }, [stopCamera]);

    // 自動カメラ起動
    useEffect(() => {
        if (step === 'capture') {
            startCamera();
        }
        return () => stopCamera();
    }, [step, startCamera, stopCamera]);

    // プレビュークリーンアップ
    useEffect(() => {
        return () => {
            if (photoPreview) URL.revokeObjectURL(photoPreview);
        };
    }, [photoPreview]);

    const handleSubmit = () => {
        if (leftover === null) return;
        onSubmit({
            satisfaction: satisfaction ?? 3,
            volumeFeeling: 'just',
            leftover,
            photoBlob,
            reasonTags: serializeReasonTags(reasonTags),
        });
    };

    // ===== 撮影ステップ =====
    if (step === 'capture') {
        return (
            <div className="w-full max-w-md space-y-4 rounded-2xl bg-slate-900 p-4">
                <div className="text-center text-white">
                    <h2 className="text-lg font-bold">{crewName}さん</h2>
                    <p className="text-sm opacity-70">📷 お皿を撮影してください</p>
                </div>

                {cameraError ? (
                    <div className="rounded-xl bg-amber-100 p-4 text-center text-amber-800">
                        ⚠️ {cameraError}
                    </div>
                ) : (
                    <div className="relative overflow-hidden rounded-xl">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full rounded-xl"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="h-48 w-64 rounded-lg border-4 border-white/50" />
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={takePhoto}
                        disabled={!!cameraError}
                        className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-teal-400 py-4 text-lg font-bold text-white shadow-lg disabled:opacity-50"
                    >
                        📸 撮影する
                    </button>
                    <button
                        type="button"
                        onClick={skipPhoto}
                        className="rounded-xl border border-white/30 bg-white/10 px-4 py-4 text-sm font-medium text-white/80"
                    >
                        写真なしで進む
                    </button>
                </div>

                <canvas ref={canvasRef} className="hidden" />
            </div>
        );
    }

    // ===== ボタン入力ステップ =====
    return (
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-sky-100 bg-white/95 p-6 shadow-lg">
            {photoPreview && (
                <div className="relative overflow-hidden rounded-xl">
                    <img src={photoPreview} alt="撮影した写真" className="w-full max-h-32 object-cover rounded-xl" />
                    <div className="absolute top-2 right-2 rounded-full bg-teal-500 px-2 py-0.5 text-xs font-medium text-white">
                        📷 撮影済み
                    </div>
                </div>
            )}

            <div className="text-center">
                <h2 className="text-lg font-bold text-slate-900">{crewName}さん</h2>
                <p className="text-sm text-slate-600">📍 {menuName}</p>
            </div>

            {/* 残食（必須） */}
            <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">どのくらい残しましたか？</p>
                <div className="grid grid-cols-2 gap-2">
                    {leftoverOptions.map((opt) => (
                        <button
                            key={opt.label}
                            type="button"
                            onClick={() => setLeftover(opt.value)}
                            className={`rounded-xl border-2 py-3 text-center transition ${leftover === opt.value
                                    ? 'border-teal-400 bg-teal-50 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                        >
                            <span className="text-2xl">{opt.emoji}</span>
                            <p className="mt-0.5 text-xs font-medium text-slate-600">{opt.label}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* 味の設問（任意） */}
            <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">
                    次も食べたい？<span className="ml-1 text-xs font-normal text-slate-400">(任意)</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                    {tasteOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSatisfaction(opt.value)}
                            className={`rounded-xl border-2 py-2 text-center transition ${satisfaction === opt.value
                                    ? 'border-teal-400 bg-teal-50'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                        >
                            <span className="text-xl">{opt.emoji}</span>
                            <p className="text-xs text-slate-600">{opt.label}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* 理由タグ */}
            <ReasonTags selected={reasonTags} onChange={setReasonTags} disabled={isSubmitting} />

            {/* 送信 */}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={leftover === null || isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-teal-500 py-4 text-lg font-bold text-white shadow-lg disabled:opacity-50"
            >
                {isSubmitting ? '送信中...' : '送信する'}
            </button>
        </div>
    );
}
