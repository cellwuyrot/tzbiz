import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkLoginRateLimit, clearLoginFailures, jsonError, loginRateLimitKey, recordLoginFailure, verifyCsrf } from "@/lib/security";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonError("Проверьте email и пароль.", 400);

  const key = loginRateLimitKey(request, parsed.data.email);
  const limit = checkLoginRateLimit(key);
  if (!limit.allowed) return jsonError("Слишком много попыток. Повторите позже.", 429, { "Retry-After": String(limit.retryAfter) });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    recordLoginFailure(key);
    return jsonError("Неверный email или пароль.", 401);
  }

  if (parsed.data.adminOnly && user.role !== "ADMIN") return jsonError("Этот вход доступен только администратору.", 403);

  clearLoginFailures(key);
  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
