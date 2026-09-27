import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { jsonError, verifyCsrf } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  await destroySession();
  return NextResponse.json({ ok: true });
}
