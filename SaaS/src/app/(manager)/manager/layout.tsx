import { redirect } from 'next/navigation';
import { ManagerShell } from '@/components/manager/manager-shell';
import { getCurrentUser, getDefaultRedirect } from '@/lib/auth/session';
import { mockVessels } from '@/lib/manager/mock-data';

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

  const vesselOptions =
    user.vesselIds.length > 0
      ? mockVessels.filter((vessel) => user.vesselIds.includes(vessel.id))
      : mockVessels;

  return (
    <ManagerShell
      user={{ name: user.name, email: user.email, role: 'MANAGER' }}
      vessels={vesselOptions.map((vessel) => ({ id: vessel.id, name: vessel.name }))}
    >
      {children}
    </ManagerShell>
  );
}
