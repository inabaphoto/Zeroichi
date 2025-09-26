import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { encryptString } from "@/lib/crypto";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

type PatchBody = {
  value?: string | null; // null to clear
  disabled?: boolean;
};

async function ensureAppBelongsToTenant(appId: string, tenantId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("apps").select("id").eq("id", appId).eq("tenant_id", tenantId).maybeSingle();
  return !!data;
}

export async function PATCH(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (!(await ensureAppBelongsToTenant(params.appId, ctx.tenantId))) {
      return NextResponse.json({ code: "NOT_FOUND", message: "App not found in tenant." }, { status: 404 });
    }
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as PatchBody | null;
    const updates: Record<string, unknown> = { updated_by: ctx.userId };
    if (body && "disabled" in body) updates.disabled = !!body.disabled;
    if (body && "value" in body) {
      if (body.value === null) {
        updates.value_encrypted = null;
      } else if (isNonEmptyString(body.value)) {
        try {
          updates.value_encrypted = encryptString(body.value!);
        } catch (e) {
          await notifyError("Env value encryption failed (update)", { appId: params.appId, key: params.key });
          return NextResponse.json({ code: "ENCRYPTION_FAILED", message: "Failed to encrypt value" }, { status: 500 });
        }
      }
    }
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("app_env_vars")
      .update(updates)
      .eq("app_id", params.appId)
      .eq("key", params.key);
    if (error) {
      await logAudit({ scope: "app_env", action: "update", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "ENV_UPDATE_FAILED", message: error.message, meta: { appId: params.appId, key: params.key } });
      await notifyError("Env update failed", { tenantId: ctx.tenantId, appId: params.appId, key: params.key, error: error.message });
      return NextResponse.json({ code: "ENV_UPDATE_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "app_env", action: "update", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { appId: params.appId, key: params.key } });
    return NextResponse.json({ code: "ENV_UPDATED" });
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in PATCH /api/apps/:id/env-vars/:key", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (!(await ensureAppBelongsToTenant(params.appId, ctx.tenantId))) {
      return NextResponse.json({ code: "NOT_FOUND", message: "App not found in tenant." }, { status: 404 });
    }
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("app_env_vars")
      .delete()
      .eq("app_id", params.appId)
      .eq("key", params.key);
    if (error) {
      await logAudit({ scope: "app_env", action: "delete", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "ENV_DELETE_FAILED", message: error.message, meta: { appId: params.appId, key: params.key } });
      await notifyError("Env delete failed", { tenantId: ctx.tenantId, appId: params.appId, key: params.key, error: error.message });
      return NextResponse.json({ code: "ENV_DELETE_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "app_env", action: "delete", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { appId: params.appId, key: params.key } });
    return NextResponse.json({ code: "ENV_DELETED" });
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in DELETE /api/apps/:id/env-vars/:key", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

