import { spawn } from "node:child_process";
import path from "node:path";

export const MAX_IMAGE_PIXELS = 40_000_000;
const OUTPUT_LIMIT = 5 * 1024 * 1024;
type ImageExtension = "png" | "jpg" | "webp";
const coders = { png: "png", jpg: "jpeg", webp: "webp" } as const;
export class ImageProcessorUnavailable extends Error {
  constructor() { super("Обработчик изображений недоступен. На сервере должен быть установлен ImageMagick (convert и identify)."); }
}
export class InvalidImage extends Error {
  constructor() { super("Изображение повреждено или слишком большое по разрешению. Экспортируйте его заново в PNG, JPEG или WebP."); }
}
// No shell, uploaded filename, user-supplied command or delegate is used.
// Resource policy also applies to the separate identify/ping process.
function runImageCommand(kind: "convert" | "identify", args: string[], input: Buffer, maxOutput: number) {
  const binary = kind === "convert" ? process.env.IMAGEMAGICK_CONVERT || "convert" : process.env.IMAGEMAGICK_IDENTIFY || "identify";
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, MAGICK_CONFIGURE_PATH: path.join(process.cwd(), "config", "imagemagick"), MAGICK_THREAD_LIMIT: "1", OMP_NUM_THREADS: "1" },
    });
    const chunks: Buffer[] = [];
    let size = 0, failed = false;
    const timer = setTimeout(() => { failed = true; child.kill("SIGKILL"); }, 15_000);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxOutput) { failed = true; child.kill("SIGKILL"); }
      else chunks.push(chunk);
    });
    // Drain errors without returning paths, process environment or library diagnostics to clients.
    child.stderr.resume();
    child.stdin.on("error", () => { /* A rejected/truncated image can close stdin early. */ });
    child.on("error", () => { clearTimeout(timer); reject(new ImageProcessorUnavailable()); });
    child.on("close", code => {
      clearTimeout(timer);
      if (failed || code !== 0 || size === 0) reject(new InvalidImage());
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(input);
  });
}
export async function normaliseImage(input: Buffer, extension: ImageExtension): Promise<Buffer> {
  const coder = coders[extension];
  if (!coder) throw new InvalidImage();
  // Pin the decoder regardless of the uploaded filename. Limit output to a single frame.
  const source = `${coder}:-[0]`;
  const dimensions = (await runImageCommand("identify", ["-regard-warnings", "-ping", "-format", "%w %h", source], input, 100)).toString("ascii").trim();
  if (!/^\d{1,6} \d{1,6}$/.test(dimensions)) throw new InvalidImage();
  const [width, height] = dimensions.split(" ").map(Number);
  if (width < 1 || height < 1 || width * height > MAX_IMAGE_PIXELS) throw new InvalidImage();
  return runImageCommand("convert", ["-regard-warnings", source, "-auto-orient", "-strip", "-quality", "90", `${coder}:-`], input, OUTPUT_LIMIT);
}
export async function checkImageProcessor(): Promise<boolean> {
  // Known-good PNG exercises both decoder and encoder, not only `convert -version`.
  const sample = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNw6ZgJAAJ5AWYPzRonAAAAAElFTkSuQmCC", "base64");
  try { await normaliseImage(sample, "png"); return true; } catch { return false; }
}
