import { NextResponse } from "next/server";
import { issueCsrfCookie } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  const response = NextResponse.json({ token: "" });
  const token = issueCsrfCookie(response);
  response.headers.set("content-type", "application/json");
  return new Response(JSON.stringify({ token }), { status: 200, headers: response.headers });
}
