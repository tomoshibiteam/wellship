'use client';

import { useEffect, useState } from 'react';
import { MailPlus, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ErrorBanner } from '@/components/ui/error';
import { PageLoading } from '@/components/ui/loading';
import { Modal } from '@/components/manager/modal';
import { EmptyState, SectionCard } from '@/components/manager/manager-ui';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vesselOptions, setVesselOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<ManagerUser[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagerUser | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<'CHEF' | 'MANAGER'>('CHEF');
  const [inviteVessels, setInviteVessels] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!inviteOpen && !editTarget) {
      setFormError(null);
    }
  }, [inviteOpen, editTarget]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [usersRes, vesselsRes] = await Promise.all([
          fetch('/api/manager/users'),
          fetch('/api/manager/vessels'),
        ]);
        if (!usersRes.ok) {
          throw new Error('ユーザー一覧の取得に失敗しました。');
        }
        const usersJson = await usersRes.json();
        const mappedUsers: ManagerUser[] = (usersJson?.users ?? []).map((user: any) => ({
          id: String(user.id),
          name: user.name ?? '未設定',
          email: user.email,
          role: user.role,
          status: user.status === 'INVITED' ? 'invited' : user.status === 'DISABLED' ? 'disabled' : 'active',
          vessels: user.vessels ?? [],
          phone: user.phone ?? null,
          lastLoginAt: user.lastLoginAt ?? null,
          invitedAt: user.invitedAt ?? null,
          disabledAt: user.disabledAt ?? null,
        }));
        const vesselsJson = vesselsRes.ok ? await vesselsRes.json() : { vessels: [] };
        const mappedVessels = (vesselsJson?.vessels ?? []).map((v: any) => ({
          id: String(v.id),
          name: v.name,
        }));
        if (!isMounted) return;
        setUsers(mappedUsers);
        setVesselOptions(mappedVessels);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : '読み込みに失敗しました。');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleInvite = async () => {
    setFormError(null);
    if (!inviteEmail.trim()) {
      setFormError('メールアドレスを入力してください。');
      return;
    }
    if (inviteRole === 'CHEF' && inviteVessels.length === 0) {
      setFormError('担当船舶を選択してください。');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/manager/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || null,
          phone: invitePhone.trim() || null,
          role: inviteRole,
          vesselIds: inviteRole === 'CHEF' ? inviteVessels : [],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || '招待に失敗しました。');
      }
      const user = json?.user;
      const newUser: ManagerUser = {
        id: String(user.id),
        name: user.name ?? inviteName || '招待ユーザー',
        email: user.email,
        role: user.role,
        status: user.status === 'INVITED' ? 'invited' : 'active',
        vessels: user.vessels ?? [],
        phone: user.phone ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        invitedAt: user.invitedAt ?? null,
        disabledAt: user.disabledAt ?? null,
      };
      setUsers((prev) => [newUser, ...prev]);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInvitePhone('');
      setInviteRole('CHEF');
      setInviteVessels([]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '招待に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setFormError(null);
    setIsSaving(true);
    try {
      const res = await fetch('/api/manager/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editTarget.id,
          name: editTarget.name,
          phone: editTarget.phone ?? null,
          role: editTarget.role,
          status:
            editTarget.status === 'invited'
              ? 'INVITED'
              : editTarget.status === 'disabled'
                ? 'DISABLED'
                : 'ACTIVE',
          vesselIds: editTarget.role === 'CHEF' ? editTarget.vessels : [],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || '更新に失敗しました。');
      }
      setUsers((prev) => prev.map((user) => (user.id === editTarget.id ? editTarget : user)));
      setEditTarget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '更新に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <PageLoading message="ユーザー一覧を読み込み中..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={() => window.location.reload()} />;
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
                  <th className="pb-3">連絡先</th>
                  <th className="pb-3">ロール</th>
                  <th className="pb-3">割当船舶</th>
                  <th className="pb-3">最終ログイン</th>
                  <th className="pb-3">状態</th>
                  <th className="pb-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 font-medium text-slate-900">{user.name}</td>
                    <td className="py-3 text-xs text-slate-500">
                      <div className="text-slate-700">{user.email}</div>
                      {user.phone ? (
                        <div className="text-[11px] text-slate-400">📞 {user.phone}</div>
                      ) : null}
                    </td>
                    <td className="py-3">{roleLabels[user.role]}</td>
                    <td className="py-3 text-xs text-slate-500">
                      {user.role === 'MANAGER'
                        ? '全船'
                        : user.vessels.length > 0
                          ? user.vessels
                              .map((vesselId) => vesselOptions.find((v) => v.id === vesselId)?.name)
                              .filter(Boolean)
                              .join(', ')
                          : '未割当'}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString('ja-JP')
                        : user.invitedAt
                          ? '未ログイン'
                          : '—'}
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
          {formError ? <ErrorBanner message={formError} /> : null}
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
            氏名（任意）
            <input
              type="text"
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="山田 太郎"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            連絡先（任意）
            <input
              type="tel"
              value={invitePhone}
              onChange={(event) => setInvitePhone(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="080-0000-0000"
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
              disabled={isSaving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? '送信中...' : '招待を送信'}
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
            {formError ? <ErrorBanner message={formError} /> : null}
            <div>
              <p className="text-xs text-slate-500">ユーザー</p>
              <p className="text-sm font-semibold text-slate-900">{editTarget.name}</p>
              <p className="text-xs text-slate-500">{editTarget.email}</p>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              氏名
              <input
                type="text"
                value={editTarget.name}
                onChange={(event) =>
                  setEditTarget({ ...editTarget, name: event.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              連絡先
              <input
                type="tel"
                value={editTarget.phone ?? ''}
                onChange={(event) =>
                  setEditTarget({ ...editTarget, phone: event.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              ロール
              <select
                value={editTarget.role}
                onChange={(event) =>
                  setEditTarget({
                    ...editTarget,
                    role: event.target.value as 'CHEF' | 'MANAGER',
                    vessels: event.target.value === 'MANAGER' ? [] : editTarget.vessels,
                  })
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              >
                <option value="CHEF">CHEF</option>
                <option value="MANAGER">MANAGER</option>
              </select>
            </label>
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
            {editTarget.role === 'MANAGER' && (
              <p className="text-xs text-slate-500">
                Managerは全船アクセス権を持ちます。
              </p>
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
                disabled={isSaving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? '保存中...' : '変更を保存'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
