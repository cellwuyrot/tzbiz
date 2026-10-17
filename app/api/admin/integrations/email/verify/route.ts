import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { verifyMailConnection } from "@/lib/mailer";
import { recordIntegrationCheck } from "@/lib/integration-status";
import { adminMailAllowed } from "@/lib/admin-mail-limit";
import { jsonError, verifyCsrf } from "@/lib/security";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  if (!adminMailAllowed(auth.user!.id, "verify"))
    return jsonError("Лимит проверок: 3 за 10 минут.", 429);
  const result = await verifyMailConnection();
  const recorded = await recordIntegrationCheck(
    "smtp.verify",
    result.status === "SMTP_ACCEPTED" ? "SUCCESS" : "FAILED",
    result.errorCategory,
  );
  return NextResponse.json(
    { ok: result.status === "SMTP_ACCEPTED", result, recorded },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
