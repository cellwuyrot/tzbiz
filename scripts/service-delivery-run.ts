/** Delivery-only runner: no bank Init/Charge, no recurring renewals. */
import "dotenv/config";
import { prisma } from "../lib/db";
import { expireTrustAccess, queueServiceReminders } from "../lib/services/trust";
import { syncServiceAccess } from "../lib/services/subscriptions";
import { sendServiceNotices } from "../lib/services/worker";
async function main() {
  await expireTrustAccess();
  await queueServiceReminders();
  const pending = await prisma.serviceSubscription.findMany({ where: { syncPending: true }, orderBy: { updatedAt: "asc" }, take: 100 });
  let failures = 0;
  for (const sub of pending) { try { await syncServiceAccess(sub); } catch { failures++; } }
  await sendServiceNotices();
  console.log(`Delivery-only complete: ${pending.length} access tasks inspected; ${failures} remain pending. No bank request or new charge was sent.`);
  if (failures) process.exitCode = 1;
}
main().catch(() => { console.error("Delivery-only task failed; no new bank charge was requested."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
