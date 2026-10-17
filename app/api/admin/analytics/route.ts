import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { diagnosticResponse } from "@/lib/diagnostics";
export async function GET(r: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  const raw = r.nextUrl.searchParams.get("days") || "30",
    days = Number(raw);
  if (![7, 30, 90, 180].includes(days))
    return NextResponse.json(
      { error: "Период: 7, 30, 90 или 180 дней." },
      { status: 400 },
    );
  try {
    const since = new Date(Date.now() - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    const rows = await prisma.pageViewDaily.groupBy({
      by: ["path"],
      where: { day: { gte: since } },
      _sum: { views: true },
      orderBy: { _sum: { views: "desc" } },
      take: 100,
    });
    return NextResponse.json(
      {
        since,
        days,
        total:
          (
            await prisma.pageViewDaily.aggregate({
              where: { day: { gte: since } },
              _sum: { views: true },
            })
          )._sum.views || 0,
        rows: rows.map((r) => ({ path: r.path, views: r._sum.views || 0 })),
        timezone: "UTC",
        metric: "Просмотры, не уникальные посетители",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return diagnosticResponse("analytics.read", e);
  }
}
