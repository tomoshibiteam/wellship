'use client';

import { useState } from 'react';
import { SupplierSidebar } from './supplier-sidebar';
import type { UserRole } from '@/lib/types/auth';

interface SupplierShellProps {
    children: React.ReactNode;
    user: {
        name: string | null;
        email: string;
        role: UserRole;
    } | null;
}

import { SupplierTopBar } from './supplier-topbar';

export function SupplierShell({ children, user }: SupplierShellProps) {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="flex h-screen overflow-hidden">
                <SupplierSidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                    <SupplierTopBar user={user} />
                    <main className="flex-1 overflow-y-auto px-6 py-6">
                        <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
                    </main>
                </div>
            </div>
        </div>
    );
}
