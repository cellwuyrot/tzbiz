import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { jsonError, verifyCsrf } from "@/lib/security";
import { diagnosticResponse } from "@/lib/diagnostics";
import { LEGAL_SLUGS, defaultLegal, legalDigest } from "@/lib/legal-store";
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  try {
    const [rows, history] = await Promise.all([
      prisma.legalPage.findMany(),
      prisma.legalPublication.findMany({
        orderBy: { publishedAt: "desc" },
        take: 100,
        select: { slug: true, version: true, publishedAt: true, digest: true },
      }),
    ]);
    return NextResponse.json(
      {
        documents: LEGAL_SLUGS.map(
          (s) => rows.find((r) => r.slug === s) || defaultLegal(s),
        ),
        history,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return diagnosticResponse("documents.read", e);
  }
}
const input = z.object({
  slug: z.enum(["agreement", "privacy", "offer", "cookies", "consent"]),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(100).max(100000),
  revision: z.number().int().min(0),
  publish: z.boolean().default(false),
  ownerConfirmed: z.boolean().default(false),
});
export async function PUT(r: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.response) return auth.response;
  if (!verifyCsrf(r)) return jsonError("Неверный CSRF-токен.", 403);
  const p = input.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return jsonError("Проверьте название, текст и версию документа.", 400);
  if (p.data.publish && !p.data.ownerConfirmed)
    return jsonError("Подтвердите проверку документа владельцем.", 400);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const { slug, title, body, revision, publish } = p.data;
      if (publish) {
        const seller = await tx.commerceSettings.findUnique({
          where: { id: "commerce" },
        });
        if (!seller?.approved) return { notReady: true };
      }
      const existing = await tx.legalPage.findUnique({ where: { slug } });
      if ((existing?.revision || 0) !== revision) return { conflict: true };
      const digest = legalDigest(title, body),
        version = `${slug}-${digest}`;
      if (existing) {
        const changed = await tx.legalPage.updateMany({
          where: { slug, revision },
          data: {
            title,
            body,
            revision: { increment: 1 },
            ...(publish ? { publishedVersion: version } : {}),
          },
        });
        if (changed.count !== 1) return { conflict: true };
      } else
        await tx.legalPage.create({
          data: {
            slug,
            title,
            body,
            ...(publish ? { publishedVersion: version } : {}),
          },
        });
      if (publish)
        await tx.legalPublication.upsert({
          where: { version },
          update: {},
          create: {
            slug,
            version,
            title,
            body,
            digest,
            actorId: auth.user!.id,
          },
        });
      return { ok: true, version: publish ? version : null };
    });
    if (result.conflict)
      return jsonError(
        "Документ изменён. Обновите список перед сохранением.",
        409,
      );
    if (result.notReady)
      return jsonError(
        "Сначала утвердите сведения о продавце в разделе «Продажи и условия».",
        400,
      );
    return NextResponse.json(result);
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002")
      return jsonError(
        "Документ изменён другим администратором. Обновите список.",
        409,
      );
    return diagnosticResponse("documents.save", e);
  }
}
