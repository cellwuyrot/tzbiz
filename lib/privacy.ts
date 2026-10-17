export const CONSENT_COOKIE = "trioz_cookie_choice";
export const CONSENT_VERSION = "1";
export function readConsent(value: string | undefined) {
  const match = new RegExp(`^${CONSENT_VERSION}:yes:([a-f0-9]{64})$`).exec(
    value || "",
  );
  return {
    chosen: value === `${CONSENT_VERSION}:no` || !!match,
    analytics: !!match,
    policy: match?.[1] || null,
  };
}
export function privacySignal(headers: Headers) {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}
export function analyticsPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    value.includes("?") ||
    value.includes("#")
  )
    return null;
  if (
    [
      "/",
      "/plans",
      "/payment",
      "/agreement",
      "/privacy",
      "/documents",
    ].includes(value)
  )
    return value;
  if (
    /^\/plans\/c[a-z0-9]{24}$/.test(value) ||
    /^\/services\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
    /^\/documents\/(agreement|privacy|offer|cookies|consent)$/.test(value)
  )
    return value;
  return null;
}
