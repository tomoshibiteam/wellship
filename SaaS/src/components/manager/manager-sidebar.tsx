'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Ship,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { ROUTES } from '@/lib/routes';

const navItems = [
  {
    href: ROUTES.manager.dashboard,
    label: 'ダッシュボード',
    description: 'KPI・フィードバック分析',
    icon: LayoutDashboard,
  },
  {
    href: ROUTES.manager.vessels,
    label: '船舶・船員管理',
    description: 'フリート・クルー・カード',
    icon: Ship,
  },
  {
    href: ROUTES.manager.suppliers,
    label: 'サプライヤー管理',
    description: '提携業者・商品カタログ',
    icon: Store,
  },
  {
    href: ROUTES.manager.orders,
    label: '発注履歴',
    description: '全船舶の発注状況',
    icon: ShoppingCart,
  },
];

export function ManagerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white/95 px-3 py-6">
      <div className="px-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          WELLSHIP
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">本部ダッシュボード</h1>
      </div>

      <nav className="mt-6 flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition ${isActive
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p
                  className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-400'
                    }`}
                >
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="px-3">
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          直近の運用状況が優先表示されます。
        </div>
      </div>
    </aside>
  );
}
