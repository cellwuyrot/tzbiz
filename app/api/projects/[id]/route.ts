import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { getVisibleProjectForUser } from "@/lib/project-access";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiRole("CLIENT");
  if (auth.response) return auth.response;
  const { id } = await params;
  const project = await getVisibleProjectForUser(id, auth.user!);
  if (!project) return NextResponse.json({ error: "Проект не найден." }, { status: 404 });
  return NextResponse.json({ project });
}
