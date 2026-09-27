import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadRequestSchema } from "@/lib/validation";
import { sendLeadNotification } from "@/lib/mailer";
import { jsonError } from "@/lib/security";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 4;

function keyForRequest(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

function rateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set([new URL(request.url).origin, process.env.NEXT_PUBLIC_APP_URL].filter(Boolean).map((value) => new URL(String(value)).origin));
  return allowed.has(origin);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Недопустимый источник запроса.", 403);
  if (rateLimited(keyForRequest(request))) return jsonError("Слишком много заявок. Попробуйте ещё раз позже.", 429);

  const body = await request.json().catch(() => null);
  const parsed = leadRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Проверьте заполненные поля формы.", 400);
  if (parsed.data.website) return jsonError("Заявка отклонена.", 400);

  const service = await prisma.service.findFirst({
    where: { slug: parsed.data.serviceSlug, isPublished: true },
    select: { id: true, slug: true, title: true },
  });
  if (!service) return jsonError("Выбранная услуга недоступна.", 400);

  const lead = await prisma.leadRequest.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      serviceId: service.id,
      serviceTitle: service.title,
      message: parsed.data.message,
      privacyConsentAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      serviceTitle: true,
      message: true,
      createdAt: true,
    },
  });

  let emailNotified = true;
  try {
    await sendLeadNotification({ ...lead, serviceSlug: service.slug });
  } catch (error) {
    emailNotified = false;
    console.error("Lead email notification failed", error);
  }

  return NextResponse.json({ ok: true, emailNotified }, { status: 201 });
}
