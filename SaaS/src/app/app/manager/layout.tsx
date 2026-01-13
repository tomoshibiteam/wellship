import { redirect } from 'next/navigation';
import { ManagerShell } from '@/components/manager/manager-shell';
import { getCurrentUser } from '@/lib/auth/session';
import { ROUTES } from '@/lib/routes';

export default async function ManagerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser();

    if (!user) {
        redirect(ROUTES.auth.login);
    }

    // Managerでないユーザーは司厨画面へリダイレクト
    if (user.role !== 'MANAGER') {
        redirect(ROUTES.chef.recipes);
    }

    return (
        <ManagerShell
            user={{ name: user.name, email: user.email, role: 'MANAGER' }}
        >
            {children}
        </ManagerShell>
    );
}
