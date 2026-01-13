import { redirect } from 'next/navigation';
import { ManagerShell } from '@/components/manager/manager-shell';
import { getCurrentUser, getDefaultRedirect } from '@/lib/auth/session';

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (user.role !== 'MANAGER') {
    redirect(getDefaultRedirect(user.role));
  }

  return (
    <ManagerShell
      user={{ name: user.name, email: user.email, role: 'MANAGER' }}
    >
      {children}
    </ManagerShell>
  );
}
