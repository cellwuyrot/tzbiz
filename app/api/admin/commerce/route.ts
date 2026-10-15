import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { commerceInput, getCommerceSettings } from "@/lib/commerce";
import { verifyCsrf, jsonError } from "@/lib/security";
export async function GET() {
  const a = await requireApiRole("ADMIN");
  if (a.response) return a.response;
  return NextResponse.json(
    { settings: await getCommerceSettings() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function PUT(r: NextRequest) {
  const a = await requireApiRole("ADMIN");
  if (a.response) return a.response;
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const p = commerceInput.safeParse(await r.json().catch(() => null));
  if (!p.success) return jsonError(p.error.issues[0].message, 400);
  const { revision, ...data } = p.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (revision === 0) {
        const existing = await tx.commerceSettings.findUnique({
          where: { id: "commerce" },
        });
        if (existing) return false;
        await tx.commerceSettings.create({ data: { id: "commerce", ...data } });
        return true;
      }
      const u = await tx.commerceSettings.updateMany({
        where: { id: "commerce", revision },
        data: { ...data, revision: { increment: 1 } },
      });
      return u.count === 1;
    });
    if (!result)
      return jsonError("Настройки изменились. Обновите страницу.", 409);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Не удалось сохранить настройки. Обновите страницу.", 409);
  }
}
