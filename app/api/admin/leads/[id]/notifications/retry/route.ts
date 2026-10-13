import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/api-auth";
import { retryLeadNotification } from "@/lib/lead-notifications";
import { prisma } from "@/lib/db";
import { leadIdSchema } from "@/lib/validation";
import { adminMailAllowed } from "@/lib/admin-mail-limit";
import { jsonError, verifyCsrf } from "@/lib/security";
export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
const schema = z.object({ channel: z.enum(["client", "internal"]), confirmDuplicateRisk: z.literal(true) });
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  if (!leadIdSchema.safeParse({ id }).success) return jsonError("Заявка не найдена.", 404);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Выберите канал и подтвердите риск повторного письма.", 400);
  if (!adminMailAllowed(auth.user!.id, "retry")) return jsonError("Лимит повторов: 3 за 10 минут.", 429);
  try {
    const outcome = await retryLeadNotification(id, parsed.data.channel);
    if (outcome.conflict) return jsonError("Канал уже принят SMTP, занят или повтор пока слишком ранний.", 409);
    if (outcome.missing) return jsonError("Заявка не найдена.", 404);
    const lead = await prisma.leadRequest.findUnique({ where: { id }, include: { service: { select: { slug: true, title: true } } } });
    return NextResponse.json({ ok: outcome.result?.status === "SMTP_ACCEPTED", ...outcome, lead }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return jsonError("Не удалось выполнить повтор. Проверьте состояние канала перед следующей попыткой.", 500); }
}
