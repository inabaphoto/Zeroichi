import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { isNonEmptyString, isValidRole } from "@/lib/validation";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

type PostBody = {
  email?: string;
  role?: "owner" | "admin" | "member" | "viewer";
};

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
    const email = body?.email;
    const role = body?.role ?? "member";
    if (!isNonEmptyString(email)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Field 'email' is required." }, { status: 422 });
    }
    if (!isValidRole(role)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Invalid role." }, { status: 422 });
    }

    const admin = getSupabaseAdminClient();
    const redirectTo = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` : undefined;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim(), { data: { tenant_id: ctx.tenantId, role }, redirectTo });
    if (error) {
      await logAudit({ scope: "invite", action: "send", status: "error", tenantId: ctx.tenantId, actorId: ctx.userId, code: "INVITE_FAILED", message: error.message, meta: { email } });
      await notifyError("Invite failed", { tenantId: ctx.tenantId, actorId: ctx.userId, email, error: error.message });
      return NextResponse.json({ code: "INVITE_FAILED", message: error.message }, { status: 500 });
    }

    await logAudit({ scope: "invite", action: "send", status: "success", tenantId: ctx.tenantId, actorId: ctx.userId, meta: { email } });
    return NextResponse.json({ code: "INVITED", invitation: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ code: "FORBIDDEN", message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in invite route", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
