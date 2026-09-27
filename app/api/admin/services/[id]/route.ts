import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { saveUploadedMedia, removeUpload } from "@/lib/uploads";
import { serializeStringList, toServiceView } from "@/lib/service-content";
import { serviceIdSchema, serviceSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

function parseList(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseServiceForm(form: FormData) {
  return serviceSchema.safeParse({
    slug: String(form.get("slug") ?? ""),
    title: String(form.get("title") ?? ""),
    shortDescription: String(form.get("shortDescription") ?? ""),
    fullDescription: String(form.get("fullDescription") ?? ""),
    includes: parseList(form.get("includes")),
    stages: parseList(form.get("stages")),
    sortOrder: Number(form.get("sortOrder") ?? 0),
    isPublished: parseBoolean(form.get("isPublished")),
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);

  const { id } = await params;
  if (!serviceIdSchema.safeParse({ id }).success) return jsonError("Услуга не найдена.", 404);

  const current = await prisma.service.findUnique({ where: { id }, include: { media: true } });
  if (!current) return jsonError("Услуга не найдена.", 404);

  const form = await request.formData();
  const parsed = parseServiceForm(form);
  if (!parsed.success) return jsonError("Проверьте поля услуги, списки и порядок.", 400);

  const duplicate = await prisma.service.findFirst({ where: { slug: parsed.data.slug, id: { not: id } }, select: { id: true } });
  if (duplicate) return jsonError("Услуга с таким slug уже существует.", 409);

  const files = form.getAll("media").filter((item): item is File => item instanceof File && item.size > 0);
  const saved: Awaited<ReturnType<typeof saveUploadedMedia>>[] = [];
  try {
    for (const file of files) saved.push(await saveUploadedMedia(file));
    const nextSortStart = current.media.reduce((max, item) => Math.max(max, item.sortOrder), 0);
    const service = await prisma.service.update({
      where: { id },
      data: {
        ...parsed.data,
        includes: serializeStringList(parsed.data.includes),
        stages: serializeStringList(parsed.data.stages),
        media: saved.length
          ? { create: saved.map((item, index) => ({ type: item.kind, path: item.path, sortOrder: nextSortStart + index + 1 })) }
          : undefined,
      },
      include: { media: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ service: toServiceView(service) });
  } catch (error) {
    await Promise.all(saved.map((item) => removeUpload(item.path)));
    if (error instanceof Error && (error.message.includes("Разрешены только") || error.message.includes("Размер") || error.message.includes("MIME") || error.message.includes("Расширение") || error.message.includes("формату изображения"))) {
      return jsonError(error.message, 400);
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);

  const { id } = await params;
  if (!serviceIdSchema.safeParse({ id }).success) return jsonError("Услуга не найдена.", 404);

  const service = await prisma.service.findUnique({ where: { id }, include: { media: true } });
  if (!service) return jsonError("Услуга не найдена.", 404);

  await prisma.service.delete({ where: { id } });
  await Promise.all(service.media.map((item) => removeUpload(item.path)));
  return NextResponse.json({ ok: true });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!serviceIdSchema.safeParse({ id }).success) return jsonError("Услуга не найдена.", 404);
  const service = await prisma.service.findUnique({
    where: { id },
    include: { media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!service) return jsonError("Услуга не найдена.", 404);
  return NextResponse.json({
    service: toServiceView(service),
  });
}
