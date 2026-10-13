import nodemailer from "nodemailer";
import { getMailConfig, MailConfigurationError } from "./mailer-config";
import type { MailChannel, MailResult } from "./mail-status";

export type LeadNotification = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  serviceTitle: string;
  serviceSlug: string;
  message: string;
  createdAt: Date;
};

function getTransport() {
  const config = getMailConfig();
  return nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure, requireTLS: !config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000,
  });
}

function failure(error: unknown): MailResult {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (error instanceof MailConfigurationError || code === "CONFIG") return { status: "FAILED", errorCategory: "CONFIG" };
  if (["ETIMEDOUT", "ESOCKET"].includes(code)) return { status: "UNKNOWN", errorCategory: "TIMEOUT" };
  const categories: Record<string, string> = { EAUTH: "AUTH", ETLS: "TLS", EENVELOPE: "RECIPIENT", RECIPIENT: "RECIPIENT", ECONNECTION: "CONNECTION", ECONNREFUSED: "CONNECTION", ENOTFOUND: "CONNECTION", ESMTP: "SMTP" };
  return { status: categories[code] ? "FAILED" : "UNKNOWN", errorCategory: categories[code] || "UNKNOWN" };
}

async function sendSafely(transport: ReturnType<typeof getTransport>, message: Parameters<typeof transport.sendMail>[0]): Promise<MailResult> {
  try {
    const info = await transport.sendMail(message);
    if (!info.accepted?.length || info.rejected?.length) return { status: "FAILED", errorCategory: "RECIPIENT" };
    return { status: "SMTP_ACCEPTED", errorCategory: null };
  } catch (error) { return failure(error); }
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function template(title: string, paragraphs: string[]) {
  return `<html lang="ru"><body style="margin:0;background:#15171a;color:#f4f4f5;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:640px;margin:auto;padding:32px"><p style="color:#63d6c3">TRIOZ Business</p><h1 style="font-size:24px">${escapeHtml(title)}</h1>${paragraphs.map((text) => `<p>${escapeHtml(text).replaceAll("\n", "<br />")}</p>`).join("")}</main></body></html>`;
}

// One existing SMTP transport, two separate messages. Fulfilled means SMTP accepted,
// not that the message reached the recipient's inbox. No SMTP details are logged.
function leadMessages(lead: LeadNotification) {
  const { from, internalTo, replyTo: contact } = getMailConfig();
  const clientParagraphs = [
    `Здравствуйте, ${lead.name}! Спасибо за обращение в TRIOZ.`,
    `Номер заявки: ${lead.id}\nВыбранная услуга: ${lead.serviceTitle}`,
    "Мы получили вашу заявку. Команда изучит описание задачи и свяжется с вами по указанным контактам для обсуждения деталей и следующих шагов.",
    "Подача заявки не является оплатой или автоматическим заключением договора.",
    `Для связи с командой TRIOZ: ${contact}`,
  ];
  const internalParagraphs = [
    `Номер: ${lead.id}\nСоздана: ${lead.createdAt.toISOString()} (UTC)`,
    `Имя: ${lead.name}\nEmail: ${lead.email}\nТелефон: ${lead.phone}\nКомпания: ${lead.company || "—"}`,
    `Услуга: ${lead.serviceTitle} (${lead.serviceSlug})`,
    `Описание задачи:\n${lead.message}`,
  ];
  return [
    { from, to: lead.email, replyTo: contact, subject: `TRIOZ · Заявка ${lead.id.replace(/[\r\n]/g, " ")} получена`,
      text: ["Заявка получена", ...clientParagraphs].join("\n\n"), html: template("Заявка получена", clientParagraphs) },
    { from, to: internalTo, replyTo: lead.email, subject: `Новая заявка TRIOZ · ${lead.serviceTitle.replace(/[\r\n]/g, " ")}`,
      text: ["Новая заявка TRIOZ", ...internalParagraphs].join("\n\n"), html: template("Новая заявка TRIOZ", internalParagraphs) },
  ];
}

// A single existing SMTP transport and two independent messages. The callback
// records each result; database/logging failure cannot prevent the other send.
export async function sendLeadNotification(lead: LeadNotification, onResult?: (channel: MailChannel, result: MailResult) => Promise<void>) {
  let transport: ReturnType<typeof getTransport> | undefined;
  const setup = Promise.resolve().then(() => { transport = getTransport(); return { transport, messages: leadMessages(lead) }; });
  const settled = await Promise.allSettled((["client", "internal"] as const).map(async (channel, index) => {
    let result: MailResult;
    try {
      const prepared = await setup;
      result = await sendSafely(prepared.transport, prepared.messages[index]);
    } catch (error) { result = failure(error); }
    if (result.status !== "SMTP_ACCEPTED") console.warn("Lead notification not accepted", { leadId: lead.id, channel, category: result.errorCategory });
    if (onResult) {
      try { await onResult(channel, result); }
      catch { console.error("Lead notification status not recorded", { leadId: lead.id, channel }); }
    }
    return result;
  }));
  transport?.close();
  return {
    clientNotified: settled[0].status === "fulfilled" && settled[0].value.status === "SMTP_ACCEPTED",
    internalNotified: settled[1].status === "fulfilled" && settled[1].value.status === "SMTP_ACCEPTED",
  };
}

export async function sendLeadChannel(lead: LeadNotification, channel: MailChannel): Promise<MailResult> {
  let transport: ReturnType<typeof getTransport> | undefined;
  try {
    transport = getTransport();
    return await sendSafely(transport, leadMessages(lead)[channel === "client" ? 0 : 1]);
  } catch (error) { return failure(error); }
  finally { transport?.close(); }
}

export async function verifyMailConnection(): Promise<MailResult> {
  let transport: ReturnType<typeof getTransport> | undefined;
  try { transport = getTransport(); const verified = await transport.verify(); return verified === true ? { status: "SMTP_ACCEPTED", errorCategory: null } : { status: "FAILED", errorCategory: "CONNECTION" }; }
  catch (error) { return failure(error); }
  finally { transport?.close(); }
}

export async function sendMailDiagnostic(clientTo: string) {
  let transport: ReturnType<typeof getTransport> | undefined;
  const results = await Promise.allSettled(["client", "internal"].map(async channel => {
    try {
      const config = getMailConfig();
      transport ??= getTransport();
      const paragraphs = [
        "Это диагностическое письмо, отправленное администратором TRIOZ Business. Заявка и заказ не создавались.",
        channel === "client" ? "Проверяется клиентский канал уведомлений." : "Проверяется внутренний канал уведомлений команды.",
        `Время проверки: ${new Date().toISOString()} (UTC)`,
        `Контакт команды: ${config.replyTo}`,
      ];
      return await sendSafely(transport, {
        from: config.from, to: channel === "client" ? clientTo : config.internalTo,
        replyTo: channel === "client" ? config.replyTo : clientTo,
        subject: `Тест SMTP TRIOZ Business · ${channel === "client" ? "клиентский канал" : "внутренний канал"}`,
        text: paragraphs.join("\n\n"), html: template("Тест SMTP — не заявка", paragraphs),
      });
    } catch (error) { return failure(error); }
  }));
  transport?.close();
  return {
    client: results[0].status === "fulfilled" ? results[0].value : { status: "UNKNOWN" as const, errorCategory: "UNKNOWN" },
    internal: results[1].status === "fulfilled" ? results[1].value : { status: "UNKNOWN" as const, errorCategory: "UNKNOWN" },
  };
}
