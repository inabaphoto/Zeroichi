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

    const diagnostics: any = {
      envCheck: {
        hasUrl: !!url,
        urlValue: url ? url.substring(0, 30) + "..." : null,
        hasSRK: !!serviceRoleKey,
        srkLength: serviceRoleKey?.length ?? 0,
        srkPrefix: serviceRoleKey ? serviceRoleKey.substring(0, 50) + "..." : null,
      },
      tests: []
    };

    if (!url || !serviceRoleKey) {
      diagnostics.error = "Missing environment variables";
      return NextResponse.json(diagnostics);
    }

    try {
      const testClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      diagnostics.tests.push({ test: "client_creation", status: "ok" });

      const targetUserId = "9839eb6f-3d8b-42fe-9d5a-cc5c7dfd86a1";

      try {
        const { data, error } = await testClient.auth.admin.getUserById(targetUserId);
        if (error) {
          diagnostics.tests.push({
            test: "getUserById",
            status: "failed",
            error: error.message,
            errorCode: error.code ?? "unknown",
            errorStatus: error.status ?? "unknown"
          });
        } else {
          diagnostics.tests.push({
            test: "getUserById",
            status: "ok",
            userData: {
              id: data?.user?.id,
              email: data?.user?.email
            }
          });
        }
      } catch (e) {
        diagnostics.tests.push({
          test: "getUserById",
          status: "exception",
          error: e instanceof Error ? e.message : String(e),
          errorStack: e instanceof Error ? e.stack : undefined
        });
      }

      try {
        const { data, error } = await testClient.auth.admin.listUsers({ page: 1, perPage: 5 });
        if (error) {
          diagnostics.tests.push({
            test: "listUsers",
            status: "failed",
            error: error.message
          });
        } else {
          diagnostics.tests.push({
            test: "listUsers",
            status: "ok",
            userCount: data?.users?.length ?? 0
          });
        }
      } catch (e) {
        diagnostics.tests.push({
          test: "listUsers",
          status: "exception",
          error: e instanceof Error ? e.message : String(e)
        });
      }

    } catch (e) {
      diagnostics.clientError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json(diagnostics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}