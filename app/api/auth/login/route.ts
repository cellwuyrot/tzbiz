import { consumeRate, requestIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonError("Проверьте email и пароль.", 400);

  const ip = requestIp(request);
  const globalLimit = await consumeRate("login-ip", ip, 30, 900_000);
  const limit = await consumeRate(
    "login-account",
    `${ip}:${parsed.data.email}`,
    5,
    900_000,
  );
  if (!limit.allowed || !globalLimit.allowed)
    return jsonError("Слишком много попыток. Повторите позже.", 429, {
      "Retry-After": String(limit.retryAfter),
    });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (
    !user ||
    !(await bcrypt.compare(parsed.data.password, user.passwordHash))
  ) {
    return jsonError("Неверный email или пароль.", 401);
  }

  if (parsed.data.adminOnly && user.role !== "ADMIN")
    return jsonError("Этот вход доступен только администратору.", 403);

  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
