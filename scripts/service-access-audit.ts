import "dotenv/config";
import { prisma } from "../lib/db";
import { serviceCatalog } from "../lib/services/bridge";
async function main() {
  const services = await serviceCatalog();
  console.log("READ ONLY: no bank requests, charges, fulfillment or email delivery.");
  for (const service of services) {
    if (!["VPN", "PREMIUM"].includes(service.accessKind)) continue;
    console.log(JSON.stringify({ serviceId: service.id, title: service.title, accessKind: service.accessKind, pricesMinor: JSON.parse(service.prices), published: service.published }));
  }
  const subscriptions = await prisma.serviceSubscription.findMany({ where: { amountMinor: 20000 }, take: 10, orderBy: { createdAt: "desc" } });
  for (const sub of subscriptions) {
    const kind = JSON.parse(sub.snapshot).accessKind;
    const current = services.find(s => s.id === sub.serviceId);
    console.log(JSON.stringify({ subscriptionId: sub.id, serviceId: sub.serviceId, title: sub.title, amountMinor: sub.amountMinor, frozenAccessKind: kind, currentAccessKind: current?.accessKind || "NOT_IN_CATALOG", sameAccessKind: !!current && kind === current.accessKind, hasTzSubject: !!sub.tzSubject, status: sub.status, paidUntil: sub.paidUntil, syncPending: sub.syncPending, mappingToStandardVpn: kind === "VPN" && current?.accessKind === "VPN" }));
  }
  if (!subscriptions.length) console.log("No subscriptions with a frozen price of 200 RUB found.");
}
main().catch(() => { console.error("Audit could not complete. Check catalog permissions and database availability. No secret values printed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
