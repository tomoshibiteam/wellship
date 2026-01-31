'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    BookOpen,
    Calendar,
    Compass,
    MessageSquare,
    ShoppingCart,
    Utensils,
} from 'lucide-react';
import { ROUTES } from '@/lib/routes';

const navItems = [
    {
        href: ROUTES.chef.recipes,
        label: 'レシピ一覧',
        description: '献立生成に使うレシピ管理',
        icon: BookOpen,
    },
    {
        href: ROUTES.chef.planning,
        label: '献立＆調達',
        description: 'AI献立生成・食材調達管理',
        icon: Compass,
    },
    {
        href: ROUTES.chef.dailyMenu,
        label: '毎日の献立管理',
        description: '当日の献立確定・編集',
        icon: Calendar,
    },

    {
        href: ROUTES.chef.feedback,
        label: '喫食フィードバック',
        description: 'NFCカードで収集',
        icon: Utensils,
    },

];

export function ChefNavigation() {
    const pathname = usePathname();

    return (
        <div className="flex h-full flex-col px-3 py-6">
            <div className="px-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    WELLSHIP
                </p>
                <h1 className="mt-2 text-lg font-semibold text-slate-900">司厨ダッシュボード</h1>
            </div>

            <nav className="mt-6 flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
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
                    本日の献立作成を完了させてください。
                </div>
            </div>
        </div>
    );
}

export function ChefSidebar() {
    return (
        <aside className="hidden h-screen w-64 border-r border-slate-200 bg-white/95 md:flex">
            <ChefNavigation />
        </aside>
    );
}
