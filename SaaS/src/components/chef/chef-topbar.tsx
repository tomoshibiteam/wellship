'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Added for refresh
import { useState, useEffect } from 'react';
import { ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types/auth';
import { ROUTES } from '@/lib/routes';

interface ChefTopBarProps {
    user: {
        name: string | null;
        email: string;
        role: UserRole;
    } | null;
    onOpenMobileMenu?: () => void;
}

export function ChefTopBar({ user, onOpenMobileMenu }: ChefTopBarProps) {
    const router = useRouter(); // Added router for refresh
    const [isSwitchingRole, setIsSwitchingRole] = useState(false);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [isClearingImpersonation, setIsClearingImpersonation] = useState(false);

    const canRoleSwitch =
        !!user &&
        process.env.NODE_ENV !== 'production' &&
        user.email.toLowerCase() === 'wataru.1998.0606@gmail.com';

    // MVP用: ロールに応じた表示名
    const displayName = user?.role === 'CHEF' ? '山田' : user?.name || user?.email || '';

    useEffect(() => {
        if (process.env.NODE_ENV === 'production') return;
        const hasImpersonation = document.cookie
            .split(';')
            .some((cookie) => cookie.trim().startsWith('impersonate_active=1'));
        setIsImpersonating(hasImpersonation);
    }, []);

    const switchRole = async (role: UserRole) => {
        if (!user || isSwitchingRole || role === user.role) return;
        setIsSwitchingRole(true);
        try {
            const res = await fetch('/api/auth/role-override', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                console.error('Failed to switch role', data);
                return;
            }
            const target =
                role === 'CHEF'
                    ? ROUTES.chef.recipes
                    : ROUTES.manager.dashboard;

            // Use window.location for hard reload to ensure clean state transition
            window.location.href = target;
        } finally {
            setIsSwitchingRole(false);
        }
    };

    const clearImpersonation = async () => {
        if (isClearingImpersonation) return;
        setIsClearingImpersonation(true);
        try {
            const res = await fetch('/api/auth/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: null }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                console.error('Failed to clear impersonation', data);
                return;
            }
            setIsImpersonating(false);
            window.location.href = ROUTES.manager.dashboard;
        } finally {
            setIsClearingImpersonation(false);
        }
    };

    const handleLogout = () => {
        const supabase = createSupabaseBrowserClient();
        supabase.auth.signOut().finally(() => {
            window.location.href = '/login';
        });
    };

    return (
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
                {/* Role Switcher & Impersonation Warning */}
                {user && (
                    <>
                        {isImpersonating && process.env.NODE_ENV !== 'production' && (
                            <button
                                type="button"
                                onClick={clearImpersonation}
                                disabled={isClearingImpersonation}
                                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100"
                            >
                                ⚠️ 本部に戻る
                            </button>
                        )}
                        {canRoleSwitch && (
                            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                                <button
                                    type="button"
                                    onClick={() => switchRole('CHEF')}
                                    disabled={isSwitchingRole || user.role === 'CHEF'}
                                    className={`rounded-md px-3 py-1 text-xs font-semibold transition ${user.role === 'CHEF'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    司厨
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchRole('MANAGER')}
                                    disabled={isSwitchingRole || user.role === 'MANAGER'}
                                    className={`rounded-md px-3 py-1 text-xs font-semibold transition ${user.role === 'MANAGER'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    本部
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center gap-3">
                {user && (
                    <details className="group relative">
                        <summary className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                                {displayName[0]?.toUpperCase()}
                            </span>
                            <span className="hidden sm:block">{displayName}</span>
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                        </summary>
                        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5 focus:outline-none">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                                アカウント管理
                            </div>
                            <Link
                                href="/profile"
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                            >
                                <User className="h-4 w-4" />
                                プロフィール
                            </Link>
                            <Link
                                href="/settings"
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                            >
                                <Settings className="h-4 w-4" />
                                設定
                            </Link>
                            <div className="my-1 border-t border-slate-100" />
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                            >
                                <LogOut className="h-4 w-4" />
                                ログアウト
                            </button>
                        </div>
                    </details>
                )}
            </div>
        </header>
    );
}
