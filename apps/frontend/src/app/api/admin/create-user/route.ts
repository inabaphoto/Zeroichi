import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const hdr = request.headers.get("x-admin-confirm");
    if (hdr !== "yes") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Missing confirmation." }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();

    const { data, error } = await admin.auth.admin.createUser({
      email: "info@photo-innovation.net",
      password: "ZeroichiAdmin2025!",
      email_confirm: true,
      user_metadata: {
        role: "admin",
        created_at: new Date().toISOString()
      }
    });

    if (error) {
      return NextResponse.json({
        code: "CREATE_FAILED",
        message: error.message,
        details: error
      }, { status: 500 });
    }

    return NextResponse.json({
      code: "USER_CREATED",
      userId: data.user?.id,
      email: data.user?.email
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}