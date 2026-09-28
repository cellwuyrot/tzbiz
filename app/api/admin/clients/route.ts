import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { verifyCsrf, jsonError } from "@/lib/security";
import { clientCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

function generatedPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 18 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  const clients = await prisma.user.findMany({ where: { role: "CLIENT" }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, name: true, role: true, createdAt: true } });
  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const body = await request.json().catch(() => null);
  const parsed = clientCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Проверьте имя и email.", 400);

  const password = generatedPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const client = await prisma.user.create({ data: { ...parsed.data, passwordHash, role: "CLIENT" }, select: { id: true, email: true, name: true, role: true, createdAt: true } });
    return NextResponse.json({ client, temporaryPassword: password }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return jsonError("Пользователь с таким email уже существует.", 409);
    throw error;
  }
}
