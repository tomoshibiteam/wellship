import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

    const response = NextResponse.next();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return response;
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            get(name: string) {
                return request.cookies.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
                response.cookies.set({ name, value, ...options });
            },
            remove(name: string, options: any) {
                response.cookies.set({ name, value: '', ...options });
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // 未ログインはログインページへ
    if (!user) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
