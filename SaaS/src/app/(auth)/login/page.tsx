'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup';

function AuthForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrlParam = searchParams.get('callbackUrl');
    const callbackUrl = callbackUrlParam || '/planning';

    const [mode, setMode] = useState<AuthMode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNotice('');
        setIsLoading(true);

        try {
            const supabase = createSupabaseBrowserClient();
            if (mode === 'login') {
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (authError) {
                    setError('メールアドレスまたはパスワードが正しくありません');
                    return;
                }

                let targetUrl = callbackUrl;
                if (!callbackUrlParam) {
                    try {
                        const res = await fetch('/api/me');
                        if (res.ok) {
                            const json = await res.json();
                            if (json?.user?.role === 'MANAGER') {
                                targetUrl = '/manager/dashboard?scope=all&range=7d';
                            }
                        }
                    } catch {
                        // ignore and fallback
                    }
                }

                router.push(targetUrl);
                router.refresh();
            } else {
                const emailRedirectTo = `${window.location.origin}/login`;
                const { data, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo,
                        data: { name: name.trim() || null },
                    },
                });

                if (authError) {
                    setError(authError.message || '新規登録に失敗しました');
                    return;
                }

                if (data.session) {
                    router.push(callbackUrl);
                    router.refresh();
                    return;
                }

                setNotice('登録しました。メール確認後にログインしてください。');
                setMode('login');
            }
        } catch {
            setError('認証に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="mb-6 flex rounded-xl bg-slate-100 p-1 text-sm">
                <button
                    type="button"
                    onClick={() => {
                        setMode('login');
                        setError('');
                        setNotice('');
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 font-semibold transition ${mode === 'login'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    ログイン
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMode('signup');
                        setError('');
                        setNotice('');
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 font-semibold transition ${mode === 'signup'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    新規登録
                </button>
            </div>

            {/* Error/Notice Message */}
            {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}
            {notice && (
                <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                    {notice}
                </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {mode === 'signup' && (
                    <div>
                        <label
                            htmlFor="name"
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                            お名前（任意）
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-black transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                            placeholder="山田 太郎"
                        />
                    </div>
                )}
                <div>
                    <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                        メールアドレス
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-black transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        placeholder="email@example.com"
                    />
                </div>

                <div>
                    <label
                        htmlFor="password"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                        パスワード
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-black transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-sky-700 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading
                        ? mode === 'login'
                            ? 'ログイン中...'
                            : '登録中...'
                        : mode === 'login'
                            ? 'ログイン'
                            : '新規登録'}
                </button>
            </form>
        </>
    );
}

function LoginFormFallback() {
    return (
        <div className="space-y-5">
            <div className="h-[68px] animate-pulse rounded-lg bg-slate-100" />
            <div className="h-[68px] animate-pulse rounded-lg bg-slate-100" />
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-teal-50">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-sky-100 bg-white/90 p-8 shadow-[0_12px_32px_rgba(14,94,156,0.08)]">
                    {/* Logo */}
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-teal-500 shadow-lg">
                            <span className="text-2xl">🚢</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">WELLSHIP</h1>
                        <p className="mt-1 text-sm text-slate-600">船員の食と健康を最適化</p>
                    </div>

                    <Suspense fallback={<LoginFormFallback />}>
                        <AuthForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
