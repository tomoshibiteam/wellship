'use client';

import Link from 'next/link';
import { useState } from 'react';
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
