import { safeReturnTo } from "../return-to";
import { cookies } from "next/headers";
import * as oidc from "openid-client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { getTzIdConfig } from "./config";
import { tzIdClient } from "./client";
import { openTzData, sealTzData, stateHash } from "./crypto";
export const TZ_TRANSACTION_COOKIE = "tz_business_oidc";
const transactionSchema = z.object({
  state: z.string().min(32).max(256),
  nonce: z.string().min(32).max(256),
  verifier: z.string().min(32).max(256),
  expiresAt: z.number().int(),
  localUserId: z.string().cuid().nullable(),
  returnTo: z.string().optional(),
});
export type TzTransaction = z.infer<typeof transactionSchema>;
export function readTzTransaction(value: string, now = Date.now()) {
  const transaction = transactionSchema.parse(openTzData<unknown>(value));
  if (transaction.expiresAt <= now) throw new Error("Expired transaction");
  return transaction;
}
export async function beginTzLogin(
  localUserId: string | null = null,
  returnTo = "/account",
) {
  const config = getTzIdConfig(),
    client = await tzIdClient();
  const transaction: TzTransaction = {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verifier: oidc.randomPKCECodeVerifier(),
    expiresAt: Date.now() + 600_000,
    localUserId,
    returnTo: safeReturnTo(returnTo),
  };
  await prisma.tzLoginAttempt.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 3600_000) } },
  });
  await prisma.tzLoginAttempt.create({
    data: {
      stateHash: stateHash(transaction.state),
      localUserId,
      expiresAt: new Date(transaction.expiresAt),
    },
  });
  const store = await cookies();
  store.set(TZ_TRANSACTION_COOKIE, sealTzData(transaction), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/tz-id",
    maxAge: 600,
  });
  return oidc.buildAuthorizationUrl(client, {
    response_type: "code",
    redirect_uri: config.callbackUrl,
    scope: "openid profile email roles:read",
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(transaction.verifier),
    code_challenge_method: "S256",
  });
}
export async function consumeTzTransaction(
  transaction: TzTransaction,
  callbackState: string | null,
) {
  if (
    callbackState !== transaction.state ||
    transaction.expiresAt <= Date.now()
  )
    throw new Error("Invalid state");
  const claimed = await prisma.tzLoginAttempt.updateMany({
    where: {
      stateHash: stateHash(transaction.state),
      consumedAt: null,
      expiresAt: { gt: new Date() },
      localUserId: transaction.localUserId,
    },
    data: { consumedAt: new Date() },
  });
  if (claimed.count !== 1) throw new Error("Transaction already consumed");
}
export async function resolveTzIdentity(
  issuer: string,
  subject: string,
  info: { name?: unknown; email?: unknown; email_verified?: unknown },
  localUserId: string | null,
) {
  const name = z.string().trim().min(1).max(120).safeParse(info.name);
  const email = z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase())
    .safeParse(info.email);
  const randomPasswordHash = await bcrypt.hash(
    crypto.randomBytes(48).toString("base64url"),
    12,
  );
  return prisma.$transaction(async (tx) => {
    const link = await tx.tzIdentityLink.findUnique({
      where: { issuer_subject: { issuer, subject } },
      include: { user: true },
    });
    if (link) {
      if (localUserId && link.userId !== localUserId)
        throw new Error("Identity already linked");
      return link.user;
    }
    if (localUserId) {
      const existing = await tx.tzIdentityLink.findUnique({
        where: { userId: localUserId },
      });
      if (existing) throw new Error("Account already linked");
      const user = await tx.user.findUniqueOrThrow({
        where: { id: localUserId },
      });
      await tx.tzIdentityLink.create({
        data: { userId: user.id, issuer, subject },
      });
      return user;
    }
    if (!email.success || info.email_verified !== true)
      throw new Error("Verified email required");
    // Never infer ownership of an existing Business account from matching email.
    if (await tx.user.findUnique({ where: { email: email.data } }))
      throw new Error("Explicit account linking required");
    const user = await tx.user.create({
      data: {
        name: name.success ? name.data : "Клиент TZ ID",
        email: email.data,
        passwordHash: randomPasswordHash,
        role: "CLIENT",
      },
    });
    await tx.tzIdentityLink.create({
      data: { userId: user.id, issuer, subject },
    });
    return user;
  });
}
