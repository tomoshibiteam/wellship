import { AppShell } from '@/components/app-shell';
import { getCurrentUser } from '@/lib/auth/session';
import type { UserRole } from '@/lib/types/auth';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const sessionUser = await getCurrentUser();

    const user = sessionUser
        ? {
            name: sessionUser.name,
            email: sessionUser.email,
            role: sessionUser.role as UserRole,
        }
        : null;

    return <AppShell user={user}>{children}</AppShell>;
}
