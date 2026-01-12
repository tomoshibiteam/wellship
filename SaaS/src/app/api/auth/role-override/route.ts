import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

const TEST_ADMIN_EMAIL = 'wataru.1998.0606@gmail.com';

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (process.env.NODE_ENV === 'production' || user.email.toLowerCase() !== TEST_ADMIN_EMAIL) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const role = body?.role;
    if (role !== 'CHEF' && role !== 'MANAGER' && role !== null) {
        return NextResponse.json({ error: 'role は CHEF / MANAGER / null のみ対応です' }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    if (role === null) {
        response.cookies.set({
            name: 'role_override',
            value: '',
            path: '/',
            maxAge: 0,
        });
        return response;
    }

    response.cookies.set({
        name: 'role_override',
        value: role,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
    return response;
}
