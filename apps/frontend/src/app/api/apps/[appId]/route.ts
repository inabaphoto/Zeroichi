import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { encryptString } from "@/lib/crypto";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

type PatchBody = {
  name?: string;
  type?: string;
  difyApiKey?: string | null; // null to clear
  metadata?: Record<string, unknown>;
};

export async function PATCH(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as PatchBody | null;
    const updates: Record<string, unknown> = {};
    if (isNonEmptyString(body?.name)) updates.name = body!.name!.trim();
    if (isNonEmptyString(body?.type)) updates.type = body!.type!.trim();
    if (body && "metadata" in body) updates.metadata = body.metadata ?? null;
    if (body && "difyApiKey" in body) {
      if (body.difyApiKey === null) {
        updates.dify_api_key_encrypted = null;
      } else if (isNonEmptyString(body.difyApiKey)) {
        try {
          updates.dify_api_key_encrypted = encryptString(body.difyApiKey!);
        } catch (e) {
          await notifyError("Encryption failed for difyApiKey (update)", { tenantId: ctx.tenantId, actorId: ctx.userId, appId: params.appId });
          return NextResponse.json({ code: "ENCRYPTION_FAILED", message: "Failed to encrypt dify_api_key" }, { status: 500 });
        }
      }
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("apps")
      .update(updates)
      .eq("id", params.appId)
      .eq("tenant_id", ctx.tenantId)
      .select("id, name, type, archived_at")
      .single();
    if (error || !data) {
      await logAudit({ scope: "app", action: "update", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "APP_UPDATE_FAILED", message: error?.message, meta: { appId: params.appId } });
      await notifyError("App update failed", { tenantId: ctx.tenantId, actorId: ctx.userId, appId: params.appId, error: error?.message });
      return NextResponse.json({ code: "APP_UPDATE_FAILED", message: error?.message ?? "Failed to update app" }, { status: 500 });
    }
    await logAudit({ scope: "app", action: "update", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { appId: params.appId } });
    return NextResponse.json({ code: "APP_UPDATED", app: { ...data } });
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in PATCH /api/apps/:id", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "archive";
    const admin = getSupabaseAdminClient();

    if (mode === "archive") {
      const { error } = await admin
        .from("apps")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", params.appId)
        .eq("tenant_id", ctx.tenantId);
      if (error) {
        await logAudit({ scope: "app", action: "archive", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "APP_ARCHIVE_FAILED", message: error.message, meta: { appId: params.appId } });
        await notifyError("App archive failed", { tenantId: ctx.tenantId, actorId: ctx.userId, appId: params.appId, error: error.message });
        return NextResponse.json({ code: "APP_ARCHIVE_FAILED", message: error.message }, { status: 500 });
      }
      await logAudit({ scope: "app", action: "archive", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { appId: params.appId } });
      return NextResponse.json({ code: "APP_ARCHIVED" });
    }

    // hard delete
    const { error } = await admin
      .from("apps")
      .delete()
      .eq("id", params.appId)
      .eq("tenant_id", ctx.tenantId);
    if (error) {
      await logAudit({ scope: "app", action: "delete", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "APP_DELETE_FAILED", message: error.message, meta: { appId: params.appId } });
      await notifyError("App delete failed", { tenantId: ctx.tenantId, actorId: ctx.userId, appId: params.appId, error: error.message });
      return NextResponse.json({ code: "APP_DELETE_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "app", action: "delete", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { appId: params.appId } });
    return NextResponse.json({ code: "APP_DELETED" });
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in DELETE /api/apps/:id", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

