import bcrypt from "bcryptjs";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { beginTzLogin } from "@/lib/tz-id/flow";
import { verifyCsrf, jsonError, checkLoginRateLimit, recordLoginFailure, clearLoginFailures } from "@/lib/security";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Войдите в существующий аккаунт Business.", 401);
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const key = `tz-id-link:${user.id}`;
  if (!checkLoginRateLimit(key).allowed) return jsonError("Слишком много попыток подтверждения.", 429);
  const parsed = z.object({ currentPassword: z.string().min(10).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    recordLoginFailure(key);
    return jsonError("Подтвердите пароль текущего аккаунта Business.", 401);
  }
  clearLoginFailures(key);
  try { return NextResponse.json({ authorizationUrl: (await beginTzLogin(user.id)).href }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return jsonError("Связывание TZ ID недоступно. Проверьте настройки проекта.", 503); }
}
