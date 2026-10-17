import { NextResponse } from "next/server";
import { legalState } from "@/lib/legal-store";
import { diagnosticResponse } from "@/lib/diagnostics";
export async function GET() {
  try {
    return NextResponse.json(await legalState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return diagnosticResponse("documents.public", e);
  }
}
