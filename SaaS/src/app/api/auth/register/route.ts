import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RegisterPayload = {
  authUserId: string;
  email: string;
  companyName: string;
  contactName: string;
  companySize?: string | null;
  industry?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
};

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function ensureUniqueSlug(admin: ReturnType<typeof createSupabaseAdminClient>, name: string) {
  const base = slugify(name) || `company-${randomSuffix()}`;
  const { data: existing } = await admin
    .from('Company')
    .select('id')
    .eq('slug', base)
    .maybeSingle();
  if (!existing) return base;
  return `${base}-${randomSuffix()}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RegisterPayload;
    const authUserId = body.authUserId?.trim();
    const email = body.email?.trim();

    if (!authUserId || !email) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    let admin: ReturnType<typeof createSupabaseAdminClient>;
    try {
      admin = createSupabaseAdminClient();
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Supabase admin設定が不足しています' },
        { status: 500 },
      );
    }

    let authUser = await admin.auth.admin.getUserById(authUserId);
    if (authUser.error || !authUser.data?.user) {
      const fallback = await admin.auth.admin.getUserByEmail(email);
      if (!fallback.data?.user) {
        return NextResponse.json(
          {
            error: `認証情報が確認できません: ${authUser.error?.message || fallback.error?.message || 'User not found'}`,
          },
          { status: 400 },
        );
      }
      authUser = fallback;
    }

    if (authUser.data.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: '認証情報が一致しません（メールアドレス不一致）' },
        { status: 400 },
      );
    }

    const meta = (authUser.data.user.user_metadata ?? {}) as Record<string, any>;
    const companyName = body.companyName?.trim() || meta.companyName?.trim();
    const contactName = body.contactName?.trim() || meta.contactName?.trim();
    const companySize = body.companySize ?? meta.companySize ?? null;
    const industry = body.industry ?? meta.industry ?? null;
    const department = body.department ?? meta.department ?? null;
    const jobTitle = body.jobTitle ?? meta.jobTitle ?? null;
    const phone = body.phone ?? meta.phone ?? null;

    if (!companyName || !contactName) {
      return NextResponse.json(
        { error: '会社名/担当者名が不足しています（メール確認後に再ログインしてください）' },
        { status: 400 },
      );
    }

    const { data: existingUserByAuth } = await admin
      .from('User')
      .select('id, companyId, email, authUserId')
      .eq('authUserId', authUserId)
      .maybeSingle();
    if (existingUserByAuth) {
      return NextResponse.json({ ok: true, userId: existingUserByAuth.id });
    }

    const { data: existingUserByEmail } = await admin
      .from('User')
      .select('id, companyId, email, authUserId')
      .ilike('email', email)
      .maybeSingle();
    if (existingUserByEmail) {
      const { error: updateExistingError } = await admin
        .from('User')
        .update({
          authUserId,
          status: 'ACTIVE',
          lastLoginAt: new Date().toISOString(),
          disabledAt: null,
          name: meta.name || existingUserByEmail.email,
        })
        .eq('id', existingUserByEmail.id);
      if (updateExistingError) {
        return NextResponse.json(
          { error: updateExistingError.message || '既存ユーザーの更新に失敗しました' },
          { status: 500 },
        );
      }
      return NextResponse.json({
        ok: true,
        companyId: existingUserByEmail.companyId,
        userId: existingUserByEmail.id,
      });
    }

    const slug = await ensureUniqueSlug(admin, companyName);
    const { data: company, error: companyError } = await admin
      .from('Company')
      .insert({ name: companyName, slug })
      .select('id, name, slug')
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: companyError?.message || '会社情報の登録に失敗しました' },
        { status: 500 },
      );
    }

    const displayName = `${companyName}の${contactName}`;
    const { data: createdUser, error: userError } = await admin
      .from('User')
      .insert({
        email,
        name: displayName,
        role: 'MANAGER',
        status: 'ACTIVE',
        lastLoginAt: new Date().toISOString(),
        companyId: company.id,
        authUserId,
      })
      .select('id')
      .single();

    if (userError || !createdUser) {
      return NextResponse.json(
        { error: userError?.message || 'ユーザー情報の登録に失敗しました' },
        { status: 500 },
      );
    }

    try {
      await admin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          name: displayName,
          companyName,
          companySize,
          industry,
          department,
          jobTitle,
          phone,
        },
      });
    } catch {
      // Metadata update failure should not block registration.
    }

    return NextResponse.json({
      ok: true,
      companyId: company.id,
      userId: createdUser.id,
    });
  } catch (error) {
    console.error('register error', error);
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 });
  }
}
