import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";

type PostBody = {
  name?: string;
};

const AUTH_HEADER = "authorization";

async function requireAuthUser(request: Request) {
  const authHeader = request.headers.get(AUTH_HEADER);
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return { error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header." }, status: 401 } as const;
  }
  const [, accessToken] = authHeader.split(" ");
  if (!accessToken) {
    return { error: { code: "UNAUTHORIZED", message: "Missing access token." }, status: 401 } as const;
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) {
    return { error: { code: "UNAUTHORIZED", message: error?.message ?? "Failed to verify access token." }, status: 401 } as const;
  }
  return { user: data.user, accessToken } as const;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthUser(request);
    if ("error" in auth) {
      return NextResponse.json(auth.error, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody | null;
    const nameRaw = body?.name;
    if (!isNonEmptyString(nameRaw)) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Field 'name' is required." }, { status: 422 });
    }
    const name = nameRaw.trim();

    const admin = getSupabaseAdminClient();

    // 1) Create tenant
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({ name, created_by: auth.user.id })
      .select("id, name")
      .single();
    if (tenantError || !tenant) {
      await logAudit({ scope: "tenant", action: "create", status: "error", actorId: auth.user.id, code: "TENANT_CREATE_FAILED", message: tenantError?.message });
      await notifyError("Tenant creation failed", { userId: auth.user.id, error: tenantError?.message });
      return NextResponse.json({ code: "TENANT_CREATE_FAILED", message: tenantError?.message ?? "Failed to create tenant." }, { status: 500 });
    }

    // 2) Assign owner membership
    const { error: memberError } = await admin.from("tenant_users").insert({ tenant_id: tenant.id, user_id: auth.user.id, role: "owner" });
    if (memberError) {
      await logAudit({ scope: "member", action: "add", status: "error", tenantId: tenant.id, actorId: auth.user.id, code: "MEMBERSHIP_CREATE_FAILED", message: memberError.message });
      await notifyError("Owner membership creation failed", { tenantId: tenant.id, userId: auth.user.id, error: memberError.message });
      return NextResponse.json({ code: "MEMBERSHIP_CREATE_FAILED", message: memberError.message }, { status: 500 });
    }

    // 3) Patch user's tenant_id in metadata for quick context resolution
    try {
      await admin.auth.admin.updateUserById(auth.user.id, {
        user_metadata: { ...(auth.user.user_metadata ?? {}), tenant_id: tenant.id },
      });
    } catch (e) {
      // Non-fatal: continue even if metadata update fails
    }

    await logAudit({ scope: "tenant", action: "create", status: "success", tenantId: tenant.id, actorId: auth.user.id });
    return NextResponse.json({ code: "TENANT_CREATED", tenant }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    try { await notifyError("Unhandled error in POST /api/tenants", { message }); } catch {}
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
