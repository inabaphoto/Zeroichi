import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const hdr = request.headers.get("x-admin-confirm");
    if (hdr !== "yes") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Missing confirmation." }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();

    // Create user in auth.users (Supabase Auth)
    const { data, error } = await admin.auth.signUp({
      email: "info@photo-innovation.net",
      password: "ZeroichiAdmin2025!@#",
      options: {
        data: {
          role: "admin",
          display_name: "Photo Innovation Admin"
        },
        emailRedirectTo: "https://zeroichi.vercel.app/tenant"
      }
    });

    if (error) {
      return NextResponse.json({
        code: "SIGNUP_FAILED",
        message: error.message,
        details: error
      }, { status: 500 });
    }

    return NextResponse.json({
      code: "USER_CREATED",
      userId: data.user?.id,
      email: data.user?.email,
      session: !!data.session
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}