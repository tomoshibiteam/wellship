'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface CameraCaptureProps {
    onCapture: (photoBlob: Blob | null) => void;
    disabled?: boolean;
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // カメラ開始
    const startCamera = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // 背面カメラ優先
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error('Camera error:', err);
            setError('カメラを起動できませんでした。写真なしで送信できます。');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // カメラ停止
    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    // 撮影
    const takePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // キャンバスサイズをビデオに合わせる
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 描画
        ctx.drawImage(video, 0, 0);

        // Blobに変換
        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                setPreview(url);
                onCapture(blob);
                stopCamera();
            }
        }, 'image/jpeg', 0.8);
    }, [onCapture, stopCamera]);

    // 撮り直し
    const retake = useCallback(() => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setPreview(null);
        onCapture(null);
        startCamera();
    }, [preview, onCapture, startCamera]);

    // スキップ（写真なし）
    const skip = useCallback(() => {
        stopCamera();
        onCapture(null);
    }, [stopCamera, onCapture]);

    // クリーンアップ
    useEffect(() => {
        return () => {
            stopCamera();
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [stopCamera, preview]);

    if (disabled) {
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                    📷 皿の写真
                    <span className="ml-2 text-xs text-slate-400">(任意)</span>
                </label>
                {!stream && !preview && !error && (
                    <button
                        type="button"
                        onClick={startCamera}
                        disabled={isLoading}
                        className="rounded-lg bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:bg-sky-200"
                    >
                        {isLoading ? '起動中...' : 'カメラを起動'}
                    </button>
                )}
            </div>

            {/* エラー表示 */}
            {error && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                    ⚠️ {error}
                </div>
            )}

            {/* カメラプレビュー */}
            {stream && !preview && (
                <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-sky-200 bg-slate-900">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full"
                    />
                    {/* 撮影ガイド枠 */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-48 w-64 rounded-lg border-4 border-white/50" />
                    </div>
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={takePhoto}
                            className="rounded-full bg-white px-6 py-2 text-sm font-bold text-sky-700 shadow-lg transition hover:bg-sky-50"
                        >
                            📸 撮影
                        </button>
                        <button
                            type="button"
                            onClick={skip}
                            className="rounded-full bg-slate-700 px-4 py-2 text-sm text-white/80 transition hover:bg-slate-600"
                        >
                            スキップ
                        </button>
                    </div>
                </div>
            )}

            {/* 撮影済みプレビュー */}
            {preview && (
                <div className="relative overflow-hidden rounded-xl border border-sky-200">
                    <img src={preview} alt="撮影した写真" className="w-full" />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                        <button
                            type="button"
                            onClick={retake}
                            className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-lg transition hover:bg-white"
                        >
                            🔄 撮り直す
                        </button>
                    </div>
                </div>
            )}

            {/* 隠しCanvas */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
