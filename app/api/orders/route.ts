import { consumeRate } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyCsrf, jsonError } from "@/lib/security";
import { orderInput, orderHash } from "@/lib/billing/order";
import { AGREEMENT_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { publicPlan } from "@/lib/billing/plan";
export async function POST(r: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Войдите в аккаунт и повторите отправку.", 401);
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const p = orderInput.safeParse(await r.json().catch(() => null));
  if (!p.success) return jsonError("Проверьте сообщение и согласия.", 400);
  const hash = orderHash(p.data);
  try {
    const rate = await consumeRate("order-user", user.id, 20, 900_000);
    if (!rate.allowed)
      return jsonError("Слишком много заявок. Повторите позже.", 429);
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.businessOrder.findUnique({
        where: {
          userId_requestKey: { userId: user.id, requestKey: p.data.requestKey },
        },
      });
      if (existing)
        return existing.requestHash === hash
          ? { order: existing, reused: true }
          : { conflict: true };
      const plan = await tx.billingPlan.findUnique({
        where: { id: p.data.planId },
        include: {
          service: { select: { isPublished: true, title: true, slug: true } },
        },
      });
      if (
        !plan ||
        !plan.isPublished ||
        plan.isArchived ||
        (plan.kind === "SERVICE" && !plan.service?.isPublished)
      )
        return { missing: true };
      if (plan.revision !== p.data.revision) return { stale: true };
      const terms = await tx.commerceSettings.findUnique({
        where: { id: "commerce" },
      });
      if (!terms?.approved) return { notReady: true };
      const identity = await tx.tzIdentityLink.findUnique({
        where: { userId: user.id },
      });
      const snapshot = JSON.stringify({
        plan: publicPlan(plan),
        externalProductId: plan.externalProductId,
        identity: identity
          ? { issuer: identity.issuer, subject: identity.subject }
          : null,
        terms,
        agreementVersion: AGREEMENT_VERSION,
        privacyVersion: PRIVACY_VERSION,
        notice:
          "Заявка не подтверждает оплату, доступ или подписку. Требуется согласование.",
      });
      const order = await tx.businessOrder.create({
        data: {
          userId: user.id,
          planId: plan.id,
          requestKey: p.data.requestKey,
          requestHash: hash,
          title: plan.title,
          settlementMode: plan.settlementMode,
          amountMinor: plan.amountMinor,
          currency: plan.currency,
          planRevision: plan.revision,
          snapshot,
          message: p.data.message,
          acceptedAt: new Date(),
          status:
            plan.settlementMode === "SUBSCRIPTION"
              ? "INTEGRATION_PENDING"
              : plan.settlementMode === "PREPAYMENT"
                ? "AWAITING_INVOICE"
                : "REQUESTED",
        },
      });
      return { order, reused: false };
    });
    if (result.conflict)
      return jsonError(
        "Ключ повторной отправки уже использован с другими данными.",
        409,
      );
    if (result.missing) return jsonError("Предложение недоступно.", 404);
    if (result.stale)
      return jsonError(
        "Условия тарифа изменились. Обновите страницу перед отправкой.",
        409,
      );
    if (result.notReady)
      return jsonError(
        "Владелец ещё не утвердил условия оформления. Свяжитесь с командой.",
        503,
      );
    return NextResponse.json(
      {
        id: result.order!.id,
        status: result.order!.status,
        paymentConfirmed: false,
      },
      {
        status: result.reused ? 200 : 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    // Concurrent identical submit may hit the unique key after the initial lookup.
    const existing = await prisma.businessOrder
      .findUnique({
        where: {
          userId_requestKey: { userId: user.id, requestKey: p.data.requestKey },
        },
      })
      .catch(() => null);
    if (existing && existing.requestHash === hash)
      return NextResponse.json(
        { id: existing.id, status: existing.status, paymentConfirmed: false },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    return jsonError(
      "Не удалось сохранить. Повторите отправку: тот же ключ не создаст дубликат.",
      503,
    );
  }
}
