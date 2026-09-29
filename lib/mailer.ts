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

type SiteInfo = {
  domain: string | null;
  senderEmail: string;
  isActive: boolean;
  hasRelay: boolean;
  dkimConfigured: boolean;
};

const REQUEST_TIMEOUT_MS = 15_000;
const serviceUrl = (process.env.SMTP_SERVICE_URL || "").replace(/\/+$/, "");
const serviceKey = process.env.SMTP_SERVICE_KEY || "";
const useService = Boolean(serviceUrl && serviceKey);

function describeError(error: unknown) {
  if (error instanceof Error) return error.name === "AbortError" ? "таймаут запроса" : error.message;
  return String(error);
}

async function readDetail(response: Response) {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;
      return typeof detail === "string" ? detail : JSON.stringify(detail);
    }
    return JSON.stringify(data);
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

async function requestService(path: string, body?: unknown) {
  if (!useService) throw new Error("SMTP service is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${serviceKey}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  try {
    return await fetch(`${serviceUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

let sitePromise: Promise<SiteInfo | null> | null = null;

async function fetchSiteInfo(): Promise<SiteInfo | null> {
  try {
    const response = await requestService("/api/me");
    if (response.status === 401) {
      console.error("[email] сервис не принял SMTP_SERVICE_KEY");
      return null;
    }
    if (!response.ok) {
      console.error(`[email] сервис ответил ${response.status} на /api/me: ${await readDetail(response)}`);
      return null;
    }

    const data = (await response.json()) as {
      type?: string;
      site?: {
        domain?: string;
        sender_email?: string;
        is_active?: boolean;
        has_relay?: boolean;
        dkim_configured?: boolean;
      } | null;
    };

    const info: SiteInfo = {
      domain: data.site?.domain ?? null,
      senderEmail: data.site?.sender_email ?? "",
      isActive: data.site?.is_active ?? true,
      hasRelay: data.site?.has_relay ?? false,
      dkimConfigured: data.site?.dkim_configured ?? false,
    };

    if (data.type === "global") {
      console.log(`[email] почтовый сервис ${serviceUrl}: глобальный ключ`);
    } else {
      console.log(
        `[email] почтовый сервис ${serviceUrl}: домен ${info.domain ?? "?"}, ` +
          `отправитель ${info.senderEmail || "?"}, ` +
          `DKIM ${info.dkimConfigured ? "настроен" : "не настроен"}, ` +
          `relay ${info.hasRelay ? "свой" : "общий"}`,
      );
    }

    if (!info.isActive) {
      console.error(`[email] сайт ${info.domain ?? "?"} в сервисе отключён — письма отправляться не будут`);
    }

    const configuredFrom = process.env.SMTP_FROM;
    const fromDomain = configuredFrom?.split("@")[1]?.toLowerCase();
    if (fromDomain && info.domain && fromDomain !== info.domain.toLowerCase()) {
      console.error(
        `[email] SMTP_FROM=${configuredFrom} не совпадает с доменом ключа (@${info.domain}) — сервис отклонит письмо`,
      );
    }

    return info;
  } catch (error) {
    console.error("[email] почтовый сервис недоступен:", describeError(error));
    return null;
  }
}

function siteInfo() {
  if (!sitePromise) {
    sitePromise = fetchSiteInfo();
  }
  return sitePromise;
}

const smtpUser = process.env.SMTP_USER || "";
const smtpPasswordSource = process.env.SMTP_PASSWORD ? "SMTP_PASSWORD" : process.env.SMTP_PASS ? "SMTP_PASS" : null;
const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
const smtpPort = Number(process.env.SMTP_PORT ?? 465);
const smtpSecure = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : smtpPort === 465;

function createLegacyTransport() {
  if (!process.env.SMTP_HOST) return null;

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser ? { user: smtpUser, pass: smtpPassword } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  });

  console.log("[email] прямой SMTP:", {
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser ? "***" : "(none)",
    pass: smtpPassword ? `*** (${smtpPasswordSource})` : "(none)",
    from: process.env.SMTP_FROM || "(none)",
  });

  if (smtpUser && !smtpPassword) {
    console.error("[email] SMTP_USER задан, а пароль пуст — укажите SMTP_PASSWORD");
  }

  transport.verify((error) => {
    if (error) console.error("[email] SMTP verify FAILED:", error.message);
    else console.log("[email] SMTP verify OK — ready to send");
  });

  return transport;
}

const legacyTransporter = useService ? null : createLegacyTransport();

if (useService) {
  void siteInfo();
} else if (!legacyTransporter) {
  console.error("[email] почта не настроена: задайте SMTP_SERVICE_URL + SMTP_SERVICE_KEY или SMTP_HOST");
}

function fromAddress(info: SiteInfo | null) {
  return process.env.SMTP_FROM || info?.senderEmail || process.env.SMTP_USER || "info@trioz.ru";
}

async function sendViaService(
  to: string,
  subject: string,
  html: string,
  text: string,
) {
  const info = await siteInfo();
  const response = await requestService("/api/emails", {
    from_email: fromAddress(info),
    to,
    subject,
    html,
    text,
  });

  if (!response.ok) {
    const detail = await readDetail(response);
    throw new Error(`Почтовый сервис отклонил письмо (${response.status}): ${detail}`);
  }
}

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
  text: string,
  replyTo: string,
) {
  if (!legacyTransporter) {
    throw new Error("SMTP не настроен");
  }

  await legacyTransporter.sendMail({
    from: {
      name: "TrioZ",
      address: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "info@trioz.ru",
    },
    to,
    subject,
    text,
    html,
    replyTo,
    headers: {
      "X-Mailer": "TrioZ Services Portal",
      "X-Priority": "1",
    },
  });
}

export async function sendLeadNotification(lead: LeadNotification) {
  const fromOverride = process.env.EMAIL_FROM;
  const to = process.env.LEADS_EMAIL_TO ?? "info@trioz.ru";

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

  const html = `
    <h2>Новая заявка TRIOZ</h2>
    <p><strong>Номер:</strong> ${escapeHtml(lead.id)}</p>
    <p><strong>Имя:</strong> ${escapeHtml(lead.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
    <p><strong>Телефон:</strong> ${escapeHtml(lead.phone)}</p>
    <p><strong>Компания:</strong> ${escapeHtml(lead.company || "—")}</p>
    <p><strong>Услуга:</strong> ${escapeHtml(lead.serviceTitle)} (${escapeHtml(lead.serviceSlug)})</p>
    <p><strong>Особенности / комментарии:</strong></p>
    <p>${escapeHtml(lead.message).replaceAll("\n", "<br />")}</p>
  `;

  // Основной проект использует почтовый сервис по HTTP. Лендинг делает то же
  // самое; прямой SMTP остаётся совместимым запасным путём для старых установок.
  if (useService) {
    if (fromOverride) {
      console.log(`[email] заявка: отправка через почтовый сервис, from=${fromOverride}, to=${to}`);
    } else {
      console.log(`[email] заявка: отправка через почтовый сервис, to=${to}`);
    }
    await sendViaService(to, `Новая заявка TRIOZ · ${lead.serviceTitle}`, html, text);
    return;
  }

  await sendViaSmtp(to, `Новая заявка TRIOZ · ${lead.serviceTitle}`, html, text, lead.email);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
