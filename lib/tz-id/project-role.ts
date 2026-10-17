import { getTzIdConfig } from "./config";
import { openTzData } from "./crypto";
/** Live client-scoped grant; never trust global roles, email, browser state or a stale local promotion. */
export async function readTzProjectRole(session: {
  tzIssuer: string | null;
  tzSubject: string | null;
  tzAccessTokenEncrypted: string | null;
}): Promise<"ADMIN" | "CLIENT"> {
  try {
    const config = getTzIdConfig();
    if (
      session.tzIssuer !== config.issuer ||
      !session.tzSubject ||
      !session.tzAccessTokenEncrypted
    )
      return "CLIENT";
    const token = openTzData<string>(session.tzAccessTokenEncrypted);
    const response = await fetch(`${config.issuer}/api/v1/project-role`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return "CLIENT";
    const data = await response.json();
    return data.sub === session.tzSubject &&
      data.clientId === config.clientId &&
      data.role === "ADMIN"
      ? "ADMIN"
      : "CLIENT";
  } catch {
    // A timeout/revocation removes effective admin access; never log credentials or token errors.
    return "CLIENT";
  }
}
