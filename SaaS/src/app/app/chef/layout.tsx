import { redirect } from 'next/navigation';
import { ChefShell } from '@/components/chef/chef-shell';
import { getCurrentUser } from '@/lib/auth/session';
import { ROUTES } from '@/lib/routes';
import type { UserRole } from '@/lib/types/auth';

export default async function ChefLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser();

    if (!user) {
        redirect(ROUTES.auth.login);
    }

    // Chefでないユーザーはマネージャー画面へリダイレクト
    if (user.role !== 'CHEF') {
        redirect(ROUTES.manager.dashboard);
    }

    return (
        <ChefShell
            user={{
                name: user.name,
                email: user.email,
                role: user.role as UserRole,
            }}
        >
            {children}
        </ChefShell>
    );
}
