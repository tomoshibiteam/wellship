'use client';

import { useEffect, useMemo, useState } from 'react';
import { MailPlus, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { useMockQuery } from '@/components/manager/use-mock-query';
import { Modal } from '@/components/manager/modal';
import { EmptyState, SectionCard } from '@/components/manager/manager-ui';
import { getManagerUsers } from '@/lib/manager/data';
import { mockVessels } from '@/lib/manager/mock-data';
import type { ManagerUser } from '@/lib/manager/types';

const roleLabels = {
  CHEF: '司厨',
  MANAGER: '本部',
};

const statusLabels = {
  active: '有効',
  invited: '招待中',
  disabled: '無効',
};

export default function UsersClient() {
  const { data, isLoading, error, retry } = useMockQuery(() => getManagerUsers(), []);
  const [users, setUsers] = useState<ManagerUser[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagerUser | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'CHEF' | 'MANAGER'>('CHEF');
  const [inviteVessels, setInviteVessels] = useState<string[]>([]);

  useEffect(() => {
    if (data) setUsers(data);
  }, [data]);

  const vesselOptions = useMemo(() => mockVessels.map((v) => ({ id: v.id, name: v.name })), []);

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    const newUser: ManagerUser = {
      id: `user-${Date.now()}`,
      name: '招待ユーザー',
      email: inviteEmail.trim(),
      role: inviteRole,
      vessels: inviteRole === 'CHEF' ? inviteVessels : vesselOptions.map((v) => v.id),
      status: 'invited',
    };
    setUsers((prev) => [newUser, ...prev]);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('CHEF');
    setInviteVessels([]);
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    setUsers((prev) => prev.map((user) => (user.id === editTarget.id ? editTarget : user)));
    setEditTarget(null);
  };

  if (isLoading) {
    return <PageLoading message="ユーザー一覧を読み込み中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={retry} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="CHEF招待と船舶割当を管理します。"
        badge="Manager"
      />

      <SectionCard title="ユーザー一覧" description="招待/権限/割当を管理します。">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <MailPlus className="h-4 w-4" />
            招待
          </button>
        </div>

        {users.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="ユーザーがいません"
              description="招待を作成して最初のユーザーを追加してください。"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th className="pb-3">名前</th>
                  <th className="pb-3">メール</th>
                  <th className="pb-3">ロール</th>
                  <th className="pb-3">割当船舶</th>
                  <th className="pb-3">状態</th>
                  <th className="pb-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 font-medium text-slate-900">{user.name}</td>
                    <td className="py-3 text-xs text-slate-500">{user.email}</td>
                    <td className="py-3">{roleLabels[user.role]}</td>
                    <td className="py-3 text-xs text-slate-500">
                      {user.vessels.length > 0
                        ? user.vessels
                            .map((vesselId) => vesselOptions.find((v) => v.id === vesselId)?.name)
                            .filter(Boolean)
                            .join(', ')
                        : '未割当'}
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : user.status === 'invited'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                      }`}>
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => setEditTarget({ ...user })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        編集
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="ユーザー招待" size="md">
        <div className="space-y-4 text-sm">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="chef@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            role
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as 'CHEF' | 'MANAGER')}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            >
              <option value="CHEF">CHEF</option>
              <option value="MANAGER">MANAGER</option>
            </select>
          </label>
          {inviteRole === 'CHEF' && (
            <div>
              <p className="text-sm font-medium text-slate-700">担当船舶</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {vesselOptions.map((vessel) => (
                  <label key={vessel.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={inviteVessels.includes(vessel.id)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...inviteVessels, vessel.id]
                          : inviteVessels.filter((id) => id !== vessel.id);
                        setInviteVessels(next);
                      }}
                    />
                    {vessel.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleInvite}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              招待を送信
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="ユーザー編集"
        size="md"
      >
        {editTarget ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">ユーザー</p>
              <p className="text-sm font-semibold text-slate-900">{editTarget.name}</p>
              <p className="text-xs text-slate-500">{editTarget.email}</p>
            </div>
            {editTarget.role === 'CHEF' && (
              <div>
                <p className="text-sm font-medium text-slate-700">担当船舶</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {vesselOptions.map((vessel) => (
                    <label key={vessel.id} className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={editTarget.vessels.includes(vessel.id)}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...editTarget.vessels, vessel.id]
                            : editTarget.vessels.filter((id) => id !== vessel.id);
                          setEditTarget({ ...editTarget, vessels: next });
                        }}
                      />
                      {vessel.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="block text-sm font-medium text-slate-700">
              ステータス
              <select
                value={editTarget.status}
                onChange={(event) =>
                  setEditTarget({
                    ...editTarget,
                    status: event.target.value as ManagerUser['status'],
                  })
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              >
                <option value="active">有効</option>
                <option value="invited">招待中</option>
                <option value="disabled">無効</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                変更を保存
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
