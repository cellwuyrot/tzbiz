import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "./auth";
import { canAccessRole } from "./access-policy";

export async function requireApiRole(role: Role) {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Необходим вход." }, { status: 401 }) };
  if (!canAccessRole(user.role, role)) return { user: null, response: NextResponse.json({ error: "Недостаточно прав." }, { status: 403 }) };
  return { user, response: null };
}
