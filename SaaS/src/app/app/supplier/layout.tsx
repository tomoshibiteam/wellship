import { redirect } from 'next/navigation';
import { SupplierShell } from '@/components/supplier/supplier-shell';
import { getCurrentUser } from '@/lib/auth/session';
import { ROUTES } from '@/lib/routes';

export default async function SupplierLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser();

    if (!user) {
        redirect(ROUTES.auth.login);
    }

    // Role check logic
    // Normally we'd redirect if not SUPPLIER, but for MVP/Demo flexibility we allow dev override.
    // If stricly enforced:
    if (user.role !== 'SUPPLIER' && process.env.NODE_ENV === 'production') {
        redirect(ROUTES.auth.login);
    }

    return (
        <SupplierShell
            user={{ name: user.name, email: user.email, role: user.role }}
        >
            {children}
        </SupplierShell>
    );
}
