import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { integrationStatus } from "@/lib/integration-status";
import { jsonError } from "@/lib/security";
export const runtime = "nodejs";
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  try { return NextResponse.json(await integrationStatus(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return jsonError("Не удалось получить состояние интеграций.", 500); }
}
