import { prisma } from "@/lib/db";
import { failedPaymentStatus, paymentTransition } from "./tbank";

// Shared by authenticated GetState and signed notifications. CAS makes duplicates harmless.
export async function applyBankState(data: Record<string, unknown>) {
  if (typeof data.OrderId !== "string" || typeof data.Status !== "string" || !["string", "number"].includes(typeof data.PaymentId)) throw Error("Invalid notification");
  const paymentId = String(data.PaymentId);
  if (!/^\d{1,30}$/.test(paymentId)) throw Error("Invalid payment ID");
  for (let attempt = 0; attempt < 3; attempt++) {
    const payment = await prisma.bankPayment.findUnique({ where: { id: data.OrderId } });
    if (!payment || data.TerminalKey !== payment.terminalKey || (payment.paymentId && payment.paymentId !== paymentId)) throw Error("Payment mismatch");
    const refund = ["REFUNDED", "PARTIAL_REFUNDED"].includes(data.Status);
    const amount = Number(data.Amount);
    if (!Number.isSafeInteger(amount) || (refund ? amount < 0 || amount > payment.amountMinor : amount !== payment.amountMinor)) throw Error("Amount mismatch");
    if (["CONFIRMED", "AUTHORIZED", "REFUNDED", "PARTIAL_REFUNDED"].includes(data.Status) && data.Success !== true) throw Error("Unsuccessful notification");
    if (!paymentTransition(payment.status, data.Status)) return;
    const status = data.Status;
    const changed = await prisma.bankPayment.updateMany({ where: { id: payment.id, revision: payment.revision }, data: { status, paymentId, revision: { increment: 1 }, ...(failedPaymentStatus(status) ? { activeKey: null } : {}) } });
    if (changed.count) return;
  }
  throw Error("Concurrent payment update; retry notification");
}
