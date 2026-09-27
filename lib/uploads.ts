import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const MEDIA_RULES = {
  "image/png": { extension: "png", maxBytes: MAX_IMAGE_BYTES, kind: "IMAGE" },
  "image/jpeg": { extension: "jpg", maxBytes: MAX_IMAGE_BYTES, kind: "IMAGE" },
  "image/webp": { extension: "webp", maxBytes: MAX_IMAGE_BYTES, kind: "IMAGE" },
  "video/mp4": { extension: "mp4", maxBytes: MAX_VIDEO_BYTES, kind: "VIDEO" },
  "video/webm": { extension: "webm", maxBytes: MAX_VIDEO_BYTES, kind: "VIDEO" },
} as const;

export type MediaKind = (typeof MEDIA_RULES)[keyof typeof MEDIA_RULES]["kind"];

function hasValidImageSignature(mime: string, buffer: Buffer) {
  if (mime === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/webp") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}

function getExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase().replace(".", "");
  return extension === "jpeg" ? "jpg" : extension;
}

export function validateUploadFile(file: File) {
  const rule = MEDIA_RULES[file.type as keyof typeof MEDIA_RULES];
  if (!rule) {
    throw new Error("Разрешены только PNG, JPEG, WebP, MP4 и WebM.");
  }

  const extension = getExtension(file.name);
  if (extension !== rule.extension) {
    throw new Error("Расширение файла не соответствует заявленному MIME-типу.");
  }

  if (file.size <= 0 || file.size > rule.maxBytes) {
    throw new Error(
      rule.kind === "IMAGE"
        ? "Размер изображения не должен превышать 5 МБ."
        : "Размер видео не должен превышать 50 МБ.",
    );
  }

  return rule;
}

export async function saveUploadedMedia(file: File) {
  const rule = validateUploadFile(file);
  const filename = `${crypto.randomBytes(20).toString("hex")}.${rule.extension}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (rule.kind === "IMAGE" && !hasValidImageSignature(file.type, buffer)) {
    throw new Error("Файл не соответствует заявленному формату изображения.");
  }

  const absolutePath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(absolutePath, buffer, { flag: "wx" });
  return {
    filename,
    kind: rule.kind,
    path: `/api/uploads/${filename}`,
    absolutePath,
  };
}

export async function removeUpload(uploadPath: string) {
  const match = /^\/api\/uploads\/([a-f0-9]{40})\.(png|jpg|webp|mp4|webm)$/.exec(uploadPath);
  if (!match) return;
  await fs.unlink(path.join(UPLOADS_DIR, `${match[1]}.${match[2]}`)).catch(() => undefined);
}

export async function savePreview(file: File) {
  const rule = validateUploadFile(file);
  if (rule.kind !== "IMAGE") {
    throw new Error("Превью проекта должно быть изображением PNG, JPEG или WebP.");
  }
  return saveUploadedMedia(file);
}

export const removePreview = removeUpload;

export function uploadFilePath(filename: string) {
  if (!/^[a-f0-9]{40}\.(png|jpg|webp|mp4|webm)$/.test(filename)) return null;
  return path.join(UPLOADS_DIR, filename);
}

export function mediaKindFromExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".mp4" || extension === ".webm") return "VIDEO" as const;
  if (extension === ".png" || extension === ".jpg" || extension === ".webp") return "IMAGE" as const;
  return null;
}

export async function removeFiles(paths: string[]) {
  await Promise.all(paths.map((item) => fs.unlink(item).catch(() => undefined)));
}
