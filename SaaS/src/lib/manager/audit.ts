import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type AuditAction =
  | 'user.invited'
  | 'user.role_changed'
  | 'user.status_changed'
  | 'user.vessels_changed'
  | 'vessel.created'
  | 'company.updated';

export async function logAuditEvent(params: {
  companyId: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: AuditAction;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from('AuditLog').insert({
      companyId: params.companyId,
      actorUserId: params.actorUserId ?? null,
      targetUserId: params.targetUserId ?? null,
      action: params.action,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    console.warn('audit log failed', error);
  }
}
