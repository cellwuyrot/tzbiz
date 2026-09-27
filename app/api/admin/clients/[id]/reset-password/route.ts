import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { verifyCsrf, jsonError } from "@/lib/security";

export const runtime = "nodejs";

function generatedPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from(crypto.randomBytes(18), (byte) => alphabet[byte % alphabet.length]).join("");
}

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  const password = generatedPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.user.updateMany({ where: { id, role: "CLIENT" }, data: { passwordHash } });
  if (!result.count) return jsonError("Клиент не найден.", 404);
  return NextResponse.json({ temporaryPassword: password });
}
