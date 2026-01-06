import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/db/prisma';
import type { SessionUser, UserRole } from '@/lib/types/auth';

/**
 * 現在のセッションユーザーを取得
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            vesselMemberships: {
                select: { vesselId: true },
            },
        },
    });

    if (!user) return null;

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        companyId: user.companyId,
        vesselIds: user.vesselMemberships.map((m) => m.vesselId),
    };
}

/**
 * 認証必須 - 未認証ならエラー
 */
export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Unauthorized');
    }
    return user;
}

/**
 * 特定ロール必須
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<SessionUser> {
    const user = await requireAuth();
    if (!allowedRoles.includes(user.role)) {
        throw new Error('Forbidden');
    }
    return user;
}

/**
 * ロールに基づくデフォルトリダイレクト先を取得
 */
export function getDefaultRedirect(role: UserRole): string {
    switch (role) {
        case 'CHEF':
            return '/planning';
        case 'MANAGER':
            return '/manager/dashboard';
        default:
            return '/';
    }
}
