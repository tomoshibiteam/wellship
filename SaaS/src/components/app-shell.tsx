'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SidebarNav } from './sidebar';
import type { UserRole } from '@/lib/types/auth';

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name: string | null;
    email: string;
    role: UserRole;
  } | null;
}

export function AppShell({ children, user }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isClearingImpersonation, setIsClearingImpersonation] = useState(false);
  const router = useRouter();
  const canRoleSwitch =
    !!user &&
    process.env.NODE_ENV !== 'production' &&
    user.email.toLowerCase() === 'wataru.1998.0606@gmail.com';

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
          ? '/recipes'
          : '/manager/dashboard?scope=all&range=7d';
      router.push(target);
      router.refresh();
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
      router.push('/manager/dashboard?scope=all&range=7d');
      router.refresh();
    } finally {
      setIsClearingImpersonation(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-teal-50/60">
      <SidebarNav isOpen={isSidebarOpen} user={user} />
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-sky-100 bg-white/90 px-4 py-3 shadow-[0_12px_32px_rgba(14,94,156,0.06)] backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label="サイドバーの開閉"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-100 bg-white text-slate-700 shadow-sm transition hover:border-sky-200 hover:shadow-md"
            >
              <span className="text-lg">≡</span>
            </button>
            <Link href="/" className="hidden items-center gap-3 sm:flex">
              <p className="text-sm font-semibold leading-tight text-slate-900">
                WELLSHIP
              </p>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <>
                {isImpersonating && process.env.NODE_ENV !== 'production' && (
                  <button
                    type="button"
                    onClick={clearImpersonation}
                    disabled={isClearingImpersonation}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 shadow-sm"
                  >
                    本部に戻る
                  </button>
                )}
                {canRoleSwitch && (
                  <div className="flex items-center rounded-full border border-sky-100 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => switchRole('CHEF')}
                      disabled={isSwitchingRole || user.role === 'CHEF'}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${user.role === 'CHEF'
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-600 hover:bg-sky-50'
                        }`}
                    >
                      司厨
                    </button>
                    <button
                      type="button"
                      onClick={() => switchRole('MANAGER')}
                      disabled={isSwitchingRole || user.role === 'MANAGER'}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${user.role === 'MANAGER'
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-600 hover:bg-sky-50'
                        }`}
                    >
                      本部
                    </button>
                  </div>
                )}
                <span className="hidden rounded-full bg-sky-100 px-3 py-1.5 text-[11px] font-semibold text-sky-700 sm:inline">
                  {user.role === 'CHEF' && '👨‍🍳 現場側(司厨)'}
                  {user.role === 'MANAGER' && '🏢 管理側(本部)'}
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-1.5 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-teal-500 text-sm font-bold text-white">
                    {user.name?.[0] || user.email[0].toUpperCase()}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {user.name || user.email.split('@')[0]}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-8 md:px-10">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
