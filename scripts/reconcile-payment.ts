import "dotenv/config";
import { prisma } from "../lib/db";
import { bankRequest } from "../lib/billing/tbank";
import { applyBankState } from "../lib/billing/payment-state";
const args = process.argv.slice(2);
const paymentId = args[args.indexOf("--payment-id") + 1];
const attemptId = args[args.indexOf("--attempt-id") + 1];
if (!args.includes("--payment-id") || !args.includes("--attempt-id") || !/^\d{1,30}$/.test(paymentId) || !/^c[a-z0-9]{20,32}$/.test(attemptId)) throw Error("Usage: npm run payment:reconcile -- --payment-id <bank-id> --attempt-id <local-attempt-id>");
try {
  const attempt = await prisma.bankPayment.findUniqueOrThrow({ where: { id: attemptId } });
  const result = await bankRequest("GetState", { PaymentId: paymentId });
  if (result.Success !== true || result.OrderId !== attempt.id) throw Error("Bank did not confirm the requested payment/attempt.");
  await applyBankState(result);
  console.log("Payment reconciled using the bank's current status. No new charge was created.");
} finally { await prisma.$disconnect(); }
