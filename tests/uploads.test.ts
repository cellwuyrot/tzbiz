import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, savePreview, validateUploadFile } from "@/lib/uploads";

function fakeFile(name: string, type: string, size: number) {
  return { name, type, size } as File;
}

describe("media upload validation", () => {
  it("rejects an invalid MIME type", () => {
    expect(() => validateUploadFile(fakeFile("image.png", "application/octet-stream", 1024))).toThrow(/Разрешены только/);
  });

  it("rejects a MIME/extension mismatch", () => {
    expect(() => validateUploadFile(fakeFile("image.png", "image/jpeg", 1024))).toThrow(/Расширение/);
  });

  it("rejects an oversized image", () => {
    expect(() => validateUploadFile(fakeFile("image.png", "image/png", MAX_IMAGE_BYTES + 1))).toThrow(/5 МБ/);
  });

  it("rejects an oversized video", () => {
    expect(() => validateUploadFile(fakeFile("video.mp4", "video/mp4", MAX_VIDEO_BYTES + 1))).toThrow(/50 МБ/);
  });

  it("keeps project previews image-only", async () => {
    await expect(savePreview(fakeFile("video.mp4", "video/mp4", 1024))).rejects.toThrow(/Превью проекта/);
  });
});


import fs from "node:fs/promises";
it("rejects truncated PNG data even with a valid magic signature", async () => {
  const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "broken.png", { type: "image/png" });
  await expect(savePreview(file)).rejects.toThrow(/повреждено/);
});
it("saves and decodes a real image after normalising it", async () => {
  const bytes = await fs.readFile(new URL("./fixtures/image.png", import.meta.url));
  const saved = await savePreview(new File([new Uint8Array(bytes)], "preview.png", { type: "image/png" }));
  try { expect((await fs.readFile(saved.absolutePath)).subarray(0, 8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10])); }
  finally { await fs.unlink(saved.absolutePath); }
});
