import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("openid-client", () => ({
  discovery: vi.fn(),
  ClientSecretBasic: vi.fn(),
  enableNonRepudiationChecks: vi.fn(),
  tokenIntrospection: vi.fn(),
}));
import * as oidc from "openid-client";
import { isActiveTzSession } from "@/lib/tz-id/client";
import { sealTzData } from "@/lib/tz-id/crypto";
const session = {
  tzIssuer: "https://id.trioz.ru",
  tzSubject: "central-sub",
  tzAccessTokenEncrypted: "",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TZ_ID_TOKEN_KEY", Buffer.alloc(32, 8).toString("base64"));
  vi.stubEnv("TZ_ID_CLIENT_ID", "tz_test");
  vi.stubEnv("TZ_ID_CLIENT_SECRET", "synthetic-secret");
  session.tzAccessTokenEncrypted = sealTzData("private-access");
  vi.mocked(oidc.discovery).mockResolvedValue({} as never);
});
afterEach(() => vi.unstubAllEnvs());
it("requires active introspection with the same user and client", async () => {
  vi.mocked(oidc.tokenIntrospection).mockResolvedValue({
    active: true,
    sub: "central-sub",
    client_id: "tz_test",
  });
  expect(await isActiveTzSession(session)).toBe(true);
});
it("fails closed on revocation or another subject", async () => {
  for (const result of [
    { active: false },
    { active: true, sub: "other" },
    { active: true, sub: "central-sub", client_id: "other-client" },
  ]) {
    vi.mocked(oidc.tokenIntrospection).mockResolvedValue(result);
    expect(await isActiveTzSession(session)).toBe(false);
  }
});
it("fails closed on provider failure without logging token details", async () => {
  vi.mocked(oidc.tokenIntrospection).mockRejectedValue(
    new Error("private-access"),
  );
  expect(await isActiveTzSession(session)).toBe(null);
});
