import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  const leads = await prisma.leadRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { service: { select: { slug: true, title: true } } },
  });
  return NextResponse.json({ leads });
}

export async function POST() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  return NextResponse.json({ error: "Создание заявок выполняется через публичную форму." }, { status: 405 });
}
