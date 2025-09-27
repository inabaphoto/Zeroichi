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
      return NextResponse.json({ code: "MISSING_ENV" }, { status: 500 });
    }

    const supabase = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test with the specific user ID from the dashboard
    const targetUserId = "9839eb6f-3d8b-42fe-9d5a-cc5c7dfd86a1";

    const results: any = {
      targetUserId,
      tests: []
    };

    // Test 1: Get user by ID
    try {
      const { data, error } = await supabase.auth.admin.getUserById(targetUserId);
      results.tests.push({
        test: "getUserById",
        success: !error && !!data?.user,
        userData: data?.user ? {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at
        } : null,
        error: error?.message ?? null
      });
    } catch (e) {
      results.tests.push({
        test: "getUserById",
        success: false,
        error: e instanceof Error ? e.message : String(e)
      });
    }

    // Test 2: Update user password
    try {
      const { data, error } = await supabase.auth.admin.updateUserById(targetUserId, {
        password: "TempPassword2025!@#"
      });
      results.tests.push({
        test: "updatePassword",
        success: !error,
        updated: !!data?.user,
        error: error?.message ?? null
      });
    } catch (e) {
      results.tests.push({
        test: "updatePassword",
        success: false,
        error: e instanceof Error ? e.message : String(e)
      });
    }

    // Test 3: List all users to check if our user appears
    try {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 100
      });
      const foundUser = data?.users?.find((u: any) => u.id === targetUserId);
      results.tests.push({
        test: "listUsersSearch",
        totalUsers: data?.users?.length ?? 0,
        targetFound: !!foundUser,
        targetEmail: foundUser?.email ?? null,
        error: error?.message ?? null
      });
    } catch (e) {
      results.tests.push({
        test: "listUsersSearch",
        success: false,
        error: e instanceof Error ? e.message : String(e)
      });
    }

    return NextResponse.json(results);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}