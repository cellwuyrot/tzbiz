import { NextRequest, NextResponse } from "next/server";
import { diagnosticResponse } from "@/lib/diagnostics";
import { z } from "zod";
import { requireApiRole } from "@/lib/api-auth";
import { planInputSchema } from "@/lib/billing/plan";
import { saveBillingPlan } from "@/lib/billing/admin";
import { jsonError, verifyCsrf } from "@/lib/security";
export const runtime = "nodejs";
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success)
    return jsonError("Тариф не найден.", 404);
  const body = await request.json().catch(() => null);
  const parsed = planInputSchema.safeParse(body),
    revision = z.number().int().positive().safeParse(body?.revision);
  if (!parsed.success || !revision.success)
    return jsonError(
      parsed.success
        ? "Требуется версия тарифа."
        : parsed.error.issues[0]?.message || "Проверьте поля тарифа.",
      400,
    );
  try {
    const result = await saveBillingPlan(parsed.data, auth.user!.id, {
      id,
      revision: revision.data,
    });
    if (result.conflict)
      return jsonError(
        "Тариф изменён другим администратором или удалён. Обновите список.",
        409,
      );
    if (result.invalidService)
      return jsonError("Услуга отсутствует или не опубликована.", 400);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return diagnosticResponse("catalog.update", e);
  }
}
