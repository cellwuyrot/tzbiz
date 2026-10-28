import { prisma } from "../db";

export async function trustHours() {
  const policy = await prisma.serviceTrustPolicy.findUnique({ where: { id: "services" } });
  return policy?.hours ?? 24;
}
/** Stored, verified bank Init only. Never grant for CREATING, invoice, renewal, or an old abandoned order. */
export async function ensureTrustAccess(subscriptionId: string) {
  const hours = await trustHours();
  if (!hours) return false;
  try {
    return await prisma.$transaction(async tx => {
      const sub = await tx.serviceSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      if (sub.paidIndex !== -1 || sub.status !== "PENDING" || sub.stopRequested || sub.method === "INVOICE" || sub.trustUntil) return false;
      // No speculative physical provisioning of hosting: this credit policy is for built-in account rights only.
      if (!["VPN", "PREMIUM"].includes(JSON.parse(sub.snapshot).accessKind)) return false;
      const cycle = await tx.serviceCycle.findUnique({ where: { subscriptionId_cycleIndex: { subscriptionId, cycleIndex: 0 } } });
      if (!cycle?.paymentId || !["NEW", "FORM_SHOWED", "AUTHORIZED"].includes(cycle.status) || Date.now() - cycle.createdAt.getTime() > 15 * 60000) return false;
      const until = new Date(Date.now() + hours * 3600000);
      await tx.serviceTrustGrant.create({ data: { tzSubject: sub.tzSubject, serviceId: sub.serviceId, subscriptionId, until } });
      const lock = await tx.serviceSubscription.updateMany({ where: { id: sub.id, status: "PENDING", paidIndex: -1, syncVersion: sub.syncVersion, stopRequested: false }, data: { status: "TRUSTED", trustUntil: until, syncVersion: { increment: 1 }, syncPending: true } });
      if (!lock.count) throw Error("Trust state changed");
      await tx.serviceNotice.upsert({ where: { id: `${sub.id}:trust-started` }, create: { id: `${sub.id}:trust-started`, subscriptionId: sub.id, text: `Покупка «${sub.title}» оформлена. Банк создал платёж на ${sub.amountMinor / 100} ₽, но оплата ещё не подтверждена. Доверительный доступ до ${until.toISOString()} передан на подключение в TZ ID. Подтверждение подключения придёт отдельно. Оплатите существующую заявку в кабинете Business; не создавайте повторный платёж, если деньги уже списались.` }, update: {} });
      return true;
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    // A unique customer/service tombstone is the anti-abuse and duplicate-request lock.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return false;
    throw e;
  }
}
export async function expireTrustAccess() {
  const now = new Date();
  const rows = await prisma.serviceSubscription.findMany({ where: { status: "TRUSTED", trustUntil: { lte: now } }, take: 100 });
  for (const sub of rows) await prisma.$transaction(async tx => {
    const lock = await tx.serviceSubscription.updateMany({ where: { id: sub.id, status: "TRUSTED", paidIndex: -1, syncVersion: sub.syncVersion, trustUntil: { lte: now } }, data: { status: "PENDING", syncVersion: { increment: 1 }, syncPending: true } });
    if (!lock.count) return;
    await tx.serviceNotice.upsert({ where: { id: `${sub.id}:trust-ended` }, create: { id: `${sub.id}:trust-ended`, subscriptionId: sub.id, text: `Доверительный срок услуги «${sub.title}» закончился. Отмена этого временного доступа передана в TZ ID; другие подписки и ручные права сохраняются. Подтверждение оплаты пока не получено. Банковская операция не объявляется отменённой: если деньги списались, не оплачивайте повторно и обратитесь в поддержку. Позднее подтверждение банка будет обработано.` }, update: {} });
  });
}
export async function queueServiceReminders() {
  const now = new Date();
  const trusted = await prisma.serviceSubscription.findMany({ where: { status: "TRUSTED", trustUntil: { gt: now, lte: new Date(Date.now() + 6 * 3600000) } }, take: 100 });
  for (const sub of trusted) {
    const grant = await prisma.serviceTrustGrant.findUnique({ where: { subscriptionId: sub.id } });
    if (!grant || now.getTime() < (grant.createdAt.getTime() + grant.until.getTime()) / 2) continue;
    await prisma.serviceNotice.upsert({ where: { id: `${sub.id}:trust-reminder` }, create: { id: `${sub.id}:trust-reminder`, subscriptionId: sub.id, text: `Напоминание: оплата ${sub.amountMinor / 100} ₽ за «${sub.title}» ещё не подтверждена. Доверительный срок заканчивается ${sub.trustUntil!.toISOString()}. Откройте существующую заявку в кабинете. Если деньги уже списались, не платите повторно — проверьте статус и обратитесь в поддержку.` }, update: {} });
  }
  const unpaid = await prisma.serviceSubscription.findMany({ where: { status: { in: ["PENDING", "AWAITING_INVOICE"] }, paidIndex: -1, trustUntil: null, createdAt: { lte: new Date(Date.now() - 86400000) } }, take: 100 });
  for (const sub of unpaid) await prisma.serviceNotice.upsert({ where: { id: `${sub.id}:pending-reminder` }, create: { id: `${sub.id}:pending-reminder`, subscriptionId: sub.id, text: `Напоминание по заявке «${sub.title}» на ${sub.amountMinor / 100} ₽: подтверждение оплаты пока не получено. Проверьте существующую заявку в Business. Если деньги списались, не оплачивайте повторно — обратитесь в поддержку.` }, update: {} });
  const paid = await prisma.serviceSubscription.findMany({ where: { status: "ACTIVE", paidUntil: { gt: now, lte: new Date(Date.now() + 86400000) }, stopRequested: false }, take: 100 });
  for (const sub of paid) await prisma.serviceNotice.upsert({ where: { id: `${sub.id}:period-reminder:${sub.paidIndex}` }, create: { id: `${sub.id}:period-reminder:${sub.paidIndex}`, subscriptionId: sub.id, text: `Оплаченный период «${sub.title}» заканчивается ${sub.paidUntil!.toISOString()}. ${sub.autoRenew ? "Автопродление включено по вашему согласию; отключить его можно в кабинете до отправки следующего списания." : "Автосписаний нет. Для продления откройте кабинет Business."}` }, update: {} });
}
