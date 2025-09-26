import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidRole } from "@/lib/validation";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

const AUTH_HEADER = "authorization";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get(AUTH_HEADER);
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing or invalid Authorization header." }, { status: 401 });
    }
    const [, accessToken] = authHeader.split(" ");
    if (!accessToken) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing access token." }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();
    const { data: userResult, error: getUserError } = await admin.auth.getUser(accessToken);
    if (getUserError || !userResult?.user) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: getUserError?.message ?? "Failed to verify access token." }, { status: 401 });
    }
    const user = userResult.user;
    const tenantId = (user.user_metadata?.tenant_id ?? user.app_metadata?.tenant_id) as string | undefined;
    if (!tenantId) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "No tenant_id in user metadata." }, { status: 422 });
    }
    const desiredRole = (user.user_metadata?.role ?? user.app_metadata?.role ?? "member") as string;
    const role = isValidRole(desiredRole) ? desiredRole : "member";

    // If already a member, return OK
    const { data: existing, error: existingError } = await admin
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existingError && existing) {
      await logAudit({ scope: "invite", action: "accept", status: "success", tenantId, userId: user.id, actorId: user.id, code: "ALREADY_MEMBER" });
      return NextResponse.json({ code: "ALREADY_MEMBER", message: "User already belongs to the tenant." });
    }

    const { error: insertError } = await admin
      .from("tenant_users")
      .insert({ tenant_id: tenantId, user_id: user.id, role });
    if (insertError) {
      await logAudit({ scope: "invite", action: "accept", status: "error", tenantId, userId: user.id, actorId: user.id, code: "ACCEPT_FAILED", message: insertError.message });
      await notifyError("Invitation accept failed", { tenantId, userId: user.id, error: insertError.message });
      return NextResponse.json({ code: "ACCEPT_FAILED", message: insertError.message }, { status: 500 });
    }

    await logAudit({ scope: "invite", action: "accept", status: "success", tenantId, userId: user.id, actorId: user.id, meta: { role } });
    return NextResponse.json({ code: "INVITATION_ACCEPTED", tenantId, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in accept invite", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
