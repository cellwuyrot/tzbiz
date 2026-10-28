import { NextRequest, NextResponse } from "next/server";
import { issueCsrfCookie } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const existing = request.cookies.get("trioz_csrf")?.value;
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return NextResponse.json({ token: existing }, { headers: { "Cache-Control": "private, no-store" } });
  const response = NextResponse.json({ token: "" });
  const token = issueCsrfCookie(response);
  response.headers.set("content-type", "application/json");
  response.headers.set("Cache-Control", "private, no-store");
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: response.headers,
  });
}
