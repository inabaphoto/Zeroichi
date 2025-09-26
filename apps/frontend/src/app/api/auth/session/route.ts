import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant-context";

export async function GET(request: Request) {
  try {
    const context = await requireTenantContext(request);
    return NextResponse.json({ code: "SESSION_OK", message: "Session verified.", session: context });
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ code: "FORBIDDEN", message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

