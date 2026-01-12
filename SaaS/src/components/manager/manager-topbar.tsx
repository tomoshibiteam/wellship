'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, LogOut, Settings, Users } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useManagerSearchParams } from '@/components/manager/use-manager-search-params';
import { getAlertCount } from '@/lib/manager/data';
import type { ManagerRange, ManagerScope } from '@/lib/manager/types';

interface ManagerTopBarProps {
  user: {
    name: string | null;
    email: string;
    role: 'MANAGER';
  };
  vessels: { id: string; name: string }[];
}

const rangeOptions: { label: string; value: ManagerRange }[] = [
  { label: '7日間', value: '7d' },
  { label: '30日間', value: '30d' },
  { label: '90日間', value: '90d' },
];

export function ManagerTopBar({ user, vessels }: ManagerTopBarProps) {
  const pathname = usePathname();
  const { scope, range, setScope, setRange } = useManagerSearchParams();

  const alertCount = useMemo(() => getAlertCount(scope, range), [scope, range]);

  const handleLogout = () => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.signOut().finally(() => {
      window.location.href = '/login';
    });
  };

  const currentScope = scope;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500">船舶スコープ</label>
          <select
            value={currentScope}
            onChange={(event) => setScope(event.target.value as ManagerScope)}
            className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="all">All Fleet</option>
            {vessels.map((vessel) => (
              <option key={vessel.id} value={`vessel:${vessel.id}`}>
                {vessel.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500">期間</label>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as ManagerRange)}
            className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={`/manager/alerts?scope=${scope}&range=${range}&status=open`}
          className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 ${
            pathname.startsWith('/manager/alerts') ? 'ring-2 ring-slate-300' : ''
          }`}
          aria-label="アラート"
        >
          <Bell className="h-5 w-5" />
          {alertCount > 0 ? (
            <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {alertCount}
            </span>
          ) : null}
        </Link>

        <details className="group relative">
          <summary className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {(user.name?.[0] || user.email[0]).toUpperCase()}
            </span>
            <span className="hidden sm:block">{user.name || user.email}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <Link
              href="/manager/settings"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <Link
              href="/manager/settings/users"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Users className="h-4 w-4" />
              Users
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
