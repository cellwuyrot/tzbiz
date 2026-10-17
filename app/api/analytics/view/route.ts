import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  analyticsPath,
  CONSENT_COOKIE,
  readConsent,
  privacySignal,
} from "@/lib/privacy";
import { consentPolicy } from "@/lib/analytics-consent";
import { consumeRate, requestIp } from "@/lib/rate-limit";
export async function POST(r: NextRequest) {
  const origin = r.headers.get("origin"),
    site = r.headers.get("sec-fetch-site");
  if (
    site === "cross-site" ||
    !origin ||
    (origin !== new URL(r.url).origin &&
      origin !== process.env.NEXT_PUBLIC_APP_URL)
  )
    return new NextResponse(null, { status: 403 });
  if (
    !readConsent(r.cookies.get(CONSENT_COOKIE)?.value).analytics ||
    privacySignal(r.headers)
  )
    return new NextResponse(null, { status: 204 });
  const path = analyticsPath((await r.json().catch(() => null))?.path);
  if (!path) return new NextResponse(null, { status: 400 });
  try {
    const choice = readConsent(r.cookies.get(CONSENT_COOKIE)?.value),
      policy = await consentPolicy();
    if (!policy || choice.policy !== policy)
      return new NextResponse(null, { status: 204 });
    const rate = await consumeRate("analytics", requestIp(r), 120, 60000);
    if (!rate.allowed) return new NextResponse(null, { status: 429 });
    if (path.startsWith("/plans/")) {
      const p = await prisma.billingPlan.findUnique({
        where: { id: path.split("/")[2] },
        include: { service: { select: { isPublished: true } } },
      });
      if (
        !p?.isPublished ||
        p.isArchived ||
        (p.kind === "SERVICE" && !p.service?.isPublished)
      )
        return new NextResponse(null, { status: 404 });
    }
    if (path.startsWith("/services/")) {
      const p = await prisma.service.findUnique({
        where: { slug: path.split("/")[2] },
        select: { isPublished: true },
      });
      if (!p?.isPublished) return new NextResponse(null, { status: 404 });
    }
    const day = new Date().toISOString().slice(0, 10);
    await prisma.pageViewDaily.upsert({
      where: { day_path: { day, path } },
      create: { day, path, views: 1 },
      update: { views: { increment: 1 } },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
