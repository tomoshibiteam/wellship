import type { SessionUser, UserRole } from '@/lib/types/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

type SupabaseUserRow = {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
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
        .select('id,email,name,role,companyId,authUserId,vesselMemberships:UserVesselMembership(vesselId)')
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
        const companySlug = 'demo-shipping';
        let companyId = 'company-demo';
        const { data: existingCompany, error: companyError } = await supabase
            .from('Company')
            .select('id')
            .eq('slug', companySlug)
            .maybeSingle();
        if (companyError) {
            console.error('Failed to fetch company', companyError);
            return null;
        }
        if (existingCompany?.id) {
            companyId = existingCompany.id;
        } else {
            const { error: insertCompanyError } = await supabase.from('Company').insert({
                id: companyId,
                name: 'デモ船会社',
                slug: companySlug,
            });
            if (insertCompanyError) {
                console.error('Failed to create company', insertCompanyError);
                return null;
            }
        }

        const vesselId = 'vessel-sakura';
        const { data: existingVessel, error: vesselError } = await supabase
            .from('Vessel')
            .select('id')
            .eq('id', vesselId)
            .maybeSingle();
        if (vesselError) {
            console.error('Failed to fetch vessel', vesselError);
            return null;
        }
        if (!existingVessel) {
            const { error: insertVesselError } = await supabase.from('Vessel').insert({
                id: vesselId,
                name: '桜丸',
                imoNumber: 'IMO1234567',
                companyId,
            });
            if (insertVesselError) {
                console.error('Failed to create vessel', insertVesselError);
                return null;
            }
        }

        const fallbackName =
            (authUser.user_metadata?.name as string | undefined) ||
            authUser.email.split('@')[0];

        const { data: created, error: createError } = await supabase
            .from('User')
            .insert({
                email: authUser.email,
                name: fallbackName,
                role: 'CHEF',
                companyId,
                authUserId: authUser.id,
            })
            .select('id,email,name,role,companyId')
            .single<SupabaseUserRow>();

        if (createError || !created) {
            console.error('Failed to create user', {
                message: createError?.message,
                details: createError?.details,
                hint: createError?.hint,
                code: createError?.code,
            });
            if (createError?.code === '23505') {
                const { data: existingUser, error: fetchUserError } = await supabase
                    .from('User')
                    .select('id,email,name,role,companyId')
                    .eq('email', authUser.email)
                    .maybeSingle<SupabaseUserRow>();
                if (fetchUserError || !existingUser) {
                    console.error('Failed to fetch existing user', fetchUserError);
                    return null;
                }
                return {
                    id: existingUser.id,
                    email: existingUser.email,
                    name: existingUser.name,
                    role: existingUser.role as UserRole,
                    companyId: existingUser.companyId,
                    vesselIds: [],
                };
            }
            return null;
        }

        const { error: membershipError } = await supabase.from('UserVesselMembership').insert({
            userId: created.id,
            vesselId,
        });
        if (membershipError) {
            console.error('Failed to create vessel membership', membershipError);
        }

        return {
            id: created.id,
            email: created.email,
            name: created.name,
            role: created.role as UserRole,
            companyId: created.companyId,
            vesselIds: [vesselId],
        };
    }

    if (!user.authUserId) {
        await supabase
            .from('User')
            .update({ authUserId: authUser.id })
            .eq('id', user.id);
    }

    const resolveVesselIds = async (
        targetUserId: string,
        memberships?: { vesselId: string }[] | null
    ) => {
        const ids = memberships?.map((m) => m.vesselId) ?? [];
        if (ids.length === 0) {
            const fallbackVesselId = 'vessel-sakura';
            const { error: membershipError } = await supabase.from('UserVesselMembership').insert({
                userId: targetUserId,
                vesselId: fallbackVesselId,
            });
            if (membershipError) {
                console.error('Failed to backfill vessel membership', membershipError);
            } else {
                ids.push(fallbackVesselId);
            }
        }
        return ids;
    };

    const vesselIds = await resolveVesselIds(user.id, user.vesselMemberships);

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
            const targetVesselIds = await resolveVesselIds(
                targetUser.id,
                targetUser.vesselMemberships
            );
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
    const normalizedEmail = user.email.toLowerCase();
    const allowRoleOverride =
        process.env.NODE_ENV !== 'production' && normalizedEmail === 'wataru.1998.0606@gmail.com';
    let resolvedRole = baseRole;
    if (allowRoleOverride) {
        const override = cookieStore.get('role_override')?.value;
        if (override === 'CHEF' || override === 'MANAGER') {
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
    switch (role) {
        case 'CHEF':
            return '/planning';
        case 'MANAGER':
            return '/manager/dashboard?scope=all&range=7d';
        default:
            return '/';
    }
}
