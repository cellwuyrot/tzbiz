import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/api-auth";
import { sendMailDiagnostic } from "@/lib/mailer";
import { recordIntegrationCheck } from "@/lib/integration-status";
import { adminMailAllowed } from "@/lib/admin-mail-limit";
import { jsonError, verifyCsrf } from "@/lib/security";
export const runtime = "nodejs";
const schema = z.object({
  email: z.string().trim().email().max(254),
  confirmSend: z.literal(true),
});
export async function POST(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(request)) return jsonError("Неверный CSRF-токен.", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return jsonError(
      "Укажите тестовый email и подтвердите отправку двух писем.",
      400,
    );
  if (!adminMailAllowed(auth.user!.id, "test"))
    return jsonError("Лимит тестов: 3 за 10 минут.", 429);
  const results = await sendMailDiagnostic(parsed.data.email);
  const accepted = [results.client, results.internal].filter(
    (result) => result.status === "SMTP_ACCEPTED",
  ).length;
  const status =
    accepted === 2 ? "SUCCESS" : accepted === 1 ? "PARTIAL" : "FAILED";
  const categories =
    [results.client.errorCategory, results.internal.errorCategory]
      .filter(Boolean)
      .join(" / ") || null;
  const recorded = await recordIntegrationCheck(
    "smtp.test",
    status,
    categories,
  );
  return NextResponse.json(
    { ok: accepted === 2, results, recorded },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
