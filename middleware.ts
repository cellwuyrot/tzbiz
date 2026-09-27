import { NextRequest, NextResponse } from "next/server";

const PRIVATE_PREFIXES = ["/enter", "/admin", "/dashboard", "/login"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next();
  if (PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export const config = {
  matcher: ["/enter/:path*", "/admin/:path*", "/dashboard/:path*", "/login/:path*"],
};
