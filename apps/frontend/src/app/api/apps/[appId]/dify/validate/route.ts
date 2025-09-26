import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptString } from "@/lib/crypto";
import { createDifyClient } from "@/lib/dify";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

async function ensureAppBelongsToTenant(appId: string, tenantId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("apps").select("id").eq("id", appId).eq("tenant_id", tenantId).maybeSingle();
  return !!data;
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

    const admin = getSupabaseAdminClient();
    const { data: vars, error: varsError } = await admin
      .from("app_env_vars")
      .select("key, value_encrypted")
      .eq("app_id", params.appId)
      .in("key", ["DIFY_API_KEY", "DIFY_BASE_URL"]);
    if (varsError) {
      await logAudit({ scope: "app_env", action: "validate_dify", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "ENV_FETCH_FAILED", message: varsError.message, meta: { appId: params.appId } });
      await notifyError("Fetch env for dify validate failed", { tenantId: ctx.tenantId, appId: params.appId, error: varsError.message });
      return NextResponse.json({ code: "ENV_FETCH_FAILED", message: varsError.message }, { status: 500 });
    }
    const map = new Map<string, string | null>(vars?.map((v) => [v.key, v.value_encrypted as string | null]) || []);
    const apiKeyEnc = map.get("DIFY_API_KEY");
    if (!apiKeyEnc) {
      return NextResponse.json({ code: "MISSING_DIFY_API_KEY", message: "DIFY_API_KEY is not set for this app." }, { status: 422 });
    }
    let apiKey: string;
    try {
      apiKey = decryptString(apiKeyEnc);
    } catch (e) {
      await notifyError("Decrypt DIFY_API_KEY failed", { appId: params.appId });
      return NextResponse.json({ code: "DECRYPT_FAILED", message: "Failed to decrypt DIFY_API_KEY" }, { status: 500 });
    }
    let baseUrl: string | undefined;
    const baseUrlEnc = map.get("DIFY_BASE_URL");
    if (baseUrlEnc) {
      try { baseUrl = decryptString(baseUrlEnc); } catch {}
    }

    // Minimal call to verify credentials and connectivity
    const client = createDifyClient(apiKey, baseUrl ? { baseUrl } : undefined);
    try {
      const result = await client.chatCompletions(
        { tenantId: ctx.tenantId, appId: params.appId, userId: ctx.userId },
        { query: "ping", response_mode: "blocking" }
      );
      await logAudit({ scope: "dify", action: "validate", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { appId: params.appId } });
      return NextResponse.json({ code: "VALIDATION_OK", received: true, sample_id: result.id ?? null });
    } catch (e: any) {
      const message = e?.message || String(e);
      const code = e?.code || e?.name || "VALIDATION_FAILED";
      await logAudit({ scope: "dify", action: "validate", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code, message, meta: { appId: params.appId } });
      await notifyError("Dify validation failed", { appId: params.appId, tenantId: ctx.tenantId, code, message });
      return NextResponse.json({ code: "VALIDATION_FAILED", message }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in POST /api/apps/:id/dify/validate", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

