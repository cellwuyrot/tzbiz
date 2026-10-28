import { afterEach, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import { checkImageProcessor, ImageProcessorUnavailable, normaliseImage } from "@/lib/image-processor";
afterEach(() => vi.unstubAllEnvs());
it.each(["png", "jpg", "webp"] as const)("processes a real %s without sharp", async extension => {
  const input = await fs.readFile(new URL(`./fixtures/image.${extension}`, import.meta.url));
  const output = await normaliseImage(input, extension);
  expect(output.length).toBeGreaterThan(20);
  expect(output.length).toBeLessThanOrEqual(5*1024*1024);
  if (extension === "png") expect(output.subarray(0, 8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
  if (extension === "jpg") expect(output.subarray(0, 3)).toEqual(Buffer.from([255,216,255]));
  if (extension === "webp") expect(output.toString("ascii", 8, 12)).toBe("WEBP");
});
it("checks a real tiny image rather than only executable presence", async () => expect(await checkImageProcessor()).toBe(true));
it("does not auto-detect SVG or execute a delegate from disguised input", async () => {
  await expect(normaliseImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'), "png")).rejects.toThrow(/повреждено/);
});
it("rejects a truncated raster image", async () => {
  await expect(normaliseImage(Buffer.from([137,80,78,71,13,10,26,10]), "png")).rejects.toThrow(/повреждено/);
});
it("reports a missing converter without crashing module import", async () => {
  vi.stubEnv("IMAGEMAGICK_CONVERT", "/no-such-image-binary");
  const input = await fs.readFile(new URL("./fixtures/image.png", import.meta.url));
  await expect(normaliseImage(input, "png")).rejects.toBeInstanceOf(ImageProcessorUnavailable);
  expect(await checkImageProcessor()).toBe(false);
});
it("reports a missing metadata reader", async () => {
  vi.stubEnv("IMAGEMAGICK_IDENTIFY", "/no-such-image-binary");
  const input = await fs.readFile(new URL("./fixtures/image.png", import.meta.url));
  await expect(normaliseImage(input, "png")).rejects.toBeInstanceOf(ImageProcessorUnavailable);
});
