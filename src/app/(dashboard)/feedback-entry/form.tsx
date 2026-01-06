"use client";

import { useMemo, useState, useTransition, useCallback, useRef, useEffect } from "react";
import type { MealType } from "@prisma/client";
import { createFeedback } from "./actions";
import { ReasonTags, ReasonTag, serializeReasonTags } from "@/components/feedback/reason-tags";
import { features } from "@/lib/config/features";


type Step = 'capture' | 'form' | 'thanks';

const mealTypeLabels: Record<MealType, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
};

function guessMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

// A案: 次も食べたい？（否定語なし）
const tasteOptions = [
  { label: "また食べたい", value: 5, emoji: "😊" },
  { label: "ふつう", value: 3, emoji: "🙂" },
  { label: "別メニューがいい", value: 1, emoji: "🤔" },
];

// 残食オプション（段階を増やして詳細化）
const leftoverOptions: { label: string; value: "none" | "half" | "almostAll"; emoji: string }[] = [
  { label: "完食", value: "none", emoji: "🍽️" },
  { label: "少し残した", value: "half", emoji: "🥄" },
  { label: "半分くらい", value: "half", emoji: "📊" },
  { label: "ほぼ全部", value: "almostAll", emoji: "📤" },
];

export default function FeedbackEntryForm() {
  // Skip photo capture step if feature is disabled
  const initialStep: Step = features.photoFeedback ? 'capture' : 'form';
  const [step, setStep] = useState<Step>(initialStep);
  const [mealType] = useState<MealType>(() => guessMealType());
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [leftover, setLeftover] = useState<"none" | "half" | "almostAll" | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reasonTags, setReasonTags] = useState<ReasonTag[]>([]);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const targetLabel = useMemo(() => `今日の${mealTypeLabels[guessMealType()]}`, []);

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

  // フォーム送信
  const handleSubmit = async () => {
    if (leftover === null) return;

    setSubmitError(null);
    startTransition(async () => {
      try {
        let photoUrl: string | null = null;

        // Only upload photo if feature is enabled and photo was captured
        if (features.photoFeedback && photoBlob) {
          const formData = new FormData();
          formData.append("photo", photoBlob, "feedback.jpg");
          const uploadRes = await fetch("/api/feedback/upload-photo", {
            method: "POST",
            body: formData,
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.photoUrl) {
            photoUrl = uploadData.photoUrl;
          }
        }

        await createFeedback({
          date: new Date().toISOString().slice(0, 10),
          mealType,
          satisfaction: satisfaction ?? 3, // 未選択時はふつう
          volumeFeeling: "just",
          leftover: leftover!,
          photoUrl,
          reasonTags: features.photoFeedback ? serializeReasonTags(reasonTags) : null,
        });

        setStep('thanks');

        // 3秒後に自動リセット
        setTimeout(() => resetForm(), 3000);
      } catch (err) {
        console.error("feedback submit error", err);
        setSubmitError("送信に失敗しました");
      }
    });
  };

  // リセット
  const resetForm = () => {
    setSatisfaction(null);
    setLeftover(null);
    setPhotoBlob(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setReasonTags([]);
    setSubmitError(null);
    // Reset to initial step based on feature flag
    setStep(features.photoFeedback ? 'capture' : 'form');
  };

  // ===== Thanks画面 =====
  if (step === 'thanks') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-sky-50 p-8 text-center">
        <div className="mb-4 text-7xl">🙏</div>
        <p className="text-2xl font-bold text-slate-900">ありがとうございます！</p>
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <div className="h-2 w-2 animate-pulse rounded-full bg-teal-400" />
          3秒後に戻ります
        </div>
      </div>
    );
  }

  // ===== 撮影ステップ =====
  if (step === 'capture') {
    return (
      <div className="space-y-4 rounded-2xl border border-sky-100 bg-slate-900 p-4">
        <div className="text-center text-white">
          <p className="text-sm opacity-70">{targetLabel}</p>
          <h2 className="mt-1 text-lg font-bold">📷 お皿を撮影してください</h2>
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
            {/* 撮影ガイド枠 */}
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
            className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-teal-400 py-4 text-lg font-bold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50"
          >
            📸 撮影する
          </button>
          <button
            type="button"
            onClick={skipPhoto}
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-4 text-sm font-medium text-white/80 transition hover:bg-white/20"
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
    <div className="space-y-5 rounded-2xl border border-sky-100 bg-white/95 p-6 shadow-lg">
      {/* プレビュー */}
      {photoPreview && (
        <div className="relative overflow-hidden rounded-xl">
          <img src={photoPreview} alt="撮影した写真" className="w-full max-h-40 object-cover rounded-xl" />
          <div className="absolute top-2 right-2 rounded-full bg-teal-500 px-2 py-0.5 text-xs font-medium text-white">
            📷 撮影済み
          </div>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-slate-500">{targetLabel}</p>
        <h2 className="text-xl font-bold text-slate-900">どのくらい残しましたか？</h2>
      </div>

      {/* 残食（必須） */}
      <div className="grid grid-cols-2 gap-3">
        {leftoverOptions.map((opt) => {
          const active = leftover === opt.value && (
            (opt.label === "完食" && leftover === "none") ||
            (opt.label === "少し残した" && leftover === "half") ||
            (opt.label === "半分くらい" && leftover === "half") ||
            (opt.label === "ほぼ全部" && leftover === "almostAll")
          );
          const isActive = leftover === opt.value ||
            (opt.label === "少し残した" && leftover === "half") ||
            (opt.label === "半分くらい" && leftover === "half");
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => setLeftover(opt.value)}
              className={`rounded-xl border-2 py-4 text-center transition ${leftover === opt.value
                ? "border-teal-400 bg-teal-50 shadow-md"
                : "border-slate-200 bg-white hover:border-slate-300"
                }`}
            >
              <span className="text-3xl">{opt.emoji}</span>
              <p className="mt-1 text-sm font-medium text-slate-700">{opt.label}</p>
            </button>
          );
        })}
      </div>

      {/* 味の設問（任意）A案 */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-800">
          次も食べたい？
          <span className="ml-2 text-xs font-normal text-slate-400">(任意)</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {tasteOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSatisfaction(opt.value)}
              className={`rounded-xl border-2 py-3 text-center transition ${satisfaction === opt.value
                ? "border-teal-400 bg-teal-50"
                : "border-slate-200 bg-white hover:border-slate-300"
                }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <p className="mt-0.5 text-xs font-medium text-slate-600">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 理由タグ */}
      <ReasonTags selected={reasonTags} onChange={setReasonTags} disabled={isPending} />

      {/* エラー */}
      {submitError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">⚠️ {submitError}</div>
      )}

      {/* 送信 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={leftover === null || isPending}
        className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-teal-500 py-4 text-lg font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "送信中..." : "送信する"}
      </button>
    </div>
  );
}
