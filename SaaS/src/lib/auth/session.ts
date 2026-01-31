import type { SessionUser, UserRole } from '@/lib/types/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { ROUTES, getDefaultRouteForRole } from '@/lib/routes';

type SupabaseUserRow = {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    status?: 'ACTIVE' | 'INVITED' | 'DISABLED' | null;
    lastLoginAt?: string | null;
    companyId: string;
    authUserId: string | null;
    vesselMemberships?: { vesselId: string }[] | null;
};

/**
 * 現在のセッションユーザーを取得
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.email) {
        return null;
    }

    const { data: user, error } = await supabase
        .from('User')
        .select(
            'id,email,name,role,status,lastLoginAt,companyId,authUserId,vesselMemberships:UserVesselMembership(vesselId)',
        )
        .or(`authUserId.eq.${authUser.id},email.eq.${authUser.email}`)
        .maybeSingle<SupabaseUserRow>();

    if (error) {
        console.error('Failed to load user', {
            message: (error as { message?: string }).message,
            details: (error as { details?: string }).details,
            hint: (error as { hint?: string }).hint,
            code: (error as { code?: string }).code,
        });
        return null;
    }

    if (!user) {
        return null;
    }

    if (user.status === 'DISABLED') {
        return null;
    }

    if (!user.authUserId) {
        await supabase
            .from('User')
            .update({ authUserId: authUser.id })
            .eq('id', user.id);
    }

    const shouldActivate = user.status === 'INVITED';
    const shouldUpdateLogin =
        !user.lastLoginAt ||
        Date.now() - new Date(user.lastLoginAt).getTime() > 1000 * 60 * 60 * 6;
    if (shouldActivate || shouldUpdateLogin) {
        const updatePayload: Record<string, string | null> = {
            lastLoginAt: new Date().toISOString(),
        };
        if (shouldActivate) {
            updatePayload.status = 'ACTIVE';
            updatePayload.disabledAt = null;
        }
        await supabase
            .from('User')
            .update(updatePayload)
            .eq('id', user.id);
    }

    const resolveVesselIds = (memberships?: { vesselId: string }[] | null) =>
        memberships?.map((m) => m.vesselId) ?? [];

    const vesselIds = resolveVesselIds(user.vesselMemberships);

    const cookieStore = await cookies();
    const allowImpersonation = process.env.NODE_ENV !== 'production' && user.role === 'MANAGER';
    const impersonateUserId = allowImpersonation
        ? cookieStore.get('impersonate_user_id')?.value
        : null;
    if (impersonateUserId && impersonateUserId !== user.id) {
        const { data: targetUser } = await supabase
            .from('User')
            .select('id,email,name,role,companyId,authUserId,vesselMemberships:UserVesselMembership(vesselId)')
            .eq('id', impersonateUserId)
            .maybeSingle<SupabaseUserRow>();
        if (
            targetUser &&
            targetUser.companyId === user.companyId &&
            (targetUser.role === 'CHEF' || targetUser.role === 'MANAGER')
        ) {
            const targetVesselIds = resolveVesselIds(targetUser.vesselMemberships);
            return {
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                role: targetUser.role as UserRole,
                companyId: targetUser.companyId,
                vesselIds: targetVesselIds,
            };
        }
    }

    const baseRole = user.role as UserRole;
    // const normalizedEmail = user.email.toLowerCase();
    const allowRoleOverride =
        process.env.NODE_ENV !== 'production';
    // normalizedEmail === 'wataru.1998.0606@gmail.com';
    let resolvedRole = baseRole;
    if (allowRoleOverride) {
        const override = cookieStore.get('role_override')?.value;
        if (override === 'CHEF' || override === 'MANAGER' || override === 'SUPPLIER') {
            resolvedRole = override;
        }
    }

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: resolvedRole,
        companyId: user.companyId,
        vesselIds,
    };
}

/**
 * 認証必須 - 未認証ならエラー
 */
export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('認証が必要です');
    }
    return user;
}

/**
 * 特定ロール必須
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<SessionUser> {
    const user = await requireAuth();
    if (!allowedRoles.includes(user.role)) {
        throw new Error('権限がありません');
    }
    return user;
}

/**
 * ロールに基づくデフォルトリダイレクト先を取得
 */
export function getDefaultRedirect(role: UserRole): string {
    return getDefaultRouteForRole(role);
}
