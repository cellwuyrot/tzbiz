import nodemailer from "nodemailer";

type LeadNotification = {
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
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP is not configured.");
  const port = Number(process.env.SMTP_PORT ?? 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid SMTP port.");
  const configuredSecure = process.env.SMTP_SECURE;
  if (configuredSecure !== undefined && configuredSecure !== "true" && configuredSecure !== "false") {
    throw new Error("Invalid SMTP secure setting.");
  }
  const secure = configuredSecure === undefined ? port === 465 : configuredSecure === "true";
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
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
export async function sendLeadNotification(lead: LeadNotification) {
  const from = process.env.EMAIL_FROM ?? "union@business.trioz.ru";
  const internalTo = process.env.LEADS_EMAIL_TO ?? "info@trioz.ru";
  const contact = process.env.EMAIL_REPLY_TO ?? "info@trioz.ru";
  const transport = Promise.resolve().then(getTransport);
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
  const messages = [
    { from, to: lead.email, replyTo: contact, subject: `TRIOZ · Заявка ${lead.id.replace(/[\r\n]/g, " ")} получена`,
      text: ["Заявка получена", ...clientParagraphs].join("\n\n"), html: template("Заявка получена", clientParagraphs) },
    { from, to: internalTo, replyTo: lead.email, subject: `Новая заявка TRIOZ · ${lead.serviceTitle.replace(/[\r\n]/g, " ")}`,
      text: ["Новая заявка TRIOZ", ...internalParagraphs].join("\n\n"), html: template("Новая заявка TRIOZ", internalParagraphs) },
  ];
  const results = await Promise.allSettled(messages.map(async (message) => {
    const smtp = await transport;
    const info = await smtp.sendMail(message);
    if (!info.accepted?.length || info.rejected?.length) throw new Error("Recipient not accepted.");
  }));
  const clientNotified = results[0].status === "fulfilled";
  const internalNotified = results[1].status === "fulfilled";
  if (!clientNotified) console.warn("Lead client notification not accepted by SMTP");
  if (!internalNotified) console.warn("Lead internal notification not accepted by SMTP");
  return { clientNotified, internalNotified };
}
