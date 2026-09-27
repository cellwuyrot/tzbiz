import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";

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
  return process.env.SESSION_SECRET;
}

export async function createSession(userId: string) {
  sessionSecret();
  const raw = `${crypto.randomBytes(32).toString("hex")}.${crypto.randomBytes(16).toString("hex")}`;
  const id = sessionHash(raw);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, raw, sessionCookieOptions);
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
  const session = await prisma.session.findUnique({ where: { id: sessionHash(raw) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}

export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
  return user;
}
