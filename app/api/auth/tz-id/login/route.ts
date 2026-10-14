import { NextRequest, NextResponse } from "next/server";
import { beginTzLogin } from "@/lib/tz-id/flow";
import { tzIdConfigSnapshot } from "@/lib/tz-id/config";
import { allowTzLoginStart } from "@/lib/tz-id/limit";
import { jsonError } from "@/lib/security";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!tzIdConfigSnapshot().configured) return jsonError("Вход через TZ ID пока не настроен владельцем Business.", 503);
  if (!allowTzLoginStart(request)) return jsonError("Слишком много попыток входа. Повторите позже.", 429);
  try { return NextResponse.redirect(await beginTzLogin()); }
  catch { return jsonError("Не удалось начать вход через TZ ID. Повторите позже.", 503); }
}
