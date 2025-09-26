import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

export async function GET(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (ctx.tenantId !== params.tenantId) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Mismatched tenant context." }, { status: 403 });
    }
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("apps")
      .select("id, name, type, archived_at, created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false });
    if (error) {
      await logAudit({ scope: "app", action: "list", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "APP_LIST_FAILED", message: error.message });
      await notifyError("App list failed", { tenantId: ctx.tenantId, actorId: ctx.userId, error: error.message });
      return NextResponse.json({ code: "APP_LIST_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "app", action: "list", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId });
    const apps = (data ?? []).map((a) => ({ ...a, has_key: undefined }));
    return NextResponse.json({ code: "OK", apps });
  } catch (error) {
    if (error instanceof Error && (error.name === "UnauthorizedError" || error.name === "ForbiddenError")) {
      const status = error.name === "UnauthorizedError" ? 401 : 403;
      return NextResponse.json({ code: error.name.toUpperCase(), message: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in GET /api/tenants/:id/apps", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

