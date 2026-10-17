import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { savePreview, removeUpload } from "@/lib/uploads";
import { verifyCsrf, jsonError } from "@/lib/security";
import { diagnosticResponse } from "@/lib/diagnostics";
export async function POST(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success)
    return jsonError("Карточка не найдена.", 404);
  let uploaded: Awaited<ReturnType<typeof savePreview>> | undefined;
  try {
    const form = await r.formData(),
      file = form.get("image"),
      revision = Number(form.get("revision"));
    if (!(file instanceof File) || !Number.isInteger(revision) || revision < 1)
      return jsonError("Выберите изображение и версию карточки.", 400);
    const plan = await prisma.billingPlan.findUnique({ where: { id } });
    if (!plan) return jsonError("Карточка не найдена.", 404);
    if (plan.revision !== revision)
      return jsonError("Карточка изменена. Обновите список.", 409);
    try {
      uploaded = await savePreview(file);
    } catch (e) {
      return jsonError(
        e instanceof Error ? e.message : "Некорректное изображение.",
        400,
      );
    }
    const path = uploaded.path;
    const changed = await prisma.$transaction(async (tx) => {
      const n = await tx.billingPlan.updateMany({
        where: { id, revision },
        data: { cardImageUrl: path, revision: { increment: 1 } },
      });
      if (n.count !== 1) return false;
      const next = await tx.billingPlan.findUniqueOrThrow({ where: { id } });
      await tx.billingPlanAudit.create({
        data: {
          planId: id,
          actorId: auth.user!.id,
          revision: next.revision,
          snapshot: JSON.stringify(next),
        },
      });
      return true;
    });
    if (!changed) {
      await removeUpload(path);
      return jsonError("Карточка изменена. Обновите список.", 409);
    }
    return NextResponse.json({ ok: true, path, revision: revision + 1 });
  } catch (e) {
    if (uploaded) await removeUpload(uploaded.path);
    return diagnosticResponse("catalog.image", e);
  }
}
