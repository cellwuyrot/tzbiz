export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    /[\\\r\n]/.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "/account";
  const url = new URL(value, "https://business.trioz.ru");
  return /^(\/plans(?:\/[a-zA-Z0-9-]+)?|\/account|\/services\/[a-z0-9-]+)$/.test(
    url.pathname,
  )
    ? `${url.pathname}${url.search}`
    : "/account";
}
