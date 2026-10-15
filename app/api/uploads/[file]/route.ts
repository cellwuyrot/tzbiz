import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { parseRange } from "@/lib/http-range";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mediaKindFromExtension, uploadFilePath } from "@/lib/uploads";

export const runtime = "nodejs";

type Params = { params: Promise<{ file: string }> };

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

export async function GET(_request: Request, { params }: Params) {
  const { file } = await params;
  const filePath = uploadFilePath(file);
  if (!filePath) return new NextResponse(null, { status: 404 });

  const previewPath = `/api/uploads/${file}`;
  const [project, media] = await Promise.all([
    prisma.project.findFirst({ where: { previewPath }, select: { isPublic: true, clientId: true } }),
    prisma.serviceMedia.findFirst({
      where: { path: previewPath },
      select: { service: { select: { isPublished: true } } },
    }),
  ]);

  if (!project && !media) return new NextResponse(null, { status: 404 });

  const user = await getCurrentUser();
  const allowed =
    project?.isPublic === true ||
    media?.service.isPublished === true ||
    user?.role === "ADMIN" ||
    (user?.role === "CLIENT" && project?.clientId === user.id);

  if (!allowed) return new NextResponse(null, { status: 404 });

  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return new NextResponse(null, { status: 404 });

  const extension = file.split(".").at(-1) ?? "";
  const kind = mediaKindFromExtension(file);
  const headers = {
    "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    "Cache-Control": project?.isPublic || media?.service.isPublished ? "public, max-age=3600" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  const range = kind === "VIDEO" ? parseRange(_request.headers.get("range"), stat.size) : null;
  if (range === "invalid") return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${stat.size}`, "Accept-Ranges": "bytes" } });
  const contentHeaders = { ...headers, "Accept-Ranges": kind === "VIDEO" ? "bytes" : "none", "Content-Length": String(range ? range.end - range.start + 1 : stat.size), ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}` } : {}) };
  if (_request.method === "HEAD") return new NextResponse(null, { status: range ? 206 : 200, headers: contentHeaders });
  const stream = createReadStream(filePath, range || undefined);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, { status: range ? 206 : 200, headers: contentHeaders });
}

export const HEAD = GET;
