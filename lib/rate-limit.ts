import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "./db";
export function requestIp(request: NextRequest) {
  // Only enable after the edge proxy overwrites these headers and direct access is blocked.
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "untrusted-proxy";
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
export async function consumeRate(
  scope: string,
  identity: string,
  maximum: number,
  windowMs: number,
  now = Date.now(),
) {
  const tick = Math.floor(now / windowMs),
    expiresAt = new Date((tick + 1) * windowMs);
  const key = crypto
    .createHash("sha256")
    .update(`${scope}:${identity}:${tick}`)
    .digest("hex");
  const bucket = await prisma.rateBucket.upsert({
    where: { key },
    create: { key, hits: 1, expiresAt },
    update: { hits: { increment: 1 } },
  });
  return {
    allowed: bucket.hits <= maximum,
    retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
  };
}
