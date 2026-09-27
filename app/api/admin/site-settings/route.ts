import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { getSiteSettingsOrDefaults } from "@/lib/site-settings";
import { prisma } from "@/lib/db";
import { jsonError, verifyCsrf } from "@/lib/security";
import { siteSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  return NextResponse.json({ settings: await getSiteSettingsOrDefaults() });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);

  const body = await request.json().catch(() => null);
  const parsed = siteSettingsSchema.safeParse(body);
  if (!parsed.success) return jsonError("Проверьте девиз, первый экран и контакты.", 400);

  const settings = await prisma.siteSettings.upsert({
    where: { id: "site-settings" },
    update: parsed.data,
    create: { id: "site-settings", ...parsed.data },
  });
  return NextResponse.json({ settings });
}
