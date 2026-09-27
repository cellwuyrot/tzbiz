import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { leadIdSchema, leadStatusSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  if (!leadIdSchema.safeParse({ id }).success) return jsonError("Заявка не найдена.", 404);
  const body = await request.json().catch(() => null);
  const parsed = leadStatusSchema.safeParse(body?.status);
  if (!parsed.success) return jsonError("Недопустимый статус заявки.", 400);
  const lead = await prisma.leadRequest.update({ where: { id }, data: { status: parsed.data }, include: { service: { select: { slug: true, title: true } } } }).catch(() => null);
  if (!lead) return jsonError("Заявка не найдена.", 404);
  return NextResponse.json({ lead });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  if (!leadIdSchema.safeParse({ id }).success) return jsonError("Заявка не найдена.", 404);
  await prisma.leadRequest.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
