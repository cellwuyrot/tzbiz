import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { integrationStatus } from "@/lib/integration-status";
import { diagnosticResponse } from "@/lib/diagnostics";
export const runtime = "nodejs";
export async function GET() {
  try {
    const auth = await requireApiRole("ADMIN");
    if (auth.response) return auth.response;
    return NextResponse.json(await integrationStatus(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return diagnosticResponse("integrations.load", error);
  }
}
