import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditStatus = "success" | "error";

export interface AuditEvent {
  scope: string; // e.g., "tenant", "member", "invite"
  action: string; // e.g., "create", "list", "add", "update_role", "delete", "invite", "accept"
  status: AuditStatus;
  tenantId?: string;
  userId?: string;
  actorId?: string; // requester user id
  code?: string;
  message?: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    await admin.from("audit_log").insert({
      scope: event.scope,
      action: event.action,
      status: event.status,
      tenant_id: event.tenantId ?? null,
      user_id: event.userId ?? null,
      actor_id: event.actorId ?? null,
      code: event.code ?? null,
      message: event.message ?? null,
      request_id: event.requestId ?? null,
      meta: event.meta ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // If audit table not ready or any error occurs, do not fail request.
    // eslint-disable-next-line no-console
    console.warn("audit_log insert failed:", e);
  }
}

