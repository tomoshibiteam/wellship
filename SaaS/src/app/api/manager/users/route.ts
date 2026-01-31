import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/manager/audit';

type InvitePayload = {
  email?: string;
  name?: string | null;
  phone?: string | null;
  role?: 'CHEF' | 'MANAGER';
  vesselIds?: string[];
};

type UpdatePayload = {
  userId?: string;
  name?: string | null;
  phone?: string | null;
  role?: 'CHEF' | 'MANAGER';
  status?: 'ACTIVE' | 'INVITED' | 'DISABLED';
  vesselIds?: string[];
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'MANAGER') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: users, error } = await admin
    .from('User')
    .select(
      'id,email,name,role,status,phone,lastLoginAt,invitedAt,disabledAt,authUserId,vesselMemberships:UserVesselMembership(vesselId)',
    )
    .eq('companyId', user.companyId)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('Failed to load users', error);
    return NextResponse.json({ error: 'ユーザー一覧の取得に失敗しました' }, { status: 500 });
  }

  const mapped = (users ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status ?? 'ACTIVE',
    phone: row.phone ?? null,
    lastLoginAt: row.lastLoginAt ?? null,
    invitedAt: row.invitedAt ?? null,
    disabledAt: row.disabledAt ?? null,
    vessels: (row.vesselMemberships ?? []).map((m: { vesselId: string }) => m.vesselId),
  }));

  return NextResponse.json({ users: mapped });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'MANAGER') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as InvitePayload;
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? 'CHEF';
  const name = body.name?.trim() || null;
  const phone = body.phone?.trim() || null;
  const vesselIds = body.vesselIds ?? [];

  if (!email) {
    return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 });
  }
  if (role === 'CHEF' && vesselIds.length === 0) {
    return NextResponse.json({ error: '担当船舶を選択してください' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existingUser } = await admin
    .from('User')
    .select('id')
    .eq('companyId', user.companyId)
    .ilike('email', email)
    .maybeSingle();
  if (existingUser) {
    return NextResponse.json({ error: '同じメールアドレスのユーザーが既に存在します' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: createdUser, error: createError } = await admin
    .from('User')
    .insert({
      email,
      name: name ?? email,
      phone,
      role,
      status: 'INVITED',
      invitedAt: now,
      companyId: user.companyId,
    })
    .select('id,email,name,role,status,phone,invitedAt,lastLoginAt,disabledAt')
    .single();

  if (createError || !createdUser) {
    return NextResponse.json({ error: 'ユーザーの招待に失敗しました' }, { status: 500 });
  }

  if (vesselIds.length > 0) {
    await admin.from('UserVesselMembership').insert(
      vesselIds.map((vesselId) => ({
        userId: createdUser.id,
        vesselId,
        role,
      })),
    );
  }

  await logAuditEvent({
    companyId: user.companyId,
    actorUserId: user.id,
    targetUserId: createdUser.id,
    action: 'user.invited',
    metadata: { role, vesselIds },
  });

  return NextResponse.json({
    user: {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
      role: createdUser.role,
      status: createdUser.status,
      phone: createdUser.phone ?? null,
      lastLoginAt: createdUser.lastLoginAt ?? null,
      invitedAt: createdUser.invitedAt ?? null,
      disabledAt: createdUser.disabledAt ?? null,
      vessels: vesselIds,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'MANAGER') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdatePayload;
  const targetUserId = body.userId?.trim();
  if (!targetUserId) {
    return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
  }

  if (targetUserId === user.id && body.status === 'DISABLED') {
    return NextResponse.json({ error: '自分自身は無効化できません' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existingUser, error: existingError } = await admin
    .from('User')
    .select('id,role,status,companyId')
    .eq('id', targetUserId)
    .maybeSingle();

  if (existingError || !existingUser || existingUser.companyId !== user.companyId) {
    return NextResponse.json({ error: '対象ユーザーが見つかりません' }, { status: 404 });
  }

  const updatePayload: Record<string, string | null> = {};
  if (body.name !== undefined) updatePayload.name = body.name?.trim() || null;
  if (body.phone !== undefined) updatePayload.phone = body.phone?.trim() || null;
  if (body.role) updatePayload.role = body.role;
  if (body.status) {
    updatePayload.status = body.status;
    if (body.status === 'DISABLED') {
      updatePayload.disabledAt = new Date().toISOString();
    } else if (body.status === 'ACTIVE') {
      updatePayload.disabledAt = null;
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await admin
      .from('User')
      .update(updatePayload)
      .eq('id', targetUserId);
    if (updateError) {
      return NextResponse.json({ error: 'ユーザー情報の更新に失敗しました' }, { status: 500 });
    }
  }

  if (body.vesselIds) {
    if ((body.role ?? existingUser.role) === 'CHEF' && body.vesselIds.length === 0) {
      return NextResponse.json({ error: '担当船舶を選択してください' }, { status: 400 });
    }
    const vesselIds = body.vesselIds;
    await admin.from('UserVesselMembership').delete().eq('userId', targetUserId);
    if (vesselIds.length > 0) {
      await admin.from('UserVesselMembership').insert(
        vesselIds.map((vesselId) => ({
          userId: targetUserId,
          vesselId,
          role: body.role ?? existingUser.role,
        })),
      );
    }
  }

  if (body.role && body.role !== existingUser.role) {
    await logAuditEvent({
      companyId: user.companyId,
      actorUserId: user.id,
      targetUserId: targetUserId,
      action: 'user.role_changed',
      metadata: { from: existingUser.role, to: body.role },
    });
  }

  if (body.status && body.status !== existingUser.status) {
    await logAuditEvent({
      companyId: user.companyId,
      actorUserId: user.id,
      targetUserId: targetUserId,
      action: 'user.status_changed',
      metadata: { from: existingUser.status, to: body.status },
    });
  }

  if (body.vesselIds) {
    await logAuditEvent({
      companyId: user.companyId,
      actorUserId: user.id,
      targetUserId: targetUserId,
      action: 'user.vessels_changed',
      metadata: { vesselIds: body.vesselIds },
    });
  }

  return NextResponse.json({ ok: true });
}
