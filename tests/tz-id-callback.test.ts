import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ cookies: { get: vi.fn(), set: vi.fn() }, client: {}, grant: vi.fn(), userinfo: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => mocks.cookies) }));
vi.mock("@/lib/auth", () => ({ createSession: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("@/lib/tz-id/config", () => ({ getTzIdConfig: () => ({ issuer: "https://id.trioz.ru", callbackUrl: "https://business.trioz.ru/api/auth/tz-id/callback" }) }));
vi.mock("@/lib/tz-id/client", () => ({ tzIdClient: vi.fn(async () => mocks.client) }));
vi.mock("@/lib/tz-id/crypto", () => ({ sealTzData: vi.fn(() => "encrypted-access") }));
vi.mock("@/lib/tz-id/flow", () => ({ TZ_TRANSACTION_COOKIE: "tz_business_oidc", readTzTransaction: vi.fn(), consumeTzTransaction: vi.fn(), resolveTzIdentity: vi.fn() }));
vi.mock("openid-client", () => ({ authorizationCodeGrant: mocks.grant, fetchUserInfo: mocks.userinfo }));
import { readTzTransaction, consumeTzTransaction, resolveTzIdentity } from "@/lib/tz-id/flow";
import { createSession, getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/auth/tz-id/callback/route";
const flow = { state: "state".repeat(10), nonce: "nonce".repeat(10), verifier: "verifier".repeat(10), expiresAt: Date.now() + 600000, localUserId: null };
beforeEach(() => {
  vi.clearAllMocks(); mocks.cookies.get.mockReturnValue({ value: "encrypted-flow" });
  vi.mocked(readTzTransaction).mockReturnValue(flow); vi.mocked(consumeTzTransaction).mockResolvedValue(undefined);
  mocks.grant.mockResolvedValue({ access_token: "private-access", expires_in: 300, claims: () => ({ sub: "central-sub", iss: "https://id.trioz.ru", exp: Math.floor(Date.now() / 1000) + 300 }) });
  mocks.userinfo.mockResolvedValue({ sub: "central-sub", email: "test@example.com", email_verified: true });
  vi.mocked(resolveTzIdentity).mockResolvedValue({ id: "local-user", role: "CLIENT" } as never);
});
function req() { return new NextRequest("https://business.trioz.ru/api/auth/tz-id/callback?code=private-code&state=" + flow.state); }
describe("OIDC callback boundary", () => {
  it("uses the registered callback and delegates PKCE, nonce, state and ID-token validation to the library", async () => {
    const response = await GET(req());
    expect(response.headers.get("location")).toBe("https://business.trioz.ru/account");
    expect(mocks.grant).toHaveBeenCalledWith(mocks.client, expect.any(URL), { pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce, idTokenExpected: true });
    expect(mocks.userinfo).toHaveBeenCalledWith(mocks.client, "private-access", "central-sub");
    expect(createSession).toHaveBeenCalledWith("local-user", expect.objectContaining({ tzSubject: "central-sub", tzAccessTokenEncrypted: "encrypted-access" }));
    expect(JSON.stringify(response.headers.get("location"))).not.toContain("private");
  });
  it("rejects missing flow before token exchange", async () => {
    mocks.cookies.get.mockReturnValue(undefined);
    expect((await GET(req())).headers.get("location")).toContain("auth=failed");
    expect(mocks.grant).not.toHaveBeenCalled(); expect(createSession).not.toHaveBeenCalled();
  });
  it("rejects replay before token exchange", async () => {
    vi.mocked(consumeTzTransaction).mockRejectedValue(new Error("consumed"));
    expect((await GET(req())).headers.get("location")).toContain("auth=failed"); expect(mocks.grant).not.toHaveBeenCalled();
  });
  it("rejects mismatching userinfo subject", async () => {
    mocks.userinfo.mockResolvedValue({ sub: "someone-else" });
    expect((await GET(req())).headers.get("location")).toContain("auth=failed");
    expect(resolveTzIdentity).not.toHaveBeenCalled(); expect(createSession).not.toHaveBeenCalled();
  });
  it("does not link if the original local session was changed", async () => {
    vi.mocked(readTzTransaction).mockReturnValue({ ...flow, localUserId: "cm123456789012345678901234" }); vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await GET(req())).headers.get("location")).toContain("auth=failed"); expect(mocks.grant).not.toHaveBeenCalled();
  });
  it("does not create a local identity for an expired token", async () => {
    mocks.grant.mockResolvedValue({ access_token: "private-access", expires_in: 0, claims: () => ({ sub: "central-sub", iss: "https://id.trioz.ru", exp: Math.floor(Date.now() / 1000) - 1 }) });
    expect((await GET(req())).headers.get("location")).toContain("auth=failed");
    expect(resolveTzIdentity).not.toHaveBeenCalled(); expect(createSession).not.toHaveBeenCalled();
  });
  it("does not expose provider error details", async () => {
    mocks.grant.mockRejectedValue(new Error("private token/credentials"));
    const response = await GET(req()); expect(response.headers.get("location")).toBe("https://business.trioz.ru/plans?auth=failed"); expect(createSession).not.toHaveBeenCalled();
  });
});
