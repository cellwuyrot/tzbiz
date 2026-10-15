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
