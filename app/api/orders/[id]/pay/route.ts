import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyCsrf, jsonError } from "@/lib/security";
import { consumeRate } from "@/lib/rate-limit";
import { bankConfig, bankRequest, checkoutAvailable, receiptFor, safePaymentUrl } from "@/lib/billing/tbank";
export const runtime = "nodejs";
export async function POST(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Войдите через TZ ID.", 401);
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  const order = await prisma.businessOrder.findFirst({ where: { id, userId: user.id } });
  if (!order) return jsonError("Заказ не найден.", 404);
  if (!["AWAITING_INVOICE", "AWAITING_PAYMENT", "INTEGRATION_PENDING", "REQUESTED", "IN_REVIEW"].includes(order.status) || !checkoutAvailable(order.settlementMode, order.amountMinor, order.currency)) return jsonError("Для этого заказа онлайн-оплата недоступна.", 409);
  const rate = await consumeRate("checkout-user", user.id, 20, 900_000);
  if (!rate.allowed) return jsonError("Слишком много запросов. Попробуйте позже.", 429);
  // Never offer card checkout on top of a separately issued/manual invoice.
  if (await prisma.invoice.count({ where: { orderId: id, status: { notIn: ["CANCELLED", "EXPIRED"] } } })) return jsonError("Для заказа уже выставлен счёт. Оплатите его в разделе «Счета».", 409);
  const existing = await prisma.bankPayment.findUnique({ where: { activeKey: id } });
  if (existing) {
    if (existing.paymentUrl && ["NEW", "FORM_SHOWED"].includes(existing.status)) return NextResponse.json({ paymentUrl: existing.paymentUrl });
    return jsonError(existing.status === "CONFIRMED" ? "Заказ уже оплачен." : "Платёж уже создан. Проверьте статус в кабинете; повторного списания не будет.", 409);
  }
  let config, receipt;
  try {
    config = bankConfig();
    const settings = await prisma.commerceSettings.findUnique({ where: { id: "commerce" } });
    if (!settings?.approved) return jsonError("Продавец ещё не утвердил условия оплаты.", 503);
    const snapshot = JSON.parse(order.snapshot);
    receipt = config.receiptMode === "bank" ? receiptFor(order.title, order.amountMinor!, user.email, snapshot.plan?.productType || "SERVICE") : undefined;
  } catch (e) { return jsonError(e instanceof Error ? e.message : "Оплата не настроена.", 503); }
  let payment;
  try {
    payment = await prisma.$transaction(async tx => {
      const lock = await tx.businessOrder.updateMany({ where: { id, updatedAt: order.updatedAt }, data: { updatedAt: new Date() } });
      if (!lock.count) throw Error("Order changed");
      if (await tx.invoice.count({ where: { orderId: id, status: { not: "CANCELLED" } } })) throw Error("Invoice exists");
      return tx.bankPayment.create({ data: { orderId: id, activeKey: id, terminalKey: config.terminal, amountMinor: order.amountMinor! } });
    });
  } catch { return jsonError("Платёж уже создаётся. Обновите статус заказа.", 409); }
  try {
    const result = await bankRequest("Init", {
      Amount: payment.amountMinor, OrderId: payment.id, Description: order.title.slice(0, 140), PayType: "O",
      NotificationURL: `${config.origin}/api/payments/tbank/notify`,
      SuccessURL: `${config.origin}/account?section=orders&payment=return`,
      FailURL: `${config.origin}/account?section=orders&payment=failed`,
      DATA: { OperationInitiatorType: "0" }, ...(receipt ? { Receipt: receipt } : {}),
    });
    if (result.Success === false && result.ErrorCode !== undefined && String(result.ErrorCode) !== "0") {
      await prisma.bankPayment.updateMany({ where: { id: payment.id, status: "CREATING" }, data: { status: "REJECTED", activeKey: null, revision: { increment: 1 } } });
      return jsonError("Банк не создал платёж. Обратитесь в поддержку или повторите позже.", 502);
    }
    if (result.Success !== true || String(result.ErrorCode) !== "0" || !/^\d{1,30}$/.test(String(result.PaymentId)) || result.OrderId !== payment.id || Number(result.Amount) !== payment.amountMinor || result.TerminalKey !== config.terminal) throw Error("Invalid bank response");
    const paymentUrl = safePaymentUrl(result.PaymentURL);
    await prisma.bankPayment.updateMany({ where: { id: payment.id, status: "CREATING", revision: 1 }, data: { paymentId: String(result.PaymentId), paymentUrl, status: "NEW", revision: { increment: 1 } } });
    return NextResponse.json({ paymentUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Unknown result may already be a real bank payment. Never clear activeKey here.
    return jsonError("Ответ банка не получен. Новый платёж не создаётся во избежание двойной оплаты. Проверьте статус позже или обратитесь в поддержку.", 502);
  }
}
