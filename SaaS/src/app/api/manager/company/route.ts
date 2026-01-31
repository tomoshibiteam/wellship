import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/manager/audit';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'MANAGER') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: company, error } = await admin
    .from('Company')
    .select('id,name,slug')
    .eq('id', user.companyId)
    .maybeSingle();

  if (error || !company) {
    return NextResponse.json({ error: '会社情報の取得に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ company });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'MANAGER') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: company, error } = await admin
    .from('Company')
    .update({ name })
    .eq('id', user.companyId)
    .select('id,name,slug')
    .single();

  if (error || !company) {
    return NextResponse.json({ error: '会社名の更新に失敗しました' }, { status: 500 });
  }

  await logAuditEvent({
    companyId: user.companyId,
    actorUserId: user.id,
    action: 'company.updated',
    metadata: { name },
  });

  return NextResponse.json({ company });
}
