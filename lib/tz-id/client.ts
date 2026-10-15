import * as oidc from "openid-client";
import { getTzIdConfig } from "./config";
import { openTzData } from "./crypto";
let cached:
  | { key: string; until: number; value: Promise<oidc.Configuration> }
  | undefined;
export function tzIdClient() {
  const config = getTzIdConfig();
  const key = JSON.stringify([config.issuer, config.clientId, config.secret]);
  if (cached?.key === key && cached.until > Date.now()) return cached.value;
  const value = oidc
    .discovery(
      new URL(config.issuer),
      config.clientId,
      { id_token_signed_response_alg: "RS256" },
      oidc.ClientSecretBasic(config.secret),
      { timeout: 10 },
    )
    .then((client) => {
      oidc.enableNonRepudiationChecks(client);
      return client;
    });
  cached = { key, until: Date.now() + 300_000, value };
  value.catch(() => {
    if (cached?.value === value) cached = undefined;
  });
  return value;
}
export async function isActiveTzSession(session: {
  tzIssuer: string | null;
  tzSubject: string | null;
  tzAccessTokenEncrypted: string | null;
}) {
  try {
    const config = getTzIdConfig();
    if (
      !session.tzAccessTokenEncrypted ||
      session.tzIssuer !== config.issuer ||
      !session.tzSubject
    )
      return false;
    const token = openTzData<string>(session.tzAccessTokenEncrypted);
    const result = await oidc.tokenIntrospection(await tzIdClient(), token);
    return (
      result.active === true &&
      result.sub === session.tzSubject &&
      (!result.client_id || result.client_id === config.clientId)
    );
  } catch {
    return null;
  }
}
