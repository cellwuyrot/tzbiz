import { it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/db", () => ({
  prisma: { service: { findFirst: vi.fn() }, leadRequest: { create: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRate: async () => ({ allowed: true }),
  requestIp: () => "test",
}));
import { prisma } from "@/lib/db";
vi.mock("@/lib/legal-store", async (original) => {
  const actual = await original<typeof import("@/lib/legal-store")>();
  return {
    ...actual,
    legalState: async () => ({
      ready: true,
      versions: {
        agreement: "published-agreement",
        privacy: "published-privacy",
        consent: "published-consent",
      },
    }),
  };
});
import { POST } from "@/app/api/leads/route";
it("binds a lead to the actual published service, never a browser-provided title", async () => {
  vi.mocked(prisma.service.findFirst).mockResolvedValue({
    id: "service",
    slug: "service-test",
    title: "Server title",
  } as never);
  vi.mocked(prisma.leadRequest.create).mockResolvedValue({
    id: "lead",
  } as never);
  const r = await POST(
    new NextRequest("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Test User",
        email: "test@example.test",
        phone: "123456789",
        serviceSlug: "service-test",
        serviceTitle: "Browser lie",
        message: "Detailed message",
        agreementAccepted: true,
        privacyConsent: true,
        legalVersions: {
          agreement: "published-agreement",
          privacy: "published-privacy",
          consent: "published-consent",
        },
      }),
    }),
  );
  expect(r.status).toBe(201);
  expect(prisma.leadRequest.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        serviceId: "service",
        serviceTitle: "Server title",
      }),
    }),
  );
});
