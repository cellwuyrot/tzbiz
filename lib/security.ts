import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE = "trioz_csrf";
const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export const csrfCookieName = CSRF_COOKIE;

export function makeToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function issueCsrfCookie(response: NextResponse) {
  const token = makeToken();
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return token;
}

export function verifyCsrf(request: NextRequest) {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function loginRateLimitKey(request: NextRequest, email: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${email.toLowerCase()}`;
}

export function checkLoginRateLimit(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) return { allowed: true, retryAfter: 0 };
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(key: string) {
  loginAttempts.delete(key);
}

export function jsonError(message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}
