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
    const { data: userRow, error: findErr } = await admin
      .schema("auth")
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();
    if (findErr || !userRow) {
      return NextResponse.json({ code: "NOT_FOUND", message: findErr?.message ?? "User not found" }, { status: 404 });
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(userRow.id, { password });
    if (updErr) {
      return NextResponse.json({ code: "UPDATE_FAILED", message: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ code: "PASSWORD_RESET_OK" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

