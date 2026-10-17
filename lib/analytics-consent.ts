import crypto from "node:crypto";
import { prisma } from "./db";
export async function consentPolicy() {
  const rows = await prisma.legalPage.findMany({
    where: { slug: { in: ["privacy", "cookies"] } },
    select: { slug: true, publishedVersion: true },
  });
  const values = ["privacy", "cookies"].map(
    (slug) => rows.find((r) => r.slug === slug)?.publishedVersion,
  );
  if (values.some((v) => !v)) return null;
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex");
}
