import crypto from "node:crypto";
import type { NextRequest } from "next/server";
const entries = new Map<string, { hits: number; until: number }>();
export function allowTzLoginStart(request: NextRequest) {
  const now = Date.now();
  for (const [key, entry] of entries) if (entry.until <= now) entries.delete(key);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = crypto.createHash("sha256").update(ip).digest("hex");
  const entry = entries.get(key) || { hits: 0, until: now + 600_000 };
  entry.hits++; entries.set(key, entry);
  return entry.hits <= 10;
}
