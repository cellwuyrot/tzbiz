/** Only fixed allowlisted codes reach logs. Never log the error object or provider response. */
export type TzCallbackStage =
  | "transaction_cookie" | "transaction_decode" | "link_session" | "state_check"
  | "client_discovery" | "code_exchange" | "identity_claims" | "userinfo"
  | "token_expiry" | "resolve_identity" | "create_session" | "project_role" | "redirect";
const oauthCodes = new Set([
  "invalid_scope", "invalid_client", "invalid_grant", "invalid_request",
  "access_denied", "unauthorized_client", "server_error", "temporarily_unavailable",
  "login_required", "consent_required", "interaction_required",
]);
const libraryCodes = new Set([
  "OAUTH_RESPONSE_BODY_ERROR", "OAUTH_AUTHORIZATION_RESPONSE_ERROR",
  "OAUTH_INVALID_RESPONSE", "OAUTH_JWT_CLAIM_COMPARISON_FAILED",
  "OAUTH_JWT_TIMESTAMP_CHECK_FAILED", "OAUTH_KEY_SELECTION_FAILED",
  "OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED", "OAUTH_TIMEOUT",
]);
export function tzCallbackReason(error: unknown): string {
  if (!error || typeof error !== "object") return "REJECTED";
  const e = error as { message?: unknown; code?: unknown; error?: unknown; cause?: { error?: unknown; code?: unknown } };
  const messages: Record<string, string> = {
    "Missing transaction": "TRANSACTION_COOKIE_MISSING",
    "Expired transaction": "TRANSACTION_EXPIRED",
    "Invalid state": "STATE_OR_TRANSACTION_EXPIRED",
    "Transaction already consumed": "TRANSACTION_REPLAYED",
    "Linking session changed": "LINK_SESSION_CHANGED",
    "Explicit account linking required": "EXPLICIT_LINK_REQUIRED",
    "Verified email required": "VERIFIED_EMAIL_REQUIRED",
    "Identity already linked": "IDENTITY_ALREADY_LINKED",
    "Account already linked": "ACCOUNT_ALREADY_LINKED",
    "Missing identity": "IDENTITY_CLAIMS_INVALID",
    "Identity mismatch": "USERINFO_SUB_MISMATCH",
    "Expired token": "TOKEN_EXPIRED",
    "TZ ID is not configured": "CONFIG_INVALID",
    "TZ ID encryption is not configured": "TOKEN_KEY_INVALID",
  };
  if (typeof e.message === "string" && Object.hasOwn(messages, e.message)) return messages[e.message];
  if (e.code === "P2021") return "DATABASE_TABLE_MISSING";
  if (e.code === "P2022") return "DATABASE_COLUMN_MISSING";
  if (e.code === "P2002") return "DATABASE_UNIQUE_CONFLICT";
  for (const candidate of [e.error, e.cause?.error, e.code, e.cause?.code]) {
    if (typeof candidate === "string" && (oauthCodes.has(candidate) || libraryCodes.has(candidate))) return candidate;
  }
  return "REJECTED";
}
export function logTzCallbackFailure(stage: TzCallbackStage, error: unknown) {
  console.warn("[tz-id] callback_failed", { stage, reason: tzCallbackReason(error) });
}
