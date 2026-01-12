import { ManagerSidebar } from '@/components/manager/manager-sidebar';
import { ManagerTopBar } from '@/components/manager/manager-topbar';

export function ManagerShell({
  children,
  user,
  vessels,
}: {
  children: React.ReactNode;
  user: { name: string | null; email: string; role: 'MANAGER' };
  vessels: { id: string; name: string }[];
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <ManagerSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <ManagerTopBar user={user} vessels={vessels} />
          <main className="flex-1 px-6 py-6">
            <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
