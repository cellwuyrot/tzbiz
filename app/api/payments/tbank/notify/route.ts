import { NextRequest, NextResponse } from "next/server";
import { bankConfig, validBankToken } from "@/lib/billing/tbank";
import { applyBankState } from "@/lib/billing/payment-state";
export const runtime = "nodejs";
export async function POST(r: NextRequest) {
  const body = await r.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return new NextResponse("INVALID", { status: 400 });
  try {
    const config = bankConfig();
    if (body.TerminalKey !== config.terminal || !validBankToken(body, config.password)) return new NextResponse("INVALID", { status: 403 });
    await applyBankState(body);
    return new NextResponse("OK", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  } catch { return new NextResponse("RETRY", { status: 503 }); }
}
