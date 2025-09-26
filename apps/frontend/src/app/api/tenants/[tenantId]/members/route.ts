import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { isNonEmptyString, isValidRole } from "@/lib/validation";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

type PostBody = {
  userId?: string;
  role?: "owner" | "admin" | "member" | "viewer";
};

export async function GET(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (ctx.tenantId !== params.tenantId) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Mismatched tenant context." }, { status: 403 });
    }
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("tenant_users")
      .select("user_id, role")
      .eq("tenant_id", ctx.tenantId);
    if (error) {
      await logAudit({ scope: "member", action: "list", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "LIST_FAILED", message: error.message });
      await notifyError("Member list failed", { tenantId: ctx.tenantId, actorId: ctx.userId, error: error.message });
      return NextResponse.json({ code: "LIST_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "member", action: "list", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId });
    return NextResponse.json({ code: "OK", members: data ?? [] });
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

export async function POST(request: Request, { params }: any) {
  try {
    const ctx = await requireTenantContext(request);
    if (ctx.tenantId !== params.tenantId) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Mismatched tenant context." }, { status: 403 });
    }
    if (!["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody | null;
    const userId = body?.userId;
    const role = (body?.role ?? "member") as PostBody["role"];
    if (!isNonEmptyString(userId)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Field 'userId' is required." }, { status: 422 });
    }
    if (!isValidRole(role)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Invalid role." }, { status: 422 });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("tenant_users")
      .insert({ tenant_id: ctx.tenantId, user_id: userId.trim(), role })
      .select("user_id, role")
      .single();
    if (error) {
      await logAudit({ scope: "member", action: "add", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "ADD_MEMBER_FAILED", message: error.message, meta: { targetUserId: userId } });
      await notifyError("Add member failed", { tenantId: ctx.tenantId, actorId: ctx.userId, targetUserId: userId, error: error.message });
      return NextResponse.json({ code: "ADD_MEMBER_FAILED", message: error.message }, { status: 500 });
    }
    await logAudit({ scope: "member", action: "add", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, userId: userId });
    return NextResponse.json({ code: "MEMBER_ADDED", member: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ code: "FORBIDDEN", message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in members POST", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
