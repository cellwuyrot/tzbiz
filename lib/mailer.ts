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
};

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER и SMTP_PASS должны быть настроены.");
  }

  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
}

export async function sendLeadNotification(lead: LeadNotification) {
  const from = process.env.EMAIL_FROM ?? "info@trioz.ru";
  const to = process.env.LEADS_EMAIL_TO ?? "info@trioz.ru";
  const transport = getTransport();

  const text = [
    "Новая заявка TRIOZ",
    `Номер: ${lead.id}`,
    `Имя: ${lead.name}`,
    `Email: ${lead.email}`,
    `Телефон: ${lead.phone}`,
    `Компания: ${lead.company || "—"}`,
    `Услуга: ${lead.serviceTitle} (${lead.serviceSlug})`,
    "",
    "Особенности / комментарии:",
    lead.message,
  ].join("\n");

  await transport.sendMail({
    from,
    to,
    replyTo: lead.email,
    subject: `Новая заявка TRIOZ · ${lead.serviceTitle}`,
    text,
    html: `
      <h2>Новая заявка TRIOZ</h2>
      <p><strong>Номер:</strong> ${escapeHtml(lead.id)}</p>
      <p><strong>Имя:</strong> ${escapeHtml(lead.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
      <p><strong>Телефон:</strong> ${escapeHtml(lead.phone)}</p>
      <p><strong>Компания:</strong> ${escapeHtml(lead.company || "—")}</p>
      <p><strong>Услуга:</strong> ${escapeHtml(lead.serviceTitle)} (${escapeHtml(lead.serviceSlug)})</p>
      <p><strong>Особенности / комментарии:</strong></p>
      <p>${escapeHtml(lead.message).replace(/\\n/g, "<br />")}</p>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
