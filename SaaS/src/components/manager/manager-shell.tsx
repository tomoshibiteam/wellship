import { ManagerSidebar } from '@/components/manager/manager-sidebar';
import { ManagerTopBar } from '@/components/manager/manager-topbar';

export function ManagerShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string | null; email: string; role: 'MANAGER' };
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex h-screen overflow-hidden">
        <ManagerSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <ManagerTopBar user={user} />
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
