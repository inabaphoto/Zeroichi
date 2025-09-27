import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const hdr = request.headers.get("x-admin-confirm");
    if (hdr !== "yes") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Missing confirmation." }, { status: 403 });
    }
    const { email, password } = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    if (email !== "info@photo-innovation.net") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Invalid password." }, { status: 422 });
    }

    const admin = getSupabaseAdminClient();
    // list users via auth admin and locate by email
    let targetId: string | null = null;
    let page = 1;
    while (!targetId && page <= 10) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        return NextResponse.json({ code: "LIST_FAILED", message: error.message }, { status: 500 });
      }
      targetId = data.users.find((u: any) => u.email === email)?.id ?? null;
      if (data.users.length < 200) break;
      page += 1;
    }
    if (!targetId) {
      // create user if not exists
      const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr || !created?.user?.id) {
        return NextResponse.json({ code: "CREATE_FAILED", message: createErr?.message ?? "Failed to create user" }, { status: 500 });
      }
      targetId = created.user.id;
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(targetId, { password });
    if (updErr) {
      return NextResponse.json({ code: "UPDATE_FAILED", message: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ code: "PASSWORD_RESET_OK" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
