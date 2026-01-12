import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const IMPERSONATE_COOKIE = 'impersonate_user_id';
const IMPERSONATE_ACTIVE_COOKIE = 'impersonate_active';
const TEST_ADMIN_EMAIL = 'wataru.1998.0606@gmail.com';

export async function POST(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.email) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { data: baseUser } = await supabase
        .from('User')
        .select('id,role,companyId,email')
        .or(`authUserId.eq.${authUser.id},email.eq.${authUser.email}`)
        .maybeSingle();

    const override = request.cookies.get('role_override')?.value;
    const allowOverride =
        process.env.NODE_ENV !== 'production' &&
        baseUser?.email?.toLowerCase() === TEST_ADMIN_EMAIL &&
        override === 'MANAGER';
    const effectiveManager = baseUser?.role === 'MANAGER' || allowOverride;

    if (!baseUser || !effectiveManager) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = body?.userId ? String(body.userId) : null;

    const response = NextResponse.json({ success: true });

    if (!userId) {
        response.cookies.set({
            name: IMPERSONATE_COOKIE,
            value: '',
            path: '/',
            maxAge: 0,
        });
        response.cookies.set({
            name: IMPERSONATE_ACTIVE_COOKIE,
            value: '',
            path: '/',
            maxAge: 0,
        });
        return response;
    }

    const { data: targetUser } = await supabase
        .from('User')
        .select('id,role,companyId')
        .eq('id', userId)
        .maybeSingle();

    if (
        !targetUser ||
        targetUser.companyId !== baseUser.companyId ||
        (targetUser.role !== 'CHEF' && targetUser.role !== 'MANAGER')
    ) {
        return NextResponse.json({ error: '対象ユーザーが見つかりません' }, { status: 400 });
    }

    response.cookies.set({
        name: IMPERSONATE_COOKIE,
        value: targetUser.id,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set({
        name: IMPERSONATE_ACTIVE_COOKIE,
        value: '1',
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 7,
    });
    return response;
}
