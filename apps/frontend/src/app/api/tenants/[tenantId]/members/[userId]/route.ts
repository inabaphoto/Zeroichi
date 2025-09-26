import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { isValidRole } from "@/lib/validation";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

type PatchBody = {
  role?: "owner" | "admin" | "member" | "viewer";
};

export async function PATCH(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (ctx.tenantId !== params.tenantId) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Mismatched tenant context." }, { status: 403 });
    }
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as PatchBody | null;
    const role = body?.role;
    if (!role || !isValidRole(role)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Valid 'role' is required." }, { status: 422 });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("tenant_users")
      .update({ role })
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", params.userId)
      .select("user_id, role")
      .single();
    if (error) {
      await logAudit({ scope: "member", action: "update_role", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "ROLE_UPDATE_FAILED", message: error.message, meta: { targetUserId: params.userId, role } });
      await notifyError("Role update failed", { tenantId: ctx.tenantId, actorId: ctx.userId, targetUserId: params.userId, error: error.message });
      return NextResponse.json({ code: "ROLE_UPDATE_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "member", action: "update_role", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, userId: params.userId, meta: { role } });
    return NextResponse.json({ code: "ROLE_UPDATED", member: data });
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ code: "FORBIDDEN", message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (ctx.tenantId !== params.tenantId) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Mismatched tenant context." }, { status: 403 });
    }
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("tenant_users")
      .delete()
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", params.userId);
    if (error) {
      await logAudit({ scope: "member", action: "delete", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "MEMBER_DELETE_FAILED", message: error.message, meta: { targetUserId: params.userId } });
      await notifyError("Member delete failed", { tenantId: ctx.tenantId, actorId: ctx.userId, targetUserId: params.userId, error: error.message });
      return NextResponse.json({ code: "MEMBER_DELETE_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "member", action: "delete", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, userId: params.userId });
    return NextResponse.json({ code: "MEMBER_DELETED" });
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ code: "FORBIDDEN", message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in member routes", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
