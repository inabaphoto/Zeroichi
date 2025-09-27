import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const hdr = request.headers.get("x-admin-confirm");
    if (hdr !== "yes") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Missing confirmation." }, { status: 403 });
    }
    const { email, userId, password } = (await request.json().catch(() => ({}))) as {
      email?: string;
      userId?: string;
      password?: string;
    };
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ code: "UNPROCESSABLE_ENTITY", message: "Invalid password." }, { status: 422 });
    }

    const admin = getSupabaseAdminClient();
    let targetId: string | null = null;

    if (userId) {
      // Prefer explicit userId path; verify it points to the allowed email
      const { data: got, error: getErr } = await admin.auth.admin.getUserById(userId);
      if (getErr || !got?.user) {
        return NextResponse.json({ code: "NOT_FOUND", message: getErr?.message ?? "User not found" }, { status: 404 });
      }
      if (got.user.email !== "info@photo-innovation.net") {
        return NextResponse.json({ code: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
      }
      targetId = got.user.id;
    } else {
      if (email !== "info@photo-innovation.net") {
        return NextResponse.json({ code: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
      }
      // Fallback: list and find by email
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
        // If not found, avoid blind creation; return NOT_FOUND for safety
        return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
      }
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
