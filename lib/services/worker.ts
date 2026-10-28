import nodemailer from "nodemailer";
import { prisma } from "../db"; import { getMailConfig } from "../mailer-config";
import { serviceHub, serviceCatalog } from "./bridge"; import { recurringEnabled } from "./calendar";
import { startServicePayment, reconcileServiceCycle, syncServiceAccess, purchasesEnabled } from "./subscriptions";
export async function runServiceJobs() {
  let failures = 0;
  // Expiry is independent of bank/network availability and never waits for a failed Charge.
  const overdue = await prisma.serviceSubscription.findMany({ where: { status: "ACTIVE", paidUntil: { lte: new Date() } }, take: 100 });
  for (const sub of overdue) { const unresolved = await prisma.serviceCycle.count({ where: { subscriptionId: sub.id, status: { in: ["CREATING", "INITIALIZED", "CHARGING", "NEW", "FORM_SHOWED", "AUTHORIZED"] } } }); await prisma.serviceSubscription.updateMany({ where: { id: sub.id, status: "ACTIVE", paidUntil: { lte: new Date() } }, data: { status: "EXPIRED", syncPending: true, syncVersion: { increment: 1 }, ...(!sub.autoRenew && !unresolved ? { activeKey: null } : {}) } }); }
  if (purchasesEnabled() && recurringEnabled()) {
    const due = await prisma.serviceSubscription.findMany({ where: { autoRenew: true, stopRequested: false, paidUntil: { lte: new Date() }, status: { in: ["ACTIVE", "EXPIRED"] } }, take: 50 });
    for (const sub of due) {      
const lease = new Date(Date.now() + 90000); const claimed = await prisma.serviceSubscription.updateMany({ where: { id: sub.id, autoRenew: true, stopRequested: false, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { leaseUntil: lease } }); if (!claimed.count) continue;
      try {
        const live = (await serviceCatalog()).find(s => s.id === sub.serviceId && s.published);
        if (!live || !JSON.parse(live.methods).includes("RECURRING") || !sub.rebillEncrypted || !sub.paidUntil || Date.now() - sub.paidUntil.getTime() > 3600000) { await prisma.serviceSubscription.updateMany({ where: { id: sub.id }, data: { autoRenew: false, stopRequested: true, activeKey: null } }); await prisma.serviceNotice.upsert({ where: { id: `${sub.id}:renewal-stopped` }, create: { id: `${sub.id}:renewal-stopped`, subscriptionId: sub.id, text: `Автопродление услуги «${sub.title}» остановлено: нет действующего разрешения/услуги либо пропущено безопасное окно продления. Новое списание не отправлено. Обратитесь в поддержку.` }, update: {} }); continue; }
        const cycle = await startServicePayment(sub, sub.paidIndex + 1);
        if (["REJECTED", "CANCELED", "AUTH_FAIL", "DEADLINE_EXPIRED"].includes(cycle.status)) await prisma.serviceSubscription.updateMany({ where: { id: sub.id }, data: { autoRenew: false, stopRequested: true, activeKey: null } });
      } catch { failures++; } finally { await prisma.serviceSubscription.updateMany({ where: { id: sub.id, leaseUntil: lease }, data: { leaseUntil: null } }); }
    }
  }
  // Read-only recovery after ambiguous Init/Charge; never repeat an uncertain money-moving request.
  const pending = await prisma.serviceCycle.findMany({ where: { paymentId: { not: null }, status: { in: ["NEW", "FORM_SHOWED", "AUTHORIZED", "CHARGING", "INITIALIZED", "CREATING"] } }, take: 100, orderBy: { updatedAt: "asc" } });
  for (const cycle of pending) try { await reconcileServiceCycle(cycle.id); } catch { failures++; }
  const outbox = await prisma.serviceSubscription.findMany({ where: { syncPending: true }, take: 100, orderBy: { updatedAt: "asc" } });
  for (const sub of outbox) try { await syncServiceAccess(sub); } catch { failures++; }
  try { await pollManualCompletion(); } catch { failures++; }
  await sendServiceNotices();
  if (failures) throw Error("Some service operations remain pending; no uncertain charge was repeated");
}
export async function sendServiceNotices() {
  // A crashed SMTP send is ambiguous too. Do not generate an endless stream of duplicate notices.
  await prisma.serviceNotice.updateMany({ where: { status: "SENDING", leaseUntil: { lt: new Date() } }, data: { status: "UNKNOWN" } });
  const jobs = await prisma.serviceNotice.findMany({ where: { status: "PENDING", availableAt: { lte: new Date() }, attempts: { lt: 5 } }, take: 20 });
  for (const job of jobs) {    
const lease = new Date(Date.now() + 60000); const claimed = await prisma.serviceNotice.updateMany({ where: { id: job.id, status: "PENDING" }, data: { status: "SENDING", leaseUntil: lease, attempts: { increment: 1 } } }); if (!claimed.count) continue;
    try {      
const sub = await prisma.serviceSubscription.findUniqueOrThrow({ where: { id: job.subscriptionId } }); const user = await prisma.user.findUniqueOrThrow({ where: { id: sub.userId } }); const c = getMailConfig(); const transport = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, requireTLS: !c.secure, auth: { user: c.user, pass: c.pass }, connectionTimeout: 10000, socketTimeout: 15000 }); const sent = await transport.sendMail({ from: c.from, to: user.email, replyTo: c.replyTo, subject: `TRIOZ · ${sub.title}`, text: `${job.text}\n\nУправление услугой: https://business.trioz.ru/subscriptions\nНомер подписки: ${sub.id}`, messageId: `<${job.id.replace(/[^a-zA-Z0-9.-]/g, "-")}@business.trioz.ru>` }); if (!sent.accepted?.length) throw Error("Not accepted"); await prisma.serviceNotice.update({ where: { id: job.id }, data: { status: "SENT", leaseUntil: null } });
    } catch { await prisma.serviceNotice.update({ where: { id: job.id }, data: { status: "UNKNOWN", leaseUntil: null } }); }
  }
}

/** Read-only polling of completed physical tasks; no server is claimed stopped before confirmation. */
export async function pollManualCompletion() {
 let cursor:string|undefined;
 while(true){
  const records=await prisma.serviceSubscription.findMany({where:{snapshot:{contains:'"MANUAL"'},paidIndex:{gte:0}},orderBy:{id:"asc"},take:100,...(cursor?{cursor:{id:cursor},skip:1}:{})});
  if(!records.length)return;
  const result=await serviceHub({action:"deliveryStatus",externalIds:records.map(s=>s.id)});
  const states=(result.connections||[]) as {externalId:string;version:number;status:string;manualState:string}[];
  for(const state of states){if(state.manualState!=="DONE")continue;const sub=records.find(s=>s.id===state.externalId);if(!sub || state.version!==sub.syncVersion)continue;await prisma.serviceNotice.upsert({where:{id:`${sub.id}:manual:${state.version}:${state.status}`},create:{id:`${sub.id}:manual:${state.version}:${state.status}`,subscriptionId:sub.id,text:`Услуга «${sub.title}»: администратор подтвердил фактическое ${state.status==="ACTIVE"?"подключение":"отключение"}. Состояние доступно в TZ ID.`},update:{}});}
  cursor=records[records.length-1].id;if(records.length<100)return;
 }
}
