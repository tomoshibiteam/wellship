'use client';

import { useState } from 'react';
import { ChefSidebar } from '@/components/chef/chef-sidebar';
import { ChefTopBar } from '@/components/chef/chef-topbar';
import { ChefMobileNav } from '@/components/chef/chef-mobile-nav';
import type { UserRole } from '@/lib/types/auth';

interface ChefShellProps {
    children: React.ReactNode;
    user: {
        name: string | null;
        email: string;
        role: UserRole;
    } | null;
}

export function ChefShell({ children, user }: ChefShellProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50">
            <ChefMobileNav
                open={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />
            <div className="flex h-screen overflow-hidden">
                <ChefSidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                    <ChefTopBar
                        user={user}
                        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
                    />
                    <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
                        <div className="mx-auto w-full space-y-6">{children}</div>
                    </main>
                </div>
            </div>
        </div>
    );
}
