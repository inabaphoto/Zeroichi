import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { encryptString } from "@/lib/crypto";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

type PostBody = {
  key?: string;
  value?: string;
  disabled?: boolean;
};

async function ensureAppBelongsToTenant(appId: string, tenantId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("apps").select("id").eq("id", appId).eq("tenant_id", tenantId).maybeSingle();
  return !!data;
}

export async function GET(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (!(await ensureAppBelongsToTenant(params.appId, ctx.tenantId))) {
      return NextResponse.json({ code: "NOT_FOUND", message: "App not found in tenant." }, { status: 404 });
    }
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("app_env_vars")
      .select("key, value_encrypted, disabled, updated_at, created_at")
      .eq("app_id", params.appId)
      .order("key", { ascending: true });
    if (error) {
      await logAudit({ scope: "app_env", action: "list", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "ENV_LIST_FAILED", message: error.message, meta: { appId: params.appId } });
      await notifyError("Env list failed", { tenantId: ctx.tenantId, appId: params.appId, error: error.message });
      return NextResponse.json({ code: "ENV_LIST_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "app_env", action: "list", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { appId: params.appId } });
    const vars = (data ?? []).map((v) => ({ key: v.key, has_value: !!v.value_encrypted, disabled: !!v.disabled, updated_at: v.updated_at, created_at: v.created_at }));
    return NextResponse.json({ code: "OK", vars });
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in GET /api/apps/:id/env-vars", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (!(await ensureAppBelongsToTenant(params.appId, ctx.tenantId))) {
      return NextResponse.json({ code: "NOT_FOUND", message: "App not found in tenant." }, { status: 404 });
    }
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as PostBody | null;
    const key = body?.key;
    const value = body?.value;
    const disabled = !!body?.disabled;
    if (!isNonEmptyString(key)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Field 'key' is required." }, { status: 422 });
    }
    if (!isNonEmptyString(value)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Field 'value' is required." }, { status: 422 });
    }
    let enc: string;
    try {
      enc = encryptString(value!);
    } catch (_e) {
      await notifyError("Env value encryption failed", { appId: params.appId, key });
      return NextResponse.json({ code: "ENCRYPTION_FAILED", message: "Failed to encrypt value" }, { status: 500 });
    }
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("app_env_vars")
      .insert({ app_id: params.appId, key: key!.trim(), value_encrypted: enc, disabled, updated_by: ctx.userId, created_by: ctx.userId })
      .select("key")
      .single();
    if (error) {
      await logAudit({ scope: "app_env", action: "set", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "ENV_SET_FAILED", message: error.message, meta: { appId: params.appId, key } });
      await notifyError("Env set failed", { tenantId: ctx.tenantId, appId: params.appId, key, error: error.message });
      return NextResponse.json({ code: "ENV_SET_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "app_env", action: "set", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { appId: params.appId, key } });
    return NextResponse.json({ code: "ENV_SET" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in POST /api/apps/:id/env-vars", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
