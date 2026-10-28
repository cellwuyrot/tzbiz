import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { diagnosticResponse } from "@/lib/diagnostics";
import { pageInput } from "@/lib/paging";
import { ORDER_STATUS } from "@/lib/commerce-client";
export async function GET(r: NextRequest) {
  const a = await requireApiRole("ADMIN");
  if (a.response) return a.response;
  try {
    const { page, size, q } = pageInput(r.url),
      status = new URL(r.url).searchParams.get("status") || "ALL";
    const where = {
      ...(status in ORDER_STATUS ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { user: { email: { contains: q.toLowerCase() } } },
              { user: { name: { contains: q } } },
            ],
          }
        : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.businessOrder.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          title: true,
          settlementMode: true,
          amountMinor: true,
          currency: true,
          status: true,
          message: true,
          planRevision: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.businessOrder.count({ where }),
    ]);
    const payments = await prisma.invoice.groupBy({
      by: ["orderId"],
      where: {
        orderId: { in: orders.map((o) => o.id) },
        status: "PAID",
        currency: "RUB",
      },
      _sum: { amountMinor: true },
    });
    const bankPaid = await prisma.bankPayment.findMany({ where: { orderId: { in: orders.map(o => o.id) }, status: "CONFIRMED" }, select: { orderId: true, amountMinor: true } });
    const paid = new Map(
      payments.map((p) => [p.orderId, p._sum.amountMinor || 0]),
    );
    return NextResponse.json(
      {
        orders: orders.map((o) => ({
          ...o,
          paymentConfirmed:
            o.amountMinor !== null &&
            o.amountMinor > 0 &&
            ((paid.get(o.id) || 0) >= o.amountMinor || bankPaid.some(p => p.orderId === o.id && p.amountMinor === o.amountMinor)),
        })),
        total,
        page,
        size,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return diagnosticResponse("orders.list", e);
  }
}
