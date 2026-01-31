'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/manager/manager-ui';
import { ErrorBanner } from '@/components/ui/error';

type SwitchTarget = {
  id: string;
  label: string;
  role: 'CHEF' | 'MANAGER';
};

type AuditLogEntry = {
  id: string;
  action: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
  target: { id: string; name: string } | null;
  metadata?: Record<string, unknown> | null;
};

const auditLabels: Record<string, string> = {
  'user.invited': 'ユーザー招待',
  'user.role_changed': '権限変更',
  'user.status_changed': 'ステータス変更',
  'user.vessels_changed': '船舶割当変更',
  'vessel.created': '船舶追加',
  'company.updated': '会社情報更新',
};

export default function SettingsClient() {
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(true);
  const isTestEnv = process.env.NODE_ENV !== 'production';
  const [switchTargets, setSwitchTargets] = useState<SwitchTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (!isTestEnv || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    let isActive = true;
    const load = async () => {
      try {
        const [meRes, chefsRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/users/chefs'),
        ]);
        if (!meRes.ok) throw new Error('アカウント情報の取得に失敗しました。');
        const meJson = await meRes.json();
        const me = meJson?.user;
        if (!me?.id) throw new Error('アカウント情報が取得できませんでした。');

        let chefs: Array<{ id: string; name: string | null; email: string }> = [];
        if (chefsRes.ok) {
          const chefsJson = await chefsRes.json();
          chefs = (chefsJson?.chefs ?? []).map((chef: any) => ({
            id: String(chef.id),
            name: chef.name ?? null,
            email: chef.email,
          }));
        }

        const targets: SwitchTarget[] = [
          {
            id: me.id,
            label: `本部（${me.name || me.email}）`,
            role: 'MANAGER',
          },
          ...chefs
            .filter((chef) => chef.id !== me.id)
            .map((chef) => ({
              id: chef.id,
              label: `司厨（${chef.name || chef.email}）`,
              role: 'CHEF' as const,
            })),
        ];

        if (!isActive) return;
        const uniqueTargets = Array.from(
          new Map(targets.map((target) => [target.id, target])).values()
        );
        setManagerId(me.id);
        setSwitchTargets(uniqueTargets);
        if (!selectedTargetId) {
          setSelectedTargetId(me.id);
        }
      } catch (err) {
        if (isActive) {
          setSwitchError(err instanceof Error ? err.message : 'アカウント情報を取得できません。');
          hasLoadedRef.current = false;
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [isTestEnv, selectedTargetId]);

  useEffect(() => {
    let isMounted = true;
    const loadCompany = async () => {
      setCompanyLoading(true);
      setCompanyError(null);
      try {
        const res = await fetch('/api/manager/company');
        if (!res.ok) {
          throw new Error('会社情報の取得に失敗しました。');
        }
        const json = await res.json();
        if (!isMounted) return;
        setCompanyName(json?.company?.name ?? '');
        setCompanyId(json?.company?.id ?? null);
      } catch (err) {
        if (isMounted) {
          setCompanyError(err instanceof Error ? err.message : '会社情報を取得できません。');
        }
      } finally {
        if (isMounted) setCompanyLoading(false);
      }
    };
    loadCompany();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadAudit = async () => {
      setAuditLoading(true);
      setAuditError(null);
      try {
        const res = await fetch('/api/manager/audit-logs?limit=20');
        if (!res.ok) throw new Error('監査ログの取得に失敗しました。');
        const json = await res.json();
        if (!isMounted) return;
        setAuditLogs(json?.logs ?? []);
      } catch (err) {
        if (isMounted) {
          setAuditError(err instanceof Error ? err.message : '監査ログを取得できません。');
        }
      } finally {
        if (isMounted) setAuditLoading(false);
      }
    };
    loadAudit();
    return () => {
      isMounted = false;
    };
  }, []);

  const targetMap = useMemo(() => {
    return new Map(switchTargets.map((target) => [target.id, target]));
  }, [switchTargets]);

  const handleSwitch = async () => {
    if (!selectedTargetId || !managerId) return;
    setIsSwitching(true);
    setSwitchError(null);
    try {
      const shouldClear = selectedTargetId === managerId;
      const res = await fetch('/api/auth/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: shouldClear ? null : selectedTargetId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'アカウント切り替えに失敗しました。');
      }
      const targetRole = targetMap.get(selectedTargetId)?.role ?? 'MANAGER';
      const nextUrl =
        shouldClear || targetRole === 'MANAGER'
          ? '/manager/dashboard?scope=all&range=7d'
          : '/recipes';
      window.location.href = nextUrl;
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'アカウント切り替えに失敗しました。');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!companyName.trim()) {
      setCompanyError('会社名を入力してください。');
      return;
    }
    setCompanySaving(true);
    setCompanyError(null);
    try {
      const res = await fetch('/api/manager/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || '会社名の更新に失敗しました。');
      }
      const json = await res.json();
      setCompanyName(json?.company?.name ?? companyName.trim());
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : '会社名の更新に失敗しました。');
    } finally {
      setCompanySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="本部向けの初期設定と情報確認を行います。"
        badge="Manager"
      />

      <SectionCard title="会社情報" description="表示名の変更は任意です。">
        <div className="space-y-3">
          {companyError ? <ErrorBanner message={companyError} /> : null}
          <label className="block text-sm font-medium text-slate-700">
            会社表示名
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="会社名を入力"
              disabled={companyLoading}
            />
          </label>
          <button
            type="button"
            onClick={handleSaveCompany}
            disabled={companySaving || companyLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {companySaving ? '保存中...' : '変更を保存'}
          </button>
          {companyId ? (
            <p className="text-xs text-slate-400">Company ID: {companyId}</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="ユーザー管理" description="CHEF招待と割当管理はこちら。">
        <Link
          href="/manager/settings/users"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          <Users className="h-4 w-4" />
          Users を開く
        </Link>
      </SectionCard>

      {isTestEnv && (
        <SectionCard
          title="テスト用アカウント切り替え"
          description="本部 ↔ 司厨アカウントを簡易切り替えできます。"
        >
          <div className="space-y-3">
            {switchError ? (
              <ErrorBanner message={switchError} />
            ) : null}
            <label className="block text-sm font-medium text-slate-700">
              切り替え先
              <select
                value={selectedTargetId}
                onChange={(event) => setSelectedTargetId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              >
                {switchTargets.length === 0 ? (
                  <option value="">読み込み中...</option>
                ) : (
                  switchTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="button"
              onClick={handleSwitch}
              disabled={isSwitching || !selectedTargetId}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSwitching ? '切り替え中...' : '切り替える'}
            </button>
            <p className="text-xs text-slate-500">
              本番環境ではこの項目は表示されません。
            </p>
          </div>
        </SectionCard>
      )}

      <SectionCard title="監査ログ" description="直近の権限変更や招待履歴を確認します。">
        {auditError ? <ErrorBanner message={auditError} /> : null}
        {auditLoading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : auditLogs.length === 0 ? (
          <p className="text-sm text-slate-500">まだ履歴がありません。</p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {auditLabels[log.action] ?? log.action}
                  </span>
                  <span>
                    {log.actor?.name ?? 'システム'} → {log.target?.name ?? '—'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(log.createdAt).toLocaleString('ja-JP')}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="データ出力" description="MVPではリンクのみ提供します。">
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            📄 ESGレポート
          </button>
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            📁 CSVエクスポート
          </button>
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            外部連携ガイド
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </SectionCard>

      <SectionCard title="ビルド情報" description="MVP用の簡易表示です。">
        <div className="space-y-1 text-xs text-slate-500">
          <p>Version: 0.1.0-mvp</p>
          <p>Build: 2025.02</p>
          <p>Environment: Demo</p>
        </div>
      </SectionCard>
    </div>
  );
}
