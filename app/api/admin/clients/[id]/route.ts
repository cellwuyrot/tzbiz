import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { verifyCsrf, jsonError } from "@/lib/security";
import { clientUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = clientUpdateSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) return jsonError("Проверьте имя и email.", 400);

  try {
    const client = await prisma.user.update({ where: { id, role: "CLIENT" }, data: { name: parsed.data.name, email: parsed.data.email }, select: { id: true, email: true, name: true, role: true, createdAt: true } });
    return NextResponse.json({ client });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return jsonError("Пользователь с таким email уже существует.", 409);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return jsonError("Клиент не найден.", 404);
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  await prisma.user.delete({ where: { id, role: "CLIENT" } }).catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return undefined;
    throw error;
  });
  return NextResponse.json({ ok: true });
}
