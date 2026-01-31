'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup';

function AuthForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrlParam = searchParams.get('callbackUrl');
    const callbackUrl = callbackUrlParam || '/planning';

    const [mode, setMode] = useState<AuthMode>('login');
    const [companyName, setCompanyName] = useState('');
    const [contactName, setContactName] = useState('');
    const [department, setDepartment] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [phone, setPhone] = useState('');
    const [industry, setIndustry] = useState('');
    const [companySize, setCompanySize] = useState('');
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

                const { data: authUser } = await supabase.auth.getUser();
                if (authUser?.user?.id) {
                    const registerRes = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            authUserId: authUser.user.id,
                            email,
                        }),
                    });
                    if (!registerRes.ok) {
                        const rawText = await registerRes.text().catch(() => '');
                        let message = '登録に失敗しました';
                        try {
                            const json = rawText ? JSON.parse(rawText) : {};
                            message = json?.error || message;
                        } catch {
                            if (rawText) message = rawText;
                        }
                        setError(message);
                        await supabase.auth.signOut().catch(() => null);
                        return;
                    }
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
                const trimmedCompany = companyName.trim();
                const trimmedContact = contactName.trim();
                if (!trimmedCompany || !trimmedContact || !phone.trim() || !industry || !companySize) {
                    setError('必須項目を入力してください');
                    return;
                }

                const displayName = `${trimmedCompany}の${trimmedContact}`;
                const emailRedirectTo = `${window.location.origin}/login`;
                const { data, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo,
                        data: {
                            name: displayName,
                            companyName: trimmedCompany,
                            contactName: trimmedContact,
                            department: department.trim() || null,
                            jobTitle: jobTitle.trim() || null,
                            phone: phone.trim(),
                            industry,
                            companySize,
                        },
                    },
                });

                if (authError) {
                    setError(authError.message || '新規登録に失敗しました');
                    return;
                }

                if (!data.user?.id) {
                    setError('新規登録に失敗しました');
                    return;
                }

                const registerRes = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        authUserId: data.user.id,
                        email,
                        companyName: trimmedCompany,
                        contactName: trimmedContact,
                        department: department.trim() || null,
                        jobTitle: jobTitle.trim() || null,
                        phone: phone.trim(),
                        industry,
                        companySize,
                    }),
                });

                if (!registerRes.ok) {
                    const rawText = await registerRes.text().catch(() => '');
                    let message = '登録に失敗しました';
                    try {
                        const json = rawText ? JSON.parse(rawText) : {};
                        message = json?.error || message;
                    } catch {
                        if (rawText) message = rawText;
                    }
                    setError(message);
                    await supabase.auth.signOut().catch(() => null);
                    return;
                }

                if (data.session) {
                    router.push('/manager/dashboard?scope=all&range=7d');
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
        <div className="w-full max-w-[400px] mx-auto space-y-6">
            <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {mode === 'login' ? 'おかえりなさい' : 'アカウント作成'}
                </h1>
                <p className="text-sm text-slate-500">
                    {mode === 'login'
                        ? 'アカウント情報を入力してログインしてください'
                        : '必要な情報を入力してアカウントを作成してください'}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                <button
                    type="button"
                    onClick={() => {
                        setMode('login');
                        setError('');
                        setNotice('');
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${mode === 'login'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
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
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${mode === 'signup'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                        }`}
                >
                    新規登録
                </button>
            </div>

            {/* Error/Notice Message */}
            {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
                    <p className="font-medium">エラーが発生しました</p>
                    <p>{error}</p>
                </div>
            )}
            {notice && (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-100">
                    <p className="font-medium">完了</p>
                    <p>{notice}</p>
                </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                会社名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                required
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                placeholder="例: 〇〇海運株式会社"
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    業種 <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                    required
                                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                >
                                    <option value="">選択</option>
                                    <option value="shipping">海運・船舶</option>
                                    <option value="logistics">物流・倉庫</option>
                                    <option value="manufacturing">製造業</option>
                                    <option value="foodservice">飲食・給食</option>
                                    <option value="retail">小売</option>
                                    <option value="other">その他</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    従業員規模 <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={companySize}
                                    onChange={(e) => setCompanySize(e.target.value)}
                                    required
                                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                >
                                    <option value="">選択</option>
                                    <option value="1-10">1-10名</option>
                                    <option value="11-50">11-50名</option>
                                    <option value="51-200">51-200名</option>
                                    <option value="201-500">201-500名</option>
                                    <option value="501-1000">501-1000名</option>
                                    <option value="1000+">1000名以上</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    担当者名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    required
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    placeholder="例: 山田 太郎"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    電話番号 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    placeholder="03-1234-5678"
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    部署
                                </label>
                                <input
                                    type="text"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    placeholder="例: 船舶運航部"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    役職
                                </label>
                                <input
                                    type="text"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    placeholder="例: 管理責任者"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700">
                            メールアドレス <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                            placeholder="name@company.com"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700">
                            パスワード <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading
                        ? '処理中...'
                        : mode === 'login'
                            ? 'ログイン'
                            : 'アカウントを作成'}
                </button>
            </form>
        </div>
    );
}

function LoginFormFallback() {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="grid min-h-screen w-full lg:grid-cols-2">
            <div className="relative hidden h-full flex-col bg-slate-900 p-10 text-white lg:flex justify-between">
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/login-bg.png"
                        alt="Background"
                        fill
                        className="object-cover opacity-60"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-slate-900/30" />
                </div>

                <div className="relative z-10 flex items-center gap-2">
                    <span className="text-3xl">🚢</span>
                    <span className="text-2xl font-bold tracking-tight">WELLSHIP</span>
                </div>

                <div className="relative z-10 max-w-lg space-y-4">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold leading-snug">
                            船上ライフを、<br />もっと豊かに、スマートに。
                        </h2>
                        <p className="text-base text-slate-200 leading-relaxed">
                            予算管理・献立作成・食材発注をこの一つで。<br />
                            WELLSHIPは、船員のウェルビーイング向上と調達業務の効率化を同時に実現する、海事産業特化型プラットフォームです。
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center bg-white p-8">
                <div className="lg:hidden flex items-center gap-2 mb-8">
                    <span className="text-2xl">🚢</span>
                    <span className="text-xl font-bold text-slate-900">WELLSHIP</span>
                </div>

                <Suspense fallback={<LoginFormFallback />}>
                    <AuthForm />
                </Suspense>

                <p className="mt-8 px-8 text-center text-xs text-slate-500">
                    By clicking continue, you agree to our{' '}
                    <a href="#" className="underline hover:text-slate-900">
                        Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="underline hover:text-slate-900">
                        Privacy Policy
                    </a>
                    .
                </p>
            </div>
        </div>
    );
}
