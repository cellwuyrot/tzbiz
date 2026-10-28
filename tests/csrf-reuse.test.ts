import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { GET } from "@/app/api/auth/csrf/route";
it("reuses a valid CSRF cookie rather than invalidating another tab's token", async () => {
  const token = "a".repeat(64);
  const response = await GET(new NextRequest("https://business.trioz.ru/api/auth/csrf", { headers: { cookie: `trioz_csrf=${token}` } }));
  expect(await response.json()).toEqual({ token }); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("issues a new token for an invalid cookie", async () => {
  const response = await GET(new NextRequest("https://business.trioz.ru/api/auth/csrf", { headers: { cookie: "trioz_csrf=invalid" } }));
  expect((await response.json()).token).toMatch(/^[a-f0-9]{64}$/); expect(response.headers.get("set-cookie")).toContain("trioz_csrf=");
});
