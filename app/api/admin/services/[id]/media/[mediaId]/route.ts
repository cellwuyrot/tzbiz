import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { removeUpload } from "@/lib/uploads";
import { mediaIdSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; mediaId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);

  const { id, mediaId } = await params;
  if (!mediaIdSchema.safeParse({ id: mediaId }).success) return jsonError("Медиафайл не найден.", 404);
  const body = await request.json().catch(() => null);
  const sortOrder = Number(body?.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) {
    return jsonError("Порядок медиа должен быть целым числом от 0 до 100000.", 400);
  }

  const media = await prisma.serviceMedia.findFirst({ where: { id: mediaId, serviceId: id } });
  if (!media) return jsonError("Медиафайл не найден.", 404);

  const updated = await prisma.serviceMedia.update({
    where: { id: mediaId },
    data: { sortOrder },
  });
  return NextResponse.json({ media: updated });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);

  const { id, mediaId } = await params;
  if (!mediaIdSchema.safeParse({ id: mediaId }).success) return jsonError("Медиафайл не найден.", 404);

  const media = await prisma.serviceMedia.findFirst({ where: { id: mediaId, serviceId: id } });
  if (!media) return jsonError("Медиафайл не найден.", 404);

  await prisma.serviceMedia.delete({ where: { id: mediaId } });
  await removeUpload(media.path);
  return NextResponse.json({ ok: true });
}
