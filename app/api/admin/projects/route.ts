import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { savePreview } from "@/lib/uploads";
import { projectSchema } from "@/lib/validation";

export const runtime = "nodejs";

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

async function parseProjectForm(form: FormData) {
  const raw = {
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? ""),
    projectUrl: String(form.get("projectUrl") ?? ""),
    status: String(form.get("status") ?? "IN_PROGRESS"),
    isPublic: parseBoolean(form.get("isPublic")),
    clientId: String(form.get("clientId") ?? "") || null,
  };
  return projectSchema.safeParse(raw);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || undefined;
  const status = searchParams.get("status") as "IN_PROGRESS" | "DONE" | "SUPPORT" | null;
  const projects = await prisma.project.findMany({
    where: { clientId, ...(status && ["IN_PROGRESS", "DONE", "SUPPORT"].includes(status) ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { client: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const form = await request.formData();
  const parsed = await parseProjectForm(form);
  if (!parsed.success) return jsonError("Проверьте поля проекта и URL.", 400);
  const file = form.get("preview");
  if (!(file instanceof File)) return jsonError("Добавьте превью проекта.", 400);

  let previewPath = "";
  try {
    previewPath = (await savePreview(file)).path;
    if (parsed.data.clientId) {
      const client = await prisma.user.findFirst({ where: { id: parsed.data.clientId, role: "CLIENT" }, select: { id: true } });
      if (!client) return jsonError("Выбранный клиент не найден.", 400);
    }
    const project = await prisma.project.create({ data: { ...parsed.data, previewPath }, include: { client: { select: { id: true, name: true, email: true } } } });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (previewPath) await import("@/lib/uploads").then(({ removePreview }) => removePreview(previewPath));
    if (error instanceof Error && (error.message.includes("Разрешены только") || error.message.includes("Расширение") || error.message.includes("Размер") || error.message.includes("формату изображения") || error.message.includes("Превью проекта"))) return jsonError(error.message, 400);
    throw error;
  }
}
