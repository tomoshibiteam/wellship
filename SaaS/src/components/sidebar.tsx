'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types/auth';
import RecipeDebugTableButton from '@/components/sidebar/recipe-debug-button';

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
  roles: UserRole[]; // このアイテムを表示するロール
};

const allNavItems: NavItem[] = [
  {
    href: '/recipes',
    label: 'レシピ一覧',
    description: '献立生成に使うレシピ管理',
    icon: '📖',
    roles: ['CHEF'],
  },
  {
    href: '/planning',
    label: '献立＆調達',
    description: 'AI献立生成・食材調達管理',
    icon: '🧭',
    roles: ['CHEF'],
  },
  {
    href: '/daily-menu',
    label: '毎日の献立管理',
    description: '当日の献立確定・編集',
    icon: '📅',
    roles: ['CHEF'],
  },
  {
    href: '/feedback',
    label: '喫食フィードバック',
    description: 'NFCカードで収集',
    icon: '🍽️',
    roles: ['CHEF'],
  },
  {
    href: '/feedback-summary',
    label: 'みんなの声',
    description: '嬉しいフィードバック',
    icon: '💬',
    roles: ['CHEF'],
  },
  {
    href: '/feedback-insights',
    label: 'フィードバック集計',
    description: '船舶ごとの統計分析',
    icon: '📊',
    roles: ['MANAGER'],
  },
  {
    href: '/manager/dashboard',
    label: '管理ダッシュボード',
    description: '全船舶のモニタリング',
    icon: '🏢',
    roles: ['MANAGER'],
  },
  {
    href: '/manager/crew',
    label: 'クルー管理',
    description: '船員カードの登録・管理',
    icon: '👥',
    roles: ['MANAGER'],
  },
  {
    href: '/executive/summary',
    label: '経営サマリー',
    description: '全社KPI・ESGレポート',
    icon: '📈',
    roles: ['MANAGER'],
  },
];

const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

interface SidebarNavProps {
  isOpen: boolean;
  user: {
    name: string | null;
    email: string;
    role: UserRole;
  } | null;
}

export function SidebarNav({ isOpen, user }: SidebarNavProps) {
  const pathname = usePathname();

  // ユーザーのロールに基づいてナビゲーション項目をフィルタ
  const navItems = user
    ? allNavItems.filter((item) => item.roles.includes(user.role))
    : [];

  const handleSignOut = () => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.signOut().finally(() => {
      window.location.href = '/login';
    });
  };

  return (
    <aside
      className={classNames(
        'flex h-full shrink-0 flex-col border-r border-sky-100/80 bg-gradient-to-b from-sky-50/70 via-white to-teal-50/50 px-3 py-4 shadow-sm transition-all duration-200',
        isOpen ? 'w-64 md:w-72' : 'w-20'
      )}
    >
      {isOpen && (
        <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          メニュー
        </div>
      )}

      <nav className="mt-3 flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(`${item.href}`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                'group block rounded-xl border px-3 py-3 transition-all',
                'hover:-translate-y-[1px] hover:border-sky-200/70 hover:bg-white hover:shadow-md',
                isActive
                  ? 'border-sky-200 bg-white text-sky-900 shadow-md ring-1 ring-sky-100'
                  : 'border-transparent bg-white/40 text-slate-600'
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={classNames(
                    'flex h-9 w-9 items-center justify-center rounded-full text-base',
                    isActive
                      ? 'bg-gradient-to-br from-sky-600 to-teal-500 text-white shadow-sm'
                      : 'bg-sky-100 text-sky-700'
                  )}
                  title={item.label}
                >
                  {item.icon}
                </span>
                {isOpen ? (
                  <div className="flex flex-col">
                    <span
                      className={classNames(
                        'text-sm font-semibold',
                        isActive ? 'text-slate-900' : 'text-slate-800'
                      )}
                    >
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.description}
                    </p>
                  </div>
                ) : null}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Debug & Signout */}
      <div className="mt-auto space-y-2 pt-6">
        <RecipeDebugTableButton isOpen={isOpen} />

        {user && (
          <button
            onClick={handleSignOut}
            className={classNames(
              'flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-slate-600 transition-all',
              'hover:border-red-200/70 hover:bg-red-50 hover:text-red-700'
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-base">
              🚪
            </span>
            {isOpen && (
              <span className="text-sm font-semibold">ログアウト</span>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
