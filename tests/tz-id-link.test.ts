import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/tz-id/flow", () => ({ beginTzLogin: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ consumeRate: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn() } }));
vi.mock("@/lib/security", async (original) => ({
  ...(await original<object>()),
  verifyCsrf: vi.fn(),
  checkLoginRateLimit: vi.fn(),
  recordLoginFailure: vi.fn(),
  clearLoginFailures: vi.fn(),
}));
import { consumeRate } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { beginTzLogin } from "@/lib/tz-id/flow";
import { verifyCsrf } from "@/lib/security";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/auth/tz-id/link/route";
const req = () =>
  new NextRequest("https://business.trioz.ru/api/auth/tz-id/link", {
    method: "POST",
    body: JSON.stringify({ currentPassword: "synthetic-password" }),
    headers: { "content-type": "application/json" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "local",
    passwordHash: "hash",
  } as never);
  vi.mocked(verifyCsrf).mockReturnValue(true);
  vi.mocked(consumeRate).mockResolvedValue({ allowed: true, retryAfter: 0 });
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  vi.mocked(beginTzLogin).mockResolvedValue(
    new URL("https://id.trioz.ru/auth?state=synthetic"),
  );
});
describe("explicit TZ ID link", () => {
  it("requires a local session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
    expect(beginTzLogin).not.toHaveBeenCalled();
  });
  it("requires CSRF", async () => {
    vi.mocked(verifyCsrf).mockReturnValue(false);
    expect((await POST(req())).status).toBe(403);
    expect(beginTzLogin).not.toHaveBeenCalled();
  });
  it("requires the current local password", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    expect((await POST(req())).status).toBe(401);
    expect(consumeRate).toHaveBeenCalled();
    expect(beginTzLogin).not.toHaveBeenCalled();
  });
  it("limits password guesses", async () => {
    vi.mocked(consumeRate).mockResolvedValue({
      allowed: false,
      retryAfter: 60,
    });
    expect((await POST(req())).status).toBe(429);
    expect(beginTzLogin).not.toHaveBeenCalled();
  });
  it("starts only an explicit verified link", async () => {
    const response = await POST(req());
    expect(response.status).toBe(200);
    expect(beginTzLogin).toHaveBeenCalledWith("local");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
