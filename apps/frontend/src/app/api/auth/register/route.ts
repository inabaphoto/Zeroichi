import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Registration API is not implemented yet." },
    { status: 501 }
  );
}

