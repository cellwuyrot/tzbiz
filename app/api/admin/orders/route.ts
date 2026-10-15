import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
export async function GET() {
  const a = await requireApiRole("ADMIN");
  if (a.response) return a.response;
  const orders = await prisma.businessOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
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
  });
  return NextResponse.json(
    { orders },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
