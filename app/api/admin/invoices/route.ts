import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { verifyCsrf, jsonError } from "@/lib/security";
import { diagnosticResponse } from "@/lib/diagnostics";
import { invoiceInput, bankReady, permittedPaymentHosts } from "@/lib/invoices";
import { rublesToMinor } from "@/lib/billing/plan";
import { pageInput } from "@/lib/paging";
export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET(r: NextRequest) {
  const a = await requireApiRole("ADMIN");
  if (a.response) return a.response;
  try {
    const { page, size, q } = pageInput(r.url);
    const where = q
      ? {
          OR: [
            { number: { contains: q } },
            { buyerName: { contains: q } },
            { title: { contains: q } },
          ],
        }
      : {};
    const [invoices, total, settings] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.invoice.count({ where }),
      prisma.commerceSettings.findUnique({ where: { id: "commerce" } }),
    ]);
    return NextResponse.json(
      {
        invoices,
        total,
        page,
        size,
        bankReady: bankReady(settings),
        termsApproved: Boolean(settings?.approved),
        paymentHosts: permittedPaymentHosts(),
      },
      { headers: privateHeaders },
    );
  } catch (e) {
    return diagnosticResponse("invoices.list", e);
  }
}
export async function POST(r: NextRequest) {
  const a = await requireApiRole("ADMIN");
  if (a.response) return a.response;
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const p = invoiceInput.safeParse(await r.json().catch(() => null));
  if (!p.success) return jsonError(p.error.issues[0].message, 400);
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(p.data))
    .digest("hex");
  try {
    const existing = await prisma.invoice.findUnique({
      where: { requestKey: p.data.requestKey },
    });
    if (existing)
      return existing.requestHash === hash
        ? NextResponse.json({ invoice: existing }, { headers: privateHeaders })
        : jsonError("Ключ отправки уже использован с другими данными.", 409);
    if (p.data.dueDate < new Date().toISOString().slice(0, 10))
      return jsonError("Срок оплаты не может быть в прошлом.", 400);
    const result = await prisma.$transaction(async (tx) => {
      const settings = await tx.commerceSettings.findUnique({
        where: { id: "commerce" },
      });
      if (!settings?.approved)
        return {
          error:
            "Сначала утвердите продавца и условия в разделе «Продажи и условия».",
        };
      if (p.data.method === "BANK_TRANSFER" && !bankReady(settings))
        return {
          error:
            "Заполните ИНН и банковские реквизиты продавца в разделе «Продажи и условия».",
        };
      const user = await tx.user.findUnique({ where: { id: p.data.userId } });
      if (!user || user.role !== "CLIENT")
        return { error: "Выберите существующего клиента." };
      if (p.data.orderId) {
        const order = await tx.businessOrder.findUnique({
          where: { id: p.data.orderId },
        });
        if (!order || order.userId !== user.id || order.status === "CANCELLED")
          return {
            error: "Заявка недоступна или принадлежит другому клиенту.",
          };
      }
      const { amountRub, requestKey, ...input } = p.data;
      const { providerConfirmed, ...invoiceData } = input;
      if (input.method !== "BANK_TRANSFER" && !providerConfirmed)
        return { error: "Подтвердите проверку провайдера." };
      const now = new Date();
      const sellerSnapshot = JSON.stringify({
        sellerName: settings.sellerName,
        sellerDetails: settings.sellerDetails,
        sellerInn: settings.sellerInn,
        sellerKpp: settings.sellerKpp,
        bankName: settings.bankName,
        bankBik: settings.bankBik,
        bankAccount: settings.bankAccount,
        bankCorrespondentAccount: settings.bankCorrespondentAccount,
        supportEmail: settings.supportEmail,
      });
      const invoice = await tx.invoice.create({
        data: {
          ...invoiceData,
          requestKey,
          requestHash: hash,
          amountMinor: rublesToMinor(amountRub)!,
          number: `B-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
          sellerSnapshot,
          dueDate: new Date(`${input.dueDate}T23:59:59.999Z`),
          periodMonths:
            input.method === "RECURRING" ? input.periodMonths : null,
          renewalTerms: input.method === "RECURRING" ? input.renewalTerms : "",
          createdById: a.user!.id,
          history: JSON.stringify([
            { action: "ISSUED", actorId: a.user!.id, at: now.toISOString() },
          ]),
        },
      });
      return { invoice };
    });
    if (result.error) return jsonError(result.error, 409);
    return NextResponse.json(result, { status: 201, headers: privateHeaders });
  } catch (e) {
    const existing = await prisma.invoice
      .findUnique({ where: { requestKey: p.data.requestKey } })
      .catch(() => null);
    if (existing && existing.requestHash === hash)
      return NextResponse.json(
        { invoice: existing },
        { headers: privateHeaders },
      );
    return diagnosticResponse("invoices.create", e);
  }
}
