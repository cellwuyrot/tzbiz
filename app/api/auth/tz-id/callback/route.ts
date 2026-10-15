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
  try {
    if (!raw) throw new Error("Missing transaction");
    const transaction = readTzTransaction(raw);
    if (
      transaction.localUserId &&
      (await getCurrentUser())?.id !== transaction.localUserId
    )
      throw new Error("Linking session changed");
    await consumeTzTransaction(
      transaction,
      request.nextUrl.searchParams.get("state"),
    );
    const config = getTzIdConfig(),
      client = await tzIdClient();
    const callback = new URL(config.callbackUrl);
    callback.search = request.nextUrl.search;
    const token = await oidc.authorizationCodeGrant(client, callback, {
      pkceCodeVerifier: transaction.verifier,
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      idTokenExpected: true,
    });
    const claims = token.claims();
    if (!claims?.sub || claims.iss !== config.issuer)
      throw new Error("Missing identity");
    const info = await oidc.fetchUserInfo(
      client,
      token.access_token,
      claims.sub,
    );
    if (info.sub !== claims.sub) throw new Error("Identity mismatch");
    const seconds = Math.min(
      300,
      Number(token.expires_in ?? 300),
      Math.floor(claims.exp - Date.now() / 1000),
    );
    if (!Number.isFinite(seconds) || seconds < 1)
      throw new Error("Expired token");
    const user = await resolveTzIdentity(
      config.issuer,
      claims.sub,
      info,
      transaction.localUserId,
    );
    await createSession(user.id, {
      maxAge: seconds,
      tzIssuer: config.issuer,
      tzSubject: claims.sub,
      tzAccessTokenEncrypted: sealTzData(token.access_token),
    });
    let destination = safeReturnTo(transaction.returnTo);
    if (destination === "/account") {
      const role = await readTzProjectRole({ tzIssuer: config.issuer, tzSubject: claims.sub, tzAccessTokenEncrypted: sealTzData(token.access_token) });
      if (role === "ADMIN") destination = "/admin";
    }
    return NextResponse.redirect(new URL(destination, SITE_URL));
  } catch {
    // No tokens, raw provider errors, email or credentials in logs/public responses.
    return NextResponse.redirect(new URL("/plans?auth=failed", SITE_URL));
  }
}
