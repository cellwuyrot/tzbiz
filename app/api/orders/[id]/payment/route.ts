import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { consumeRate } from "@/lib/rate-limit";
import { bankRequest } from "@/lib/billing/tbank";
import { applyBankState } from "@/lib/billing/payment-state";
export async function POST(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Войдите через TZ ID.", 401);
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  const order = await prisma.businessOrder.findFirst({ where: { id, userId: user.id } });
  if (!order) return jsonError("Заказ не найден.", 404);
  if (!(await consumeRate("payment-state", user.id, 30, 60_000)).allowed) return jsonError("Подождите минуту перед следующей проверкой.", 429);
  const payment = await prisma.bankPayment.findFirst({ where: { orderId: id }, orderBy: { createdAt: "desc" } });
  if (!payment) return NextResponse.json({ status: "NOT_CREATED" });
  if (!payment.paymentId) return NextResponse.json({ status: payment.status });
  try {
    const result = await bankRequest("GetState", { PaymentId: payment.paymentId });
    if (result.Success !== true) return jsonError("Банк пока не подтвердил статус. Повторите позже.", 502);
    await applyBankState(result);
    const current = await prisma.bankPayment.findUnique({ where: { id: payment.id } });
    return NextResponse.json({ status: current?.status }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Не удалось проверить статус в банке. Повторите позже.", 502); }
}
