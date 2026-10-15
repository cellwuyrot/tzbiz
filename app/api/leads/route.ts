import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadRequestSchema } from "@/lib/validation";
import { AGREEMENT_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { jsonError } from "@/lib/security";
import { consumeRate, requestIp } from "@/lib/rate-limit";
export const runtime = "nodejs";
function sameOrigin(r: NextRequest) {
  const o = r.headers.get("origin");
  if (!o) return true;
  const host = r.headers.get("host");
  return [
    new URL(r.url).origin,
    host ? `${new URL(r.url).protocol}//${host}` : null,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .filter(Boolean)
    .some((v) => new URL(String(v)).origin === o);
}
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return jsonError("Недопустимый источник запроса.", 403);
  const p = leadRequestSchema.safeParse(await r.json().catch(() => null));
  if (!p.success) return jsonError("Проверьте заполненные поля формы.", 400);
  const rawKey = r.headers.get("idempotency-key");
  if (rawKey && !/^[0-9a-f-]{36}$/i.test(rawKey))
    return jsonError("Неверный ключ отправки.", 400);
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(p.data))
    .digest("hex");
  async function duplicate() {
    if (!rawKey) return null;
    const old = await prisma.leadRequest.findUnique({
      where: { submissionKey: rawKey },
      select: { id: true, requestHash: true, createdAt: true },
    });
    if (!old) return null;
    if (old.requestHash !== hash)
      return jsonError("Ключ уже использован. Обновите форму.", 409);
    return NextResponse.json(
      { ok: true, id: old.id, emailNotified: false, queued: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const old = await duplicate();
    if (old) return old;
    const limit = await consumeRate("leads", requestIp(r), 4, 900_000);
    if (!limit.allowed)
      return jsonError("Слишком много заявок. Попробуйте позже.", 429, {
        "Retry-After": String(limit.retryAfter),
      });
    const service = await prisma.service.findFirst({
      where: { slug: p.data.serviceSlug, isPublished: true },
      select: { id: true, slug: true, title: true },
    });
    if (!service) return jsonError("Выбранная услуга недоступна.", 400);
    const now = new Date();
    const lead = await prisma.leadRequest.create({
      data: {
        name: p.data.name,
        email: p.data.email,
        phone: p.data.phone,
        company: p.data.company,
        serviceId: service.id,
        serviceTitle: service.title,
        message: p.data.message,
        privacyConsentAt: now,
        agreementAcceptedAt: now,
        agreementVersion: AGREEMENT_VERSION,
        privacyVersion: PRIVACY_VERSION,
        submissionKey: rawKey,
        requestHash: hash,
        clientEmailStatus: "PENDING",
        internalEmailStatus: "PENDING",
        clientEmailAttempts: 0,
        internalEmailAttempts: 0,
        jobs: { create: [{ channel: "client" }, { channel: "internal" }] },
      },
      select: { id: true },
    });
    return NextResponse.json(
      { ok: true, id: lead.id, emailNotified: false, queued: true },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    const old = await duplicate().catch(() => null);
    if (old) return old;
    console.error("Lead persistence failed");
    return jsonError("Не удалось сохранить заявку. Повторите отправку.", 503);
  }
}
