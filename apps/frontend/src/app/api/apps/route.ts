import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { encryptString } from "@/lib/crypto";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

type PostBody = {
  name?: string;
  type?: string; // "A" | "B" | "hybrid" | etc
  difyApiKey?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const ctx = await requireTenantContext(request);
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as PostBody | null;
    const name = body?.name;
    const appType = body?.type ?? null;
    const metadata = body?.metadata ?? null;
    if (!isNonEmptyString(name)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Field 'name' is required." }, { status: 422 });
    }
    const admin = getSupabaseAdminClient();

    let dify_api_key_encrypted: string | null = null;
    if (isNonEmptyString(body?.difyApiKey)) {
      try {
        dify_api_key_encrypted = encryptString(body!.difyApiKey!);
      } catch (e) {
        await notifyError("Encryption failed for difyApiKey", { tenantId: ctx.tenantId, actorId: ctx.userId });
        return NextResponse.json({ code: "ENCRYPTION_FAILED", message: "Failed to encrypt dify_api_key" }, { status: 500 });
      }
    }

    const { data, error } = await admin
      .from("apps")
      .insert({ tenant_id: ctx.tenantId, name: name.trim(), type: appType, dify_api_key_encrypted, metadata, created_by: ctx.userId })
      .select("id, name, type, archived_at")
      .single();
    if (error || !data) {
      await logAudit({ scope: "app", action: "create", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "APP_CREATE_FAILED", message: error?.message });
      await notifyError("App create failed", { tenantId: ctx.tenantId, actorId: ctx.userId, error: error?.message });
      return NextResponse.json({ code: "APP_CREATE_FAILED", message: error?.message ?? "Failed to create app" }, { status: 500 });
    }

    await logAudit({ scope: "app", action: "create", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, userId: ctx.userId });
    return NextResponse.json({ code: "APP_CREATED", app: { ...data, has_key: !!dify_api_key_encrypted } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in POST /api/apps", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

