import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Вход по паролю отключён. Используйте TZ ID.", loginUrl: "/account" }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
