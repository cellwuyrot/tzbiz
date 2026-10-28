import crypto from "node:crypto";
import { ensureTrustAccess } from "./trust";
import { prisma } from "../db";
import { bankConfig, bankRequest, receiptFor, safePaymentUrl, paymentTransition, failedPaymentStatus } from "../billing/tbank";
import { sealTzData, openTzData } from "../tz-id/crypto";
import { serviceCatalog, serviceHub } from "./bridge";
import { periodEnd, recurringEnabled, subscriptionPeriods } from "./calendar";
import type { ServiceSubscription, ServiceCycle } from "@prisma/client";
export function serviceErrorMessage(e: unknown) { return e instanceof Error && e.name === "Error" ? e.message : "Не удалось выполнить операцию. Обновите данные; при повторной ошибке обратитесь в поддержку."; }
export function purchasesEnabled() { return process.env.SUBSCRIPTIONS_ENABLED === "1" && process.env.SUBSCRIPTION_TERMS_APPROVED === "1"; }
export async function createSubscription(user: { id: string; email: string }, input: { serviceId: string; revision: number; months: number; method: string; requestKey: string; recurringConsent: boolean; legalVersions: Record<string, string>; agreementAccepted: boolean }) {
  if (!input.agreementAccepted || !Object.keys(input.legalVersions).length) throw Error("Примите опубликованные условия оформления");
  if (!purchasesEnabled()) throw Error("Оформление новых услуг ещё не включено владельцем.");
  if (!subscriptionPeriods.includes(input.months) || !["ONE_TIME", "RECURRING", "INVOICE"].includes(input.method)) throw Error("Выберите период и способ оплаты");
  if (input.method === "RECURRING" && (!input.recurringConsent || !recurringEnabled())) throw Error("Автосписания не подключены банком или нет отдельного согласия.");
  const hash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const previous = await prisma.serviceSubscription.findUnique({ where: { requestKey: input.requestKey } });
  if (previous) { if (previous.userId !== user.id || previous.requestHash !== hash) throw Error("Ключ отправки уже использован"); return previous; }
  const service = (await serviceCatalog()).find(s => s.id === input.serviceId && s.published);
  if (!service || service.revision !== input.revision) throw Error("Условия услуги изменились. Обновите страницу.");
  const prices = JSON.parse(service.prices), methods = JSON.parse(service.methods);
  const amount = prices[String(input.months)]; if (!Number.isSafeInteger(amount) || amount < 1 || !methods.includes(input.method)) throw Error("Период или способ оплаты недоступен");
  const identity = await prisma.tzIdentityLink.findUnique({ where: { userId: user.id } }); if (!identity || identity.issuer !== "https://id.trioz.ru") throw Error("Войдите через TZ ID");
  const terms = await prisma.commerceSettings.findUnique({ where: { id: "commerce" } }); if (!terms?.approved) throw Error("Владелец ещё не утвердил продавца и условия");
  return prisma.$transaction(async tx => {
    const created = await tx.serviceSubscription.create({ data: { userId: user.id, tzSubject: identity.subject, serviceId: service.id, title: service.title, snapshot: JSON.stringify(service), amountMinor: amount, months: input.months, method: input.method, autoRenew: input.method === "RECURRING", allowCancel: service.allowCancel, consent: JSON.stringify({ version: process.env.SUBSCRIPTION_CONSENT_VERSION || "services-v1", acceptedAt: new Date().toISOString(), amountMinor: amount, months: input.months, recurring: input.recurringConsent, email: user.email, termsRevision: terms.revision, legalVersions: input.legalVersions, agreementAccepted: input.agreementAccepted }), requestKey: input.requestKey, requestHash: hash, activeKey: `${user.id}:${service.id}`, anchor: new Date(), status: input.method === "INVOICE" ? "AWAITING_INVOICE" : "PENDING" } });
    await tx.serviceNotice.upsert({ where: { id: `${created.id}:order-created` }, create: { id: `${created.id}:order-created`, subscriptionId: created.id, text: `Создана заявка на «${created.title}»: ${created.amountMinor / 100} ₽ за ${created.months} мес. Это не подтверждение оплаты. ${created.method === "INVOICE" ? "Ожидайте выставления счёта и сверки поступления денег." : "Для оплаты используйте существующую заявку в кабинете Business. Если деньги уже списались, не платите повторно."}` }, update: {} });
    return created;
  });
}
export async function startServicePayment(subscription: ServiceSubscription, index = 0): Promise<ServiceCycle> {
  if (!purchasesEnabled()) throw Error("Оплата услуг выключена владельцем");
  if (subscription.method === "INVOICE") throw Error("Ожидается выставление и сверка счёта администратором");
  const config = bankConfig();
  if (subscription.method === "RECURRING" && (!recurringEnabled() || config.receiptMode !== "bank")) throw Error("Для автосписаний нужны подтверждение банка и настроенная касса через банк");
  const prior = await prisma.serviceCycle.findUnique({ where: { subscriptionId_cycleIndex: { subscriptionId: subscription.id, cycleIndex: index } } }); if (prior) { if (index === 0) await tryTrustAndSync(subscription.id); return prior; }
  if (index > 0 && (!subscription.autoRenew || subscription.stopRequested || !subscription.rebillEncrypted || subscription.paidIndex !== index - 1)) throw Error("Продление остановлено");
  const eligibility = await serviceHub({ action: "eligibility", subject: subscription.tzSubject }); if (!eligibility.allowed) throw Error("Аккаунт TZ ID недоступен. Списание не отправлено.");
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: subscription.userId } });
  const receipt = config.receiptMode === "bank" ? receiptFor(subscription.title, subscription.amountMinor, owner.email, "SERVICE") : undefined;
  const cycle = await prisma.serviceCycle.create({ data: { subscriptionId: subscription.id, cycleIndex: index, periodEnd: periodEnd(subscription.anchor, subscription.months, index), amountMinor: subscription.amountMinor, terminalKey: config.terminal } });
  try {
    const result = await bankRequest("Init", { Amount: cycle.amountMinor, OrderId: cycle.id, Description: subscription.title.slice(0, 140), PayType: "O", CustomerKey: subscription.userId, NotificationURL: `${config.origin}/api/subscriptions/bank/notify`, SuccessURL: `${config.origin}/subscriptions?payment=return`, FailURL: `${config.origin}/subscriptions?payment=failed`, ...(subscription.method === "RECURRING" && index === 0 ? { Recurrent: "Y" } : {}), DATA: { OperationInitiatorType: subscription.method === "RECURRING" ? (index === 0 ? "1" : "R") : "0" }, ...(receipt ? { Receipt: receipt } : {}) });
    if (result.Success === false && String(result.ErrorCode) !== "0" && result.ErrorCode !== undefined) { await prisma.serviceCycle.updateMany({ where: { id: cycle.id, status: "CREATING" }, data: { status: "REJECTED", revision: { increment: 1 } } }); if (index === 0) await prisma.serviceSubscription.updateMany({ where: { id: subscription.id, paidIndex: -1 }, data: { status: "CANCELED", autoRenew: false, stopRequested: true, activeKey: null } }); await prisma.serviceNotice.upsert({ where: { id: `${cycle.id}:failed` }, create: { id: `${cycle.id}:failed`, subscriptionId: subscription.id, text: `Банк отказал в создании платежа за услугу «${subscription.title}». Новый доступ не выдан; уже оплаченный срок сохраняется. Новое списание автоматически не отправляется.` }, update: {} }); throw Error("Банк отказал в создании платежа"); }
    if (result.Success !== true || String(result.ErrorCode) !== "0" || result.OrderId !== cycle.id || result.TerminalKey !== config.terminal || Number(result.Amount) !== cycle.amountMinor || !/^\d{1,20}$/.test(String(result.PaymentId))) throw Error("Неопределённый ответ банка");
    const paymentUrl = index === 0 ? safePaymentUrl(result.PaymentURL) : "";
    await prisma.serviceCycle.updateMany({ where: { id: cycle.id, status: "CREATING", revision: 1 }, data: { status: index === 0 ? "NEW" : "INITIALIZED", paymentId: String(result.PaymentId), paymentUrl, revision: { increment: 1 } } });
    if (index > 0) {
      const claimed = await prisma.$transaction(async tx => {
        const live = await tx.serviceSubscription.updateMany({ where: { id: subscription.id, autoRenew: true, stopRequested: false, paidIndex: index - 1 }, data: { updatedAt: new Date() } }); if (!live.count) return false;
        const change = await tx.serviceCycle.updateMany({ where: { id: cycle.id, status: "INITIALIZED" }, data: { status: "CHARGING", revision: { increment: 1 } } }); return !!change.count;
      });
      if (!claimed) throw Error("Продление отменено до отправки списания");
      // A durable CHARGING tombstone is written first. Never repeat Charge after timeout/crash.
      await bankRequest("Charge", { PaymentId: String(result.PaymentId), RebillId: openTzData<string>(subscription.rebillEncrypted!) });
      await reconcileServiceCycle(cycle.id);
    }
  } catch { /* Unknown outcomes remain locked. Only signed notifications/GetState can settle them. */ }
  if (index === 0) await tryTrustAndSync(subscription.id);
  return prisma.serviceCycle.findUniqueOrThrow({ where: { id: cycle.id } });
}
export async function applyServicePayment(data: Record<string, unknown>) {
  const id = String(data.OrderId || ""), pid = String(data.PaymentId || ""), status = String(data.Status || "");
  if (!id || !/^\d{1,20}$/.test(pid)) throw Error("Invalid payment");
  return prisma.$transaction(async tx => {
    const cycle = await tx.serviceCycle.findUnique({ where: { id } }); if (!cycle || cycle.terminalKey !== data.TerminalKey || (cycle.paymentId && cycle.paymentId !== pid)) throw Error("Payment mismatch");
    const refund = ["REFUNDED", "PARTIAL_REFUNDED"].includes(status); const amount = Number(data.Amount);
    if (!Number.isSafeInteger(amount) || (refund ? (amount < 0 || amount > cycle.amountMinor) : amount !== cycle.amountMinor)) throw Error("Amount mismatch");
    if (["CONFIRMED", "AUTHORIZED", "REFUNDED", "PARTIAL_REFUNDED"].includes(status) && data.Success !== true) throw Error("Unsuccessful payment");
    const sub = await tx.serviceSubscription.findUniqueOrThrow({ where: { id: cycle.subscriptionId } });
    // Some notifications contain RebillId only on AUTHORIZED. Preserve it even if CONFIRMED arrived first.
    const rebill = data.RebillId !== undefined ? String(data.RebillId) : "";
    if (rebill && !/^\d{1,30}$/.test(rebill)) throw Error("Invalid rebill ID");
    if (rebill && cycle.cycleIndex === 0 && sub.method === "RECURRING" && ["AUTHORIZED", "CONFIRMED"].includes(status) && data.Success === true) { await tx.serviceSubscription.updateMany({ where: { id: sub.id }, data: { rebillEncrypted: sealTzData(rebill) } }); }
    // CREATING/CHARGING/INITIALIZED are local, not bank statuses.
    const from = ["CREATING", "CHARGING", "INITIALIZED"].includes(cycle.status) ? "NEW" : cycle.status;
    if (!paymentTransition(from, status)) return { ok: true, reused: true };
    const changed = await tx.serviceCycle.updateMany({ where: { id, revision: cycle.revision }, data: { status, paymentId: pid, revision: { increment: 1 }, ...(rebill ? { rebillEncrypted: sealTzData(rebill) } : {}) } }); if (!changed.count) throw Error("Concurrent update");
    if (status === "CONFIRMED" && cycle.cycleIndex > sub.paidIndex) {
      if (cycle.cycleIndex !== sub.paidIndex + 1) throw Error("Payment sequence mismatch");
      const anchor = cycle.cycleIndex === 0 ? new Date() : sub.anchor; const end = periodEnd(anchor, sub.months, cycle.cycleIndex);
      await tx.serviceCycle.update({ where: { id }, data: { periodEnd: end } });
      await tx.serviceSubscription.update({ where: { id: sub.id }, data: { status: sub.stopNow ? "EXPIRED" : "ACTIVE", anchor, paidUntil: sub.stopNow ? new Date() : end, paidIndex: cycle.cycleIndex, trustUntil: null, syncVersion: { increment: 1 }, syncPending: true, leaseUntil: null } });
      await tx.serviceNotice.upsert({ where: { id: `${id}:paid` }, create: { id: `${id}:paid`, subscriptionId: sub.id, text: sub.stopNow ? `Оплата услуги «${sub.title}» подтверждена после запроса отключения. Доступ не возобновлён. По возврату обратитесь в поддержку.` : `Оплата услуги «${sub.title}» подтверждена. Оплачено до ${end.toISOString()}. ${JSON.parse(sub.snapshot).accessKind === "MANUAL" ? "Подключение выполняет администратор; его состояние отображается в TZ ID." : "Доступ передан на подключение в TZ ID."}` }, update: {} });
    }
    if (failedPaymentStatus(status)) {
      const stillPaid = !!sub.paidUntil && sub.paidUntil > new Date();
      await tx.serviceSubscription.update({ where: { id: sub.id }, data: { autoRenew: false, stopRequested: true, status: stillPaid ? "ACTIVE" : "EXPIRED", ...(stillPaid ? {} : { syncVersion: { increment: 1 }, syncPending: !!sub.paidUntil || !!sub.trustUntil, trustUntil: sub.trustUntil ? new Date() : null, activeKey: null }), leaseUntil: null } });
      await tx.serviceNotice.upsert({ where: { id: `${id}:failed` }, create: { id: `${id}:failed`, subscriptionId: sub.id, text: `Платёж за услугу «${sub.title}» не подтверждён. Автопродление остановлено; доступ сохраняется только до конца уже оплаченного срока. Повторного автоматического списания не будет.` }, update: {} });
    }
    if (status === "REFUNDED" && cycle.cycleIndex === sub.paidIndex) { await tx.serviceSubscription.update({ where: { id: sub.id }, data: { status: "EXPIRED", paidUntil: new Date(), autoRenew: false, stopRequested: true, activeKey: null, syncVersion: { increment: 1 }, syncPending: true } }); }
    if (status === "PARTIAL_REFUNDED") { await tx.serviceSubscription.update({ where: { id: sub.id }, data: { autoRenew: false, stopRequested: true } }); }
    return { ok: true };
  });
}
export async function reconcileServiceCycle(id: string) {
  const cycle = await prisma.serviceCycle.findUniqueOrThrow({ where: { id } }); if (!cycle.paymentId) return;
  const result = await bankRequest("GetState", { PaymentId: cycle.paymentId }); await applyServicePayment(result);
}
export async function stopSubscription(id: string, userId: string, immediate = false) {
  return prisma.$transaction(async tx => {
    const sub = await tx.serviceSubscription.findFirst({ where: { id, userId } }); if (!sub) throw Error("Подписка не найдена");
    if (immediate && (!(["ACTIVE", "TRUSTED"].includes(sub.status)) || !(sub.paidUntil || sub.trustUntil) || (sub.paidUntil || sub.trustUntil)! <= new Date())) throw Error("Нет действующего оплаченного периода");
    if (immediate && !sub.allowCancel && sub.status !== "TRUSTED") throw Error("Досрочное отключение выполняет поддержка");
    const unresolved = await tx.serviceCycle.count({ where: { subscriptionId: id, status: { in: ["CREATING", "INITIALIZED", "CHARGING", "NEW", "FORM_SHOWED", "AUTHORIZED"] } } });
    const cancelUnpaid = !immediate && sub.paidIndex < 0 && !unresolved;
    const updated = await tx.serviceSubscription.update({ where: { id }, data: { autoRenew: false, stopRequested: true, ...(cancelUnpaid ? { status: "CANCELED", activeKey: null } : {}), ...(immediate ? { stopNow: true } : {}), ...(immediate ? { status: "EXPIRED", paidUntil: new Date(), activeKey: null, syncPending: true, syncVersion: { increment: 1 } } : {}) } });
    await tx.serviceNotice.upsert({ where: { id: `${id}:stop:${immediate}` }, create: { id: `${id}:stop:${immediate}`, subscriptionId: id, text: `Для услуги «${sub.title}» ${immediate ? "запрошено досрочное отключение. Возврат средств не выполняется автоматически; обратитесь в поддержку." : "отключено автопродление. Уже оплаченный период сохраняется. Платёж, отправленный банку до отмены, может завершиться; его результат будет отражён отдельно."}` }, update: {} }); return updated;
  });
}
export async function syncServiceAccess(sub: ServiceSubscription) {
  const until = sub.status === "TRUSTED" ? sub.trustUntil : sub.paidUntil || sub.trustUntil;
  if (!sub.syncPending || !until) return;
  const active = ["ACTIVE", "TRUSTED"].includes(sub.status) && until > new Date();
  const result = await serviceHub({ action: "fulfill", subject: sub.tzSubject, externalId: sub.id, serviceId: sub.serviceId, version: sub.syncVersion, expectedAccessKind: JSON.parse(sub.snapshot).accessKind, paidUntil: until.toISOString(), accessSource: sub.status === "TRUSTED" || sub.paidIndex < 0 ? "TRUST" : "PAID", status: active ? "ACTIVE" : "EXPIRED" });
  await prisma.serviceNotice.upsert({ where: { id: `${sub.id}:access:${sub.syncVersion}` }, create: { id: `${sub.id}:access:${sub.syncVersion}`, subscriptionId: sub.id, text: `Услуга «${sub.title}»: ${result.status === "ACTIVE" ? (sub.status === "TRUSTED" ? "доверительный доступ подключён в TZ ID; оплата ещё ожидается." : "доступ подключён в TZ ID.") : sub.status === "ACTIVE" ? "заявка на подключение передана исполнителю. Фактическое состояние указано в TZ ID." : sub.paidIndex < 0 ? "доверительный доступ завершён. Другие действующие права сохраняются." : "оплаченный доступ завершён. Для ручных услуг создана задача отключения; фактическое выполнение подтверждает администратор."}` }, update: {} });
  await prisma.serviceSubscription.updateMany({ where: { id: sub.id, syncVersion: sub.syncVersion }, data: { syncPending: false } });
}

async function tryTrustAndSync(id: string) {
  try { await ensureTrustAccess(id); const live = await prisma.serviceSubscription.findUniqueOrThrow({ where: { id } }); if (live.syncPending) await syncServiceAccess(live); }
  catch { /* The durable outbox is retried by the scheduled worker; never send another charge here. */ }
}
