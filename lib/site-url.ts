const configured = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://business.trioz.ru");
if (!["https:", "http:"].includes(configured.protocol) || configured.username || configured.password) {
  throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP(S) site URL without credentials.");
}
export const SITE_URL = configured.origin;
export const siteUrl = (path: string) => new URL(path, `${SITE_URL}/`).toString();
