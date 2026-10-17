import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { verifyCsrf, jsonError } from "@/lib/security";
import { diagnosticResponse } from "@/lib/diagnostics";
import { invoiceAction } from "@/lib/invoices";
export async function PATCH(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await requireApiRole("ADMIN");
  if (a.response) return a.response;
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const { id } = await params;
  const p = invoiceAction.safeParse(await r.json().catch(() => null));
  if (!z.string().cuid().safeParse(id).success || !p.success)
    return jsonError(
      p.success ? "Некорректный счёт." : p.error.issues[0].message,
      400,
    );
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return jsonError("Счёт не найден.", 404);
    if (invoice.status !== "ISSUED")
      return jsonError(
        "Счёт уже закрыт. Оплаченные счета не отменяются: возврат оформляется отдельно через банк или провайдера.",
        409,
      );
    const now = new Date();
    const u = await prisma.invoice.updateMany({
      where: { id, revision: p.data.revision, status: "ISSUED" },
      data: {
        status: p.data.action,
        revision: { increment: 1 },
        ...(p.data.action === "PAID"
          ? { paidAt: now, paymentReference: p.data.reference }
          : {}),
        history: JSON.stringify([
          ...JSON.parse(invoice.history),
          {
            action: p.data.action,
            actorId: a.user!.id,
            at: now.toISOString(),
            reference: p.data.reference,
            verification: "MANUAL",
          },
        ]),
      },
    });
    if (!u.count)
      return jsonError(
        "Счёт изменён другим администратором. Обновите список.",
        409,
      );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return diagnosticResponse("invoices.update", e);
  }
}
