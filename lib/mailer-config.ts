import { z } from "zod";
const address = z.string().trim().email().max(254);
export class MailConfigurationError extends Error {
  code = "CONFIG";
  constructor() {
    super("Mail configuration is invalid.");
  }
}
export function mailConfigSnapshot() {
  const host = process.env.SMTP_HOST?.trim() || "";
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS || "";
  const port = Number(process.env.SMTP_PORT ?? 465);
  const rawSecure = process.env.SMTP_SECURE;
  const validSecure =
    rawSecure === undefined || rawSecure === "true" || rawSecure === "false";
  const secure = rawSecure === undefined ? port === 465 : rawSecure === "true";
  const rawAddresses = {
    from: process.env.EMAIL_FROM ?? "union@business.trioz.ru",
    internalTo: process.env.LEADS_EMAIL_TO ?? "info@trioz.ru",
    replyTo: process.env.EMAIL_REPLY_TO ?? "info@trioz.ru",
  };
  const parsed = Object.fromEntries(
    Object.entries(rawAddresses).map(([key, value]) => [
      key,
      address.safeParse(value),
    ]),
  );
  const missingKeys = [
    !host && "SMTP_HOST",
    !user && "SMTP_USER",
    !pass && "SMTP_PASS",
  ].filter((key): key is string => Boolean(key));
  const invalidKeys: string[] = [];
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    invalidKeys.push("SMTP_PORT");
  if (!validSecure) invalidKeys.push("SMTP_SECURE");
  if (/[\r\n]/.test(host)) invalidKeys.push("SMTP_HOST");
  if (host === "smtp.example.com") invalidKeys.push("SMTP_HOST (пример)");
  if (user === "smtp-account@example.com")
    invalidKeys.push("SMTP_USER (пример)");
  if (pass === "replace-with-mailbox-password")
    invalidKeys.push("SMTP_PASS (пример)");
  for (const [name, key] of [
    ["from", "EMAIL_FROM"],
    ["internalTo", "LEADS_EMAIL_TO"],
    ["replyTo", "EMAIL_REPLY_TO"],
  ]) {
    if (!parsed[name].success) invalidKeys.push(key);
  }
  return {
    configured: missingKeys.length === 0 && invalidKeys.length === 0,
    missingKeys,
    invalidKeys,
    hostConfigured: Boolean(host),
    userConfigured: Boolean(user),
    passwordConfigured: Boolean(pass),
    port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : null,
    tlsMode: validSecure ? (secure ? "TLS" : "STARTTLS") : null,
    from: parsed.from.success ? parsed.from.data : null,
    internalTo: parsed.internalTo.success ? parsed.internalTo.data : null,
    replyTo: parsed.replyTo.success ? parsed.replyTo.data : null,
  };
}
export type MailConfigSnapshot = ReturnType<typeof mailConfigSnapshot>;
export function getMailConfig() {
  const summary = mailConfigSnapshot();
  if (
    !summary.configured ||
    !summary.from ||
    !summary.internalTo ||
    !summary.replyTo ||
    !summary.port
  )
    throw new MailConfigurationError();
  return {
    host: process.env.SMTP_HOST!.trim(),
    user: process.env.SMTP_USER!.trim(),
    pass: process.env.SMTP_PASS!,
    port: summary.port,
    secure: summary.tlsMode === "TLS",
    from: summary.from,
    internalTo: summary.internalTo,
    replyTo: summary.replyTo,
  };
}
