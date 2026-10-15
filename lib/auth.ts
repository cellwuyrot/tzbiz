import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";
import { isActiveTzSession } from "./tz-id/client";

export const SESSION_COOKIE = "trioz_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

function sessionHash(raw: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(raw).digest("hex");
}

function sessionSecret() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.SESSION_SECRET.length < 32 ||
      process.env.SESSION_SECRET.startsWith("replace-"))
  )
    throw new Error("Use a random SESSION_SECRET of at least 32 characters.");
  return process.env.SESSION_SECRET;
}

export async function createSession(
  userId: string,
  tz?: {
    maxAge: number;
    tzIssuer: string;
    tzSubject: string;
    tzAccessTokenEncrypted: string;
  },
) {
  sessionSecret();
  const raw = `${crypto.randomBytes(32).toString("hex")}.${crypto.randomBytes(16).toString("hex")}`;
  const id = sessionHash(raw);
  const maxAge = tz
    ? Math.max(1, Math.min(300, Math.floor(tz.maxAge)))
    : SESSION_MAX_AGE;
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  await prisma.session.create({
    data: {
      id,
      userId,
      expiresAt,
      ...(tz
        ? {
            tzIssuer: tz.tzIssuer,
            tzSubject: tz.tzSubject,
            tzAccessTokenEncrypted: tz.tzAccessTokenEncrypted,
          }
        : {}),
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, raw, { ...sessionCookieOptions, maxAge });
}

export async function destroySession() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) await prisma.session.deleteMany({ where: { id: sessionHash(raw) } });
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = await prisma.session.findUnique({
    where: { id: sessionHash(raw) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }
  const tzActive = session.tzIssuer ? await isActiveTzSession(session) : true;
  if (tzActive === null) return null; // Fail closed without deleting a potentially valid session.
  if (!tzActive) {
    await prisma.session
      .deleteMany({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }
  return session.user;
}

export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  if (user.role !== role)
    redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
  return user;
}
