import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/manager/audit';

type CreatePayload = {
  name?: string;
  imoNumber?: string | null;
  budgetPerDay?: number | null;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'MANAGER') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: vessels, error } = await admin
    .from('Vessel')
    .select('id,name,imoNumber,budgetPerDay,memberships:UserVesselMembership(user:User(name,role))')
    .eq('companyId', user.companyId)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('Failed to load vessels', error);
    return NextResponse.json({ error: '船舶一覧の取得に失敗しました' }, { status: 500 });
  }

  const mapped = (vessels ?? []).map((vessel) => {
    const memberships = vessel.memberships ?? [];
    const chefNames = memberships
      .map((member: any) => {
        const rawUser = Array.isArray(member.user) ? member.user[0] : member.user;
        if (!rawUser || rawUser.role !== 'CHEF') return null;
        return rawUser.name ?? '司厨';
      })
      .filter(Boolean);
    return {
      id: vessel.id,
      name: vessel.name,
      imoNumber: vessel.imoNumber ?? null,
      budgetPerDay: vessel.budgetPerDay ?? null,
      chefNames,
    };
  });

  return NextResponse.json({ vessels: mapped });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'MANAGER') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as CreatePayload;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: '船名を入力してください' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: vessel, error } = await admin
    .from('Vessel')
    .insert({
      name,
      imoNumber: body.imoNumber?.trim() || null,
      budgetPerDay: body.budgetPerDay ?? undefined,
      companyId: user.companyId,
    })
    .select('id,name,imoNumber,budgetPerDay')
    .single();

  if (error || !vessel) {
    return NextResponse.json({ error: '船舶の追加に失敗しました' }, { status: 500 });
  }

  await logAuditEvent({
    companyId: user.companyId,
    actorUserId: user.id,
    action: 'vessel.created',
    metadata: { vesselId: vessel.id, name: vessel.name },
  });

  return NextResponse.json({
    vessel: {
      id: vessel.id,
      name: vessel.name,
      imoNumber: vessel.imoNumber ?? null,
      budgetPerDay: vessel.budgetPerDay ?? null,
      chefNames: [],
    },
  });
}
