import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { planInputSchema } from "@/lib/billing/plan";
import { saveBillingPlan } from "@/lib/billing/admin";
import { jsonError, verifyCsrf } from "@/lib/security";
export const runtime = "nodejs";
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  try {
    const [plans, services] = await Promise.all([
      prisma.billingPlan.findMany({
        orderBy: { updatedAt: "desc" },
        include: { service: { select: { title: true, slug: true } } },
      }),
      prisma.service.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, isPublished: true },
      }),
    ]);
    return NextResponse.json(
      {
        plans,
        services,
        checkoutEnabled: false,
        reason:
          "Это каталог тарифов. Эквайринг, списания и выдача Premium / «Надёжное соединение» пока не подключены.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return jsonError("Не удалось загрузить тарифы. Проверьте миграции.", 500);
  }
}
export async function POST(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const parsed = planInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message || "Проверьте поля тарифа.",
      400,
    );
  try {
    const result = await saveBillingPlan(parsed.data, auth.user!.id);
    if (result.invalidService)
      return jsonError(
        "Выберите существующую услугу; для публикации услуга тоже должна быть опубликована.",
        400,
      );
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return jsonError("Не удалось сохранить тариф.", 500);
  }
}
