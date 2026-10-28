import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { verifyCsrf, jsonError } from "@/lib/security";
export async function POST(request: NextRequest, _context: { params: Promise<{ id: string }> }) {
  void _context;
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  return jsonError("Парольный вход отключён. Профиль и доступ управляются в TZ ID.", 410);
}
