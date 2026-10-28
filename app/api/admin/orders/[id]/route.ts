import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { verifyCsrf, jsonError } from "@/lib/security";
import { canTransition, ORDER_STATUS } from "@/lib/commerce";
export async function PATCH(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await requireApiRole("ADMIN");
  if (a.response) return a.response;
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  const p = z
    .object({
      status: z.string().refine((s) => s in ORDER_STATUS),
      updatedAt: z.string().datetime(),
    })
    .safeParse(await r.json().catch(() => null));
  if (!z.string().cuid().safeParse(id).success || !p.success)
    return jsonError("Проверьте данные.", 400);
  const order = await prisma.businessOrder.findUnique({ where: { id } });
  if (!order) return jsonError("Заявка не найдена.", 404);
  if (p.data.status === "CANCELLED" && await prisma.bankPayment.count({ where: { orderId: id, activeKey: id, status: { notIn: ["REFUNDED", "REVERSED", "CANCELED", "REJECTED", "DEADLINE_EXPIRED", "AUTH_FAIL"] } } })) return jsonError("Сначала отмените платёж или оформите возврат в Т-Банке и проверьте банковский статус. Иначе клиент может оплатить отменённый заказ.", 409);
  const paid =
    order.settlementMode === "PREPAYMENT"
      ? await prisma.invoice.aggregate({
          where: {
            orderId: order.id,
            userId: order.userId,
            status: "PAID",
            currency: order.currency,
          },
          _sum: { amountMinor: true },
        })
      : null;
  const bankPaid = await prisma.bankPayment.findFirst({ where: { orderId: id, status: "CONFIRMED", amountMinor: order.amountMinor ?? -1 } });
  const paymentConfirmed = Boolean(bankPaid) || Boolean(
    order.amountMinor !== null &&
    order.amountMinor > 0 &&
    (paid?._sum.amountMinor || 0) >= order.amountMinor,
  );
  if (
    !canTransition(
      order.settlementMode,
      order.status,
      p.data.status,
      paymentConfirmed,
    )
  )
    return jsonError(
      "Этот переход недоступен. Оплату и выдачу подписки нельзя подтвердить вручную этим статусом.",
      409,
    );
  const next = await prisma.businessOrder.updateMany({
    where: { id, updatedAt: new Date(p.data.updatedAt) },
    data: {
      status: p.data.status,
      history: JSON.stringify([
        ...(JSON.parse(order.history) as unknown[]),
        {
          from: order.status,
          to: p.data.status,
          actorId: a.user!.id,
          at: new Date().toISOString(),
        },
      ]),
    },
  });
  if (!next.count)
    return jsonError(
      "Заявка изменена другим администратором. Обновите список.",
      409,
    );
  return NextResponse.json({ ok: true });
}
