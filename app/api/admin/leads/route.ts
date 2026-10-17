import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { diagnosticResponse } from "@/lib/diagnostics";
import { pageInput } from "@/lib/paging";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  try {
    const { page, size, q } = pageInput(request.url);
    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q.toLowerCase() } },
            { company: { contains: q } },
          ],
        }
      : {};
    const [leads, total] = await Promise.all([
      prisma.leadRequest.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { service: { select: { slug: true, title: true } } },
      }),
      prisma.leadRequest.count({ where }),
    ]);
    return NextResponse.json(
      { leads, total, page, size },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return diagnosticResponse("leads.list", error);
  }
}
export async function POST() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  return NextResponse.json(
    { error: "Создание заявок выполняется через публичную форму." },
    { status: 405 },
  );
}
