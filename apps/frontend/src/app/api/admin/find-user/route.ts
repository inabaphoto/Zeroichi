import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const hdr = request.headers.get("x-admin-confirm");
    if (hdr !== "yes") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Missing confirmation." }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();
    const allUsers: any[] = [];
    let page = 1;

    // Try to get all users
    while (page <= 10) {
      try {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 200
        });

        if (error) {
          return NextResponse.json({
            code: "LIST_ERROR",
            message: error.message,
            page,
            details: error
          }, { status: 500 });
        }

        if (data?.users) {
          allUsers.push(...data.users);
        }

        if (!data?.users || data.users.length < 200) break;
        page++;
      } catch (e) {
        return NextResponse.json({
          code: "EXCEPTION",
          message: e instanceof Error ? e.message : String(e),
          page
        }, { status: 500 });
      }
    }

    // Find the target user
    const targetEmail = "info@photo-innovation.net";
    const targetUser = allUsers.find(u => u.email === targetEmail);

    return NextResponse.json({
      code: "OK",
      totalUsers: allUsers.length,
      users: allUsers.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at
      })),
      targetUserFound: !!targetUser,
      targetUser: targetUser ? {
        id: targetUser.id,
        email: targetUser.email,
        created_at: targetUser.created_at
      } : null
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}