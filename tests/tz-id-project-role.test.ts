import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readTzProjectRole } from "@/lib/tz-id/project-role";
import { sealTzData } from "@/lib/tz-id/crypto";
const fetcher = vi.fn();
let session: { tzIssuer: string; tzSubject: string; tzAccessTokenEncrypted: string };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("TZ_ID_CLIENT_ID", "tz_business"); vi.stubEnv("TZ_ID_CLIENT_SECRET", "synthetic-secret");
  vi.stubEnv("TZ_ID_TOKEN_KEY", Buffer.alloc(32, 9).toString("base64"));
  session = { tzIssuer: "https://id.trioz.ru", tzSubject: "central-user", tzAccessTokenEncrypted: sealTzData("synthetic-access") };
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ clientId: "tz_business", sub: "central-user", role: "ADMIN" }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("accepts only a current role bound to the configured client and subject", async () => {
  expect(await readTzProjectRole(session)).toBe("ADMIN");
  expect(fetcher).toHaveBeenCalledWith("https://id.trioz.ru/api/v1/project-role", expect.objectContaining({ cache: "no-store", redirect: "error", headers: expect.objectContaining({ Authorization: "Bearer synthetic-access" }) }));
});
it.each([{ clientId: "other", sub: "central-user", role: "ADMIN" }, { clientId: "tz_business", sub: "other", role: "ADMIN" }, { clientId: "tz_business", sub: "central-user", role: "USER" }, { role: "ADMIN" }])("denies a mismatched or incomplete grant: %j", async data => {
  fetcher.mockResolvedValue({ ok: true, json: async () => data });
  expect(await readTzProjectRole(session)).toBe("CLIENT");
});
it.each([401, 403, 404, 429, 500])("fails closed on HTTP %s", async status => {
  fetcher.mockResolvedValue({ ok: false, status }); expect(await readTzProjectRole(session)).toBe("CLIENT");
});
it("fails closed on network or JSON errors", async () => {
  fetcher.mockRejectedValue(new Error("timeout")); expect(await readTzProjectRole(session)).toBe("CLIENT");
  fetcher.mockResolvedValue({ ok: true, json: async () => { throw new Error("invalid JSON"); } }); expect(await readTzProjectRole(session)).toBe("CLIENT");
});
it("does not send a token to another issuer", async () => {
  expect(await readTzProjectRole({ ...session, tzIssuer: "https://evil.invalid" })).toBe("CLIENT"); expect(fetcher).not.toHaveBeenCalled();
});
