import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'MANAGER') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);

  const admin = createSupabaseAdminClient();
  const { data: logs, error } = await admin
    .from('AuditLog')
    .select(
      'id,action,metadata,createdAt,actorUser:User!AuditActor(id,name,email),targetUser:User!AuditTarget(id,name,email)',
    )
    .eq('companyId', user.companyId)
    .order('createdAt', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to load audit logs', error);
    return NextResponse.json({ error: '監査ログの取得に失敗しました' }, { status: 500 });
  }

  const mapped = (logs ?? []).map((log: any) => ({
    id: log.id,
    action: log.action,
    metadata: log.metadata ?? null,
    createdAt: log.createdAt,
    actor: log.actorUser
      ? {
          id: log.actorUser.id,
          name: log.actorUser.name ?? log.actorUser.email ?? '不明',
        }
      : null,
    target: log.targetUser
      ? {
          id: log.targetUser.id,
          name: log.targetUser.name ?? log.targetUser.email ?? '不明',
        }
      : null,
  }));

  return NextResponse.json({ logs: mapped });
}
