import { SITE_URL } from "../site-url";
export function tzIdConfigSnapshot() {
  const issuer = process.env.TZ_ID_ISSUER || "https://id.trioz.ru";
  const clientId = process.env.TZ_ID_CLIENT_ID?.trim() || "";
  const secret = process.env.TZ_ID_CLIENT_SECRET || "";
  const rawKey = process.env.TZ_ID_TOKEN_KEY || "";
  const missingKeys = [
    !clientId && "TZ_ID_CLIENT_ID",
    !secret && "TZ_ID_CLIENT_SECRET",
    !rawKey && "TZ_ID_TOKEN_KEY",
  ].filter((key): key is string => Boolean(key));
  const invalidKeys: string[] = [];
  if (issuer !== "https://id.trioz.ru") invalidKeys.push("TZ_ID_ISSUER");
  if (SITE_URL !== "https://business.trioz.ru")
    invalidKeys.push("NEXT_PUBLIC_APP_URL (Business HTTPS)");
  if (
    rawKey &&
    (!/^[A-Za-z0-9+/]{43}=$/.test(rawKey) ||
      Buffer.from(rawKey, "base64").length !== 32)
  )
    invalidKeys.push("TZ_ID_TOKEN_KEY");
  if (clientId.startsWith("replace-") || secret.startsWith("replace-"))
    invalidKeys.push("TZ_ID_CLIENT_ID/SECRET (пример)");
  return {
    configured: !missingKeys.length && !invalidKeys.length,
    issuer: "https://id.trioz.ru",
    callbackUrl: `${SITE_URL}/api/auth/tz-id/callback`,
    clientIdConfigured: Boolean(clientId),
    secretConfigured: Boolean(secret),
    missingKeys,
    invalidKeys,
  };
}
export function getTzIdConfig() {
  const summary = tzIdConfigSnapshot();
  if (!summary.configured) throw new Error("TZ ID is not configured");
  return {
    issuer: summary.issuer,
    clientId: process.env.TZ_ID_CLIENT_ID!.trim(),
    secret: process.env.TZ_ID_CLIENT_SECRET!,
    callbackUrl: summary.callbackUrl,
  };
}
