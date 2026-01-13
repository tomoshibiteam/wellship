'use client';

import { X } from 'lucide-react';
import { ChefNavigation } from './chef-sidebar';

interface ChefMobileNavProps {
    open: boolean;
    onClose: () => void;
}

export function ChefMobileNav({ open, onClose }: ChefMobileNavProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-start bg-slate-900/40">
            <div className="flex h-full w-64 flex-col bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <h3 className="text-base font-semibold text-slate-900">メニュー</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                        aria-label="閉じる"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto" onClick={onClose}>
                    {/* Reuse ChefNavigation but reset full height since wrapper handles it */}
                    <ChefNavigation />
                </div>
            </div>
        </div>
    );
}
