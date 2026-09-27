import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { saveUploadedMedia, removeUpload } from "@/lib/uploads";
import { serviceSchema } from "@/lib/validation";
import { serializeStringList, toServiceView } from "@/lib/service-content";

export const runtime = "nodejs";

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

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  return NextResponse.json({ services: services.map(toServiceView) });
}

async function saveMediaFiles(files: File[]) {
  const saved: Awaited<ReturnType<typeof saveUploadedMedia>>[] = [];
  try {
    for (const file of files) {
      saved.push(await saveUploadedMedia(file));
    }
    return saved;
  } catch (error) {
    await Promise.all(saved.map((item) => removeUpload(item.path)));
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);

  const form = await request.formData();
  const parsed = parseServiceForm(form);
  if (!parsed.success) return jsonError("Проверьте поля услуги, списки и порядок.", 400);

  const duplicate = await prisma.service.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
  if (duplicate) return jsonError("Услуга с таким slug уже существует.", 409);

  const files = form.getAll("media").filter((item): item is File => item instanceof File && item.size > 0);
  let saved: Awaited<ReturnType<typeof saveUploadedMedia>>[] = [];
  try {
    saved = await saveMediaFiles(files);
    const service = await prisma.service.create({
      data: {
        ...parsed.data,
        includes: serializeStringList(parsed.data.includes),
        stages: serializeStringList(parsed.data.stages),
        media: {
          create: saved.map((item, index) => ({
            type: item.kind,
            path: item.path,
            sortOrder: index + 1,
          })),
        },
      },
      include: { media: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ service: toServiceView(service) }, { status: 201 });
  } catch (error) {
    await Promise.all(saved.map((item) => removeUpload(item.path)));
    if (error instanceof Error) {
      if (error.message.includes("Разрешены только") || error.message.includes("Размер") || error.message.includes("MIME") || error.message.includes("Расширение") || error.message.includes("формату изображения")) {
        return jsonError(error.message, 400);
      }
    }
    throw error;
  }
}

export async function PATCH(_request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  return NextResponse.json({ error: "Для изменения услуги используйте /api/admin/services/<id>." }, { status: 405 });
}
