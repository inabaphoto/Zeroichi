import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const hdr = request.headers.get("x-admin-confirm");
    if (hdr !== "yes") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Missing confirmation." }, { status: 403 });
    }

    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      return NextResponse.json({
        code: "MISSING_ENV",
        hasUrl: !!url,
        hasSRK: !!serviceRoleKey
      }, { status: 500 });
    }

    const supabase = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'auth'
      }
    });

    // Test 1: Direct database query to auth.users table
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .limit(10);

    // Test 2: Try auth admin API
    let authTest = null;
    let authError = null;
    try {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 10
      });
      authTest = data;
      authError = error;
    } catch (e) {
      authError = e;
    }

    return NextResponse.json({
      code: "OK",
      dbQuery: {
        success: !dbError,
        userCount: dbUsers?.length ?? 0,
        users: dbUsers,
        error: dbError?.message ?? null
      },
      authApi: {
        success: !authError,
        userCount: authTest?.users?.length ?? 0,
        error: authError instanceof Error ? authError.message : authError?.message ?? null
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}