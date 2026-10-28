import "dotenv/config";
import { serviceCatalog } from "../lib/services/bridge";
import { purchasesEnabled } from "../lib/services/subscriptions";
import { recurringEnabled } from "../lib/services/calendar";
import { bankConfig, receiptFor } from "../lib/billing/tbank";
import { prisma } from "../lib/db";
async function main() {
  console.log("Shared catalog enabled:", process.env.SERVICE_HUB_ENABLED === "1");
  console.log("New service purchases enabled:", purchasesEnabled());
  console.log("Recurrent bank approval + explicit owner switch:", recurringEnabled());
  try { const c = bankConfig(); if (c.receiptMode === "bank") receiptFor("Configuration check", 100, "check@example.invalid", "SERVICE"); console.log("Bank environment: valid; receipt mode:", c.receiptMode); } catch { console.log("Bank environment: NOT ready. No bank request was sent."); }
  const services = await serviceCatalog(); console.log("Published shared services:", services.length);
  console.log("Pending access deliveries:", await prisma.serviceSubscription.count({ where: { syncPending: true } }));
  console.log("Uncertain payments:", await prisma.serviceCycle.count({ where: { status: { in: ["CREATING", "INITIALIZED", "CHARGING"] } } }));
  console.log("Uncertain mail deliveries:", await prisma.serviceNotice.count({ where: { status: "UNKNOWN" } }));
  console.log("Read-only check completed. No Init/Charge or SMTP delivery was sent.");
}
main().catch(() => { console.error("Shared service check failed. Verify migrations, central feature switch and existing TZ ID client permissions; no secrets are printed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
