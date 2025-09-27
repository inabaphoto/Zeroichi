import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function extractProjectRef(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Expect host like: <ref>.supabase.co
    const host = u.host; // e.g., ypwegshakepxgpiqsbhx.supabase.co
    const parts = host.split(".");
    if (parts.length >= 3 && parts[1] === "supabase" && parts[2] === "co") {
      return parts[0];
    }
    // If full URL not provided, maybe env contains origin-like string (rare). Fallback parsing.
    const m = url.match(/^https?:\/\/([^.]+)\.supabase\.co/);
    return m ? m[1] : null;
  } catch {
    const m = url.match(/^https?:\/\/([^.]+)\.supabase\.co/);
    return m ? m[1] : null;
  }
}

export async function GET(request: Request) {
  try {
    const hdr = request.headers.get("x-admin-confirm");
    if (hdr !== "yes") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Missing confirmation." }, { status: 403 });
    }

    const serverUrl = process.env.SUPABASE_URL ?? null;
    const clientUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
    const serverRef = extractProjectRef(serverUrl);
    const clientRef = extractProjectRef(clientUrl);

    let adminUserLookupOk = false;
    let adminError: string | undefined;
    try {
      const admin = getSupabaseAdminClient();
      // Target known user (provided by the owner). If this succeeds, SRK and URL are aligned.
      const targetUserId = request.headers.get("x-user-id") || "9839eb6f-3d8b-42fe-9d5a-cc5c7dfd86a1";
      const { data, error } = await admin.auth.admin.getUserById(targetUserId);
      if (error) throw error;
      adminUserLookupOk = !!data?.user?.id;
    } catch (e) {
      adminError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      code: "OK",
      server: { url: serverUrl ? "set" : null, projectRef: serverRef },
      client: { url: clientUrl ? "set" : null, projectRef: clientRef },
      adminUserLookupOk,
      adminError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

