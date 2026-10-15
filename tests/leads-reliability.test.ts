import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/db", () => ({
  prisma: {
    service: { findFirst: vi.fn() },
    leadRequest: { create: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRate: vi.fn(),
  requestIp: () => "test",
}));
import { prisma } from "@/lib/db";
import { consumeRate } from "@/lib/rate-limit";
import { POST } from "@/app/api/leads/route";
import { AGREEMENT_VERSION, PRIVACY_VERSION } from "@/lib/legal";
const data = {
  name: "Тестовый клиент",
  email: "test@example.test",
  phone: "+79990000000",
  company: "",
  serviceSlug: "test-service",
  message: "Тестовое описание задачи",
  privacyConsent: true,
  agreementAccepted: true,
  website: "",
};
function request(
  body: unknown = data,
  origin = "http://localhost:3000",
  key?: string,
) {
  return new NextRequest("http://localhost:3000/api/leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(consumeRate).mockResolvedValue({ allowed: true, retryAfter: 0 });
  vi.mocked(prisma.service.findFirst).mockResolvedValue({
    id: "svc",
    slug: "test-service",
    title: "Тест",
  } as never);
  vi.mocked(prisma.leadRequest.create).mockResolvedValue({
    id: "lead",
  } as never);
  vi.mocked(prisma.leadRequest.findUnique).mockResolvedValue(null);
});
describe("durable public leads", () => {
  it("atomically creates both outbox channels and immediately returns queued, not delivered", async () => {
    const r = await POST(request());
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({
      ok: true,
      id: "lead",
      emailNotified: false,
      queued: true,
    });
    expect(prisma.leadRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobs: { create: [{ channel: "client" }, { channel: "internal" }] },
          clientEmailAttempts: 0,
          internalEmailAttempts: 0,
        }),
      }),
    );
  });
  it.each(["privacyConsent", "agreementAccepted"])("requires %s", async (k) => {
    for (const v of [false, undefined, "true"])
      expect((await POST(request({ ...data, [k]: v }))).status).toBe(400);
    expect(prisma.leadRequest.create).not.toHaveBeenCalled();
  });
  it("records server time and actual document versions", async () => {
    await POST(request());
    const d = vi.mocked(prisma.leadRequest.create).mock.calls[0][0].data;
    expect(d.agreementVersion).toBe(AGREEMENT_VERSION);
    expect(d.privacyVersion).toBe(PRIVACY_VERSION);
    expect(d.privacyConsentAt).toBeInstanceOf(Date);
    expect(d.agreementAcceptedAt).toEqual(d.privacyConsentAt);
  });
  it("does not queue unpublished services", async () => {
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
    expect((await POST(request())).status).toBe(400);
    expect(prisma.leadRequest.create).not.toHaveBeenCalled();
  });
  it("rejects foreign origin and honeypot", async () => {
    expect((await POST(request(data, "https://other.test"))).status).toBe(403);
    expect((await POST(request({ ...data, website: "spam" }))).status).toBe(
      400,
    );
  });
  it("returns retryable response on persistence failure without exposing credentials", async () => {
    vi.mocked(prisma.leadRequest.create).mockRejectedValue(
      new Error("private credentials"),
    );
    const r = await POST(request());
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("private");
  });
  it("limits requests in shared storage", async () => {
    vi.mocked(consumeRate).mockResolvedValue({
      allowed: false,
      retryAfter: 10,
    });
    const r = await POST(request());
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("10");
  });
  it("does not reveal a lead for a reused key with a different body", async () => {
    vi.mocked(prisma.leadRequest.findUnique).mockResolvedValue({
      id: "old",
      requestHash: "other",
    } as never);
    expect(
      (
        await POST(
          request(data, undefined, "00000000-0000-4000-8000-000000000001"),
        )
      ).status,
    ).toBe(409);
    expect(prisma.leadRequest.create).not.toHaveBeenCalled();
  });
  it("rejects malformed idempotency keys", async () => {
    expect((await POST(request(data, undefined, "invalid"))).status).toBe(400);
  });
});
