import * as oidc from "openid-client";
import { prisma } from "../db";
import { getTzIdConfig } from "./config";
import { tzIdClient } from "./client";
import { openTzData, sealTzData } from "./crypto";
export type RefreshableSession = {
  id?: string; expiresAt?: Date; tzIssuer: string | null; tzSubject: string | null;
  tzAccessTokenEncrypted: string | null; tzAccessTokenExpiresAt?: Date | null;
  tzRefreshTokenEncrypted?: string | null; tzRefreshLockUntil?: Date | null;
};
const pending = new Map<string, Promise<boolean | null>>();
/** null = temporary unavailability: deny this request, preserve the session. false = new login required. */
export async function ensureFreshTzSession(session: RefreshableSession): Promise<boolean | null> {
  if (session.expiresAt && session.expiresAt <= new Date()) return false;
  if (!session.tzAccessTokenExpiresAt) return true; // Pre-upgrade session: original bounded expiry remains in force.
  if (session.tzAccessTokenExpiresAt.getTime() > Date.now() + 45_000 && !session.tzRefreshLockUntil) return true;
  if (!session.id || !session.expiresAt || session.expiresAt <= new Date()) return false;
  const existing = pending.get(session.id);
  if (existing) {
    const result = await existing;
    if (result === true) { const fresh = await prisma.session.findUnique({ where: { id: session.id } }); if (!fresh) return false; Object.assign(session, fresh); }
    return result;
  }
  const work = refresh(session);
  pending.set(session.id, work);
  try { return await work; } finally { if (pending.get(session.id) === work) pending.delete(session.id); }
}
async function refresh(session: RefreshableSession): Promise<boolean | null> {
  if (session.tzAccessTokenExpiresAt && session.tzAccessTokenExpiresAt.getTime() > Date.now() + 45_000 && !session.tzRefreshLockUntil) return true;
  const id = session.id!;
  const config = getTzIdConfig();
  if (session.tzIssuer !== config.issuer || !session.tzSubject) return false;
  // Another server worker owns a rotation. Read only; NEVER replay its old refresh token.
  if (session.tzRefreshLockUntil) {
    if (session.tzRefreshLockUntil <= new Date()) return false;
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const fresh = await prisma.session.findUnique({ where: { id } });
      if (!fresh || fresh.expiresAt <= new Date()) return false;
      if (!fresh.tzRefreshLockUntil) { Object.assign(session, fresh); return ensureFreshTzSessionWithoutPending(session); }
      if (fresh.tzRefreshLockUntil <= new Date()) return false;
    }
    return null;
  }
  if (!session.tzRefreshTokenEncrypted) {
    // No refresh grant: honour only the original token lifetime.
    return !!session.tzAccessTokenExpiresAt && session.tzAccessTokenExpiresAt > new Date();
  }
  // Discovery can fail without consuming a token. Perform it before claiming the one-time credential.
  let client: oidc.Configuration;
  try { client = await tzIdClient(); } catch { return null; }
  const old = session.tzRefreshTokenEncrypted;
  const lockUntil = new Date(Date.now() + 45_000);
  // Durable consume-before-send: even after a process crash the old token cannot be retried and revoke the whole grant.
  const claimed = await prisma.session.updateMany({ where: { id, expiresAt: { gt: new Date() }, tzRefreshTokenEncrypted: old, tzRefreshLockUntil: null }, data: { tzRefreshTokenEncrypted: null, tzRefreshLockUntil: lockUntil } });
  if (claimed.count !== 1) {
    const fresh = await prisma.session.findUnique({ where: { id } });
    if (!fresh) return false;
    Object.assign(session, fresh);
    return refresh(session);
  }
  try {
    const oldToken = openTzData<string>(old);
    const tokens = await oidc.refreshTokenGrant(client, oldToken);
    const seconds = Number(tokens.expires_in);
    if (!tokens.access_token || !tokens.refresh_token || tokens.refresh_token === oldToken || !Number.isFinite(seconds) || seconds < 1 || seconds > 86400) return false;
    const info = await oidc.tokenIntrospection(client, tokens.access_token);
    if (info.active !== true || info.sub !== session.tzSubject || (info.client_id && info.client_id !== config.clientId)) return false;
    const data = { tzAccessTokenEncrypted: sealTzData(tokens.access_token), tzRefreshTokenEncrypted: sealTzData(tokens.refresh_token), tzAccessTokenExpiresAt: new Date(Date.now() + seconds * 1000), tzRefreshLockUntil: null };
    const saved = await prisma.session.updateMany({ where: { id, expiresAt: { gt: new Date() }, tzRefreshLockUntil: lockUntil, tzRefreshTokenEncrypted: null }, data });
    if (saved.count !== 1) return false; // Logout/deletion wins. Never recreate the session.
    Object.assign(session, data);
    return true;
  } catch (error) {
    // A definitive rejection requires new login. A lost response is ambiguous: keep the tombstone and never replay.
    if (error instanceof oidc.ResponseBodyError && error.error === "invalid_grant") return false;
    return null;
  }
}
function ensureFreshTzSessionWithoutPending(session: RefreshableSession): boolean | null {
  return session.tzAccessTokenExpiresAt && session.tzAccessTokenExpiresAt > new Date() ? true : false;
}
