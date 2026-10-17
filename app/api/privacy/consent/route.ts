import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyCsrf, jsonError } from "@/lib/security";
import { consentPolicy } from "@/lib/analytics-consent";
import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  readConsent,
  privacySignal,
} from "@/lib/privacy";
export async function GET(r: NextRequest) {
  const state = readConsent(r.cookies.get(CONSENT_COOKIE)?.value);
  const policy = await consentPolicy().catch(() => null);
  const current = !state.analytics || (!!policy && state.policy === policy);
  return NextResponse.json(
    {
      chosen: state.chosen && current,
      analytics: state.analytics && current && !privacySignal(r.headers),
      analyticsReady: !!policy,
      version: CONSENT_VERSION,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(r: NextRequest) {
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const origin = r.headers.get("origin");
  if (
    origin &&
    origin !== new URL(r.url).origin &&
    origin !== process.env.NEXT_PUBLIC_APP_URL
  )
    return jsonError("Недопустимый источник запроса.", 403);
  const p = z
    .object({ analytics: z.boolean() })
    .safeParse(await r.json().catch(() => null));
  if (!p.success) return jsonError("Выберите режим cookie.", 400);
  let analytics = p.data.analytics && !privacySignal(r.headers);
  const policy = analytics ? await consentPolicy().catch(() => null) : null;
  if (analytics && !policy)
    return jsonError(
      "Аналитика недоступна: владелец ещё не опубликовал политику данных и cookie.",
      503,
    );
  analytics = analytics && !!policy;
  const response = NextResponse.json(
    {
      chosen: true,
      analytics,
      analyticsReady: !!policy,
      version: CONSENT_VERSION,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  response.cookies.set(
    CONSENT_COOKIE,
    analytics ? `${CONSENT_VERSION}:yes:${policy}` : `${CONSENT_VERSION}:no`,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 180 * 86400,
    },
  );
  return response;
}
