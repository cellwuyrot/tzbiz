import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { removePreview, savePreview } from "@/lib/uploads";
import { projectIdSchema, projectSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

async function parseProjectForm(form: FormData) {
  return projectSchema.safeParse({
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? ""),
    projectUrl: String(form.get("projectUrl") ?? ""),
    status: String(form.get("status") ?? "IN_PROGRESS"),
    isPublic: parseBoolean(form.get("isPublic")),
    clientId: String(form.get("clientId") ?? "") || null,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  const idParsed = projectIdSchema.safeParse({ id });
  if (!idParsed.success) return jsonError("Проект не найден.", 404);
  const form = await request.formData();
  const parsed = await parseProjectForm(form);
  if (!parsed.success) return jsonError("Проверьте поля проекта и URL.", 400);

  const current = await prisma.project.findUnique({ where: { id } });
  if (!current) return jsonError("Проект не найден.", 404);
  if (parsed.data.clientId) {
    const client = await prisma.user.findFirst({ where: { id: parsed.data.clientId, role: "CLIENT" }, select: { id: true } });
    if (!client) return jsonError("Выбранный клиент не найден.", 400);
  }

  const file = form.get("preview");
  let nextPreviewPath = current.previewPath;
  let replacedPreviewPath: string | null = null;
  try {
    if (file instanceof File && file.size > 0) {
      const saved = await savePreview(file);
      nextPreviewPath = saved.path;
      replacedPreviewPath = current.previewPath;
    }
    const project = await prisma.project.update({ where: { id }, data: { ...parsed.data, previewPath: nextPreviewPath }, include: { client: { select: { id: true, name: true, email: true } } } });
    if (replacedPreviewPath) await removePreview(replacedPreviewPath);
    return NextResponse.json({ project });
  } catch (error) {
    if (nextPreviewPath !== current.previewPath) await removePreview(nextPreviewPath);
    if (error instanceof Error && (error.message.includes("Разрешены только") || error.message.includes("Расширение") || error.message.includes("Размер") || error.message.includes("формату изображения") || error.message.includes("Превью проекта"))) return jsonError(error.message, 400);
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { previewPath: true } });
  if (!project) return jsonError("Проект не найден.", 404);
  await prisma.project.delete({ where: { id } });
  await removePreview(project.previewPath);
  return NextResponse.json({ ok: true });
}
