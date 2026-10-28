import {
  logTzCallbackFailure,
  type TzCallbackStage,
} from "@/lib/tz-id/diagnostics";
import { readTzProjectRole } from "@/lib/tz-id/project-role";
import { safeReturnTo } from "@/lib/return-to";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as oidc from "openid-client";
import { createSession, getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site-url";
import { getTzIdConfig } from "@/lib/tz-id/config";
import { tzIdClient } from "@/lib/tz-id/client";
import { sealTzData } from "@/lib/tz-id/crypto";
import {
  TZ_TRANSACTION_COOKIE,
  readTzTransaction,
  consumeTzTransaction,
  resolveTzIdentity,
} from "@/lib/tz-id/flow";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const store = await cookies();
  const raw = store.get(TZ_TRANSACTION_COOKIE)?.value;
  store.set(TZ_TRANSACTION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/tz-id",
    maxAge: 0,
  });
  let stage: TzCallbackStage = "transaction_cookie";
  try {
    if (!raw) throw new Error("Missing transaction");
    stage = "transaction_decode";
    const transaction = readTzTransaction(raw);
    stage = "link_session";
    if (
      transaction.localUserId &&
      (await getCurrentUser())?.id !== transaction.localUserId
    )
      throw new Error("Linking session changed");
    stage = "state_check";
    await consumeTzTransaction(
      transaction,
      request.nextUrl.searchParams.get("state"),
    );
    stage = "client_discovery";
    const config = getTzIdConfig(),
      client = await tzIdClient();
    const callback = new URL(config.callbackUrl);
    callback.search = request.nextUrl.search;
    stage = "code_exchange";
    const token = await oidc.authorizationCodeGrant(client, callback, {
      pkceCodeVerifier: transaction.verifier,
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      idTokenExpected: true,
    });
    stage = "identity_claims";
    const claims = token.claims();
    if (!claims?.sub || claims.iss !== config.issuer)
      throw new Error("Missing identity");
    stage = "userinfo";
    const info = await oidc.fetchUserInfo(
      client,
      token.access_token,
      claims.sub,
    );
    if (info.sub !== claims.sub) throw new Error("Identity mismatch");
    stage = "token_expiry";
    const seconds = Math.min(
      300,
      Number(token.expires_in ?? 300),
      Math.floor(claims.exp - Date.now() / 1000),
    );
    if (!Number.isFinite(seconds) || seconds < 1)
      throw new Error("Expired token");
    stage = "resolve_identity";
    const user = await resolveTzIdentity(
      config.issuer,
      claims.sub,
      info,
      transaction.localUserId,
    );
    stage = "create_session";
    await createSession(user.id, {
      maxAge: seconds,
      tzIssuer: config.issuer,
      tzSubject: claims.sub,
      tzAccessTokenEncrypted: sealTzData(token.access_token),
      tzAccessTokenExpiresAt: new Date(Date.now() + seconds * 1000),
      ...(token.refresh_token && process.env.TZ_ID_OFFLINE_ACCESS === "1" ? { tzRefreshTokenEncrypted: sealTzData(token.refresh_token) } : {}),
    });
    stage = "project_role";
    let destination = safeReturnTo(transaction.returnTo);
    if (destination === "/account") {
      const role = await readTzProjectRole({
        tzIssuer: config.issuer,
        tzSubject: claims.sub,
        tzAccessTokenEncrypted: sealTzData(token.access_token),
      });
      if (role === "ADMIN") destination = "/admin";
    }
    stage = "redirect";
    return NextResponse.redirect(new URL(destination, SITE_URL));
  } catch (error) {
    // Log fixed codes only; never log error objects, URLs or provider payloads.
    logTzCallbackFailure(stage, error);
    return NextResponse.redirect(new URL("/plans?auth=failed", SITE_URL));
  }
}
