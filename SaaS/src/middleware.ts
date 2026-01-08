import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { ROLE_PERMISSIONS } from '@/lib/auth/guards';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // APIルートはすべてスキップ（認証チェックはAPI側で行う）
    if (pathname.startsWith('/api')) {
        return NextResponse.next();
    }

    // 公開パスはスキップ
    const publicPaths = ['/', '/login'];
    if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return NextResponse.next();
    }

    // 静的ファイルはスキップ
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    const token = await getToken({ req: request });

    // 未ログインはログインページへ
    if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    const role = token.role as keyof typeof ROLE_PERMISSIONS;
    const permission = ROLE_PERMISSIONS[role];

    if (!permission) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // ロールに許可されたパスかチェック
    const isAllowed = permission.allowedPaths.some((p) => pathname.startsWith(p));

    if (!isAllowed) {
        return NextResponse.redirect(new URL(permission.defaultRedirect, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
