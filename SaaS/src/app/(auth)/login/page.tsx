'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/planning';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('メールアドレスまたはパスワードが正しくありません');
            } else {
                router.push(callbackUrl);
                router.refresh();
            }
        } catch {
            setError('ログインに失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Error Message */}
            {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
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
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-black transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-sky-700 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading ? 'ログイン中...' : 'ログイン'}
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

import { Suspense } from 'react';

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
                        <LoginForm />
                    </Suspense>

                    {/* Demo Accounts */}
                    <div className="mt-8 border-t border-slate-100 pt-6">
                        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                            デモアカウント
                        </p>
                        <div className="space-y-2 text-xs text-slate-600">
                            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                                <span className="font-medium">現場側(司厨):</span>
                                <span>chef@demo.wellship.jp</span>
                            </div>
                            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                                <span className="font-medium">管理側(本部):</span>
                                <span>manager@demo.wellship.jp</span>
                            </div>
                            <p className="mt-2 text-center text-slate-500">
                                パスワード: <code className="rounded bg-slate-100 px-1.5 py-0.5">demo1234</code>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
