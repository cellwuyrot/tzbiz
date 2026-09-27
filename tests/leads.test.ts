import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    service: { findFirst: vi.fn() },
    leadRequest: { create: vi.fn() },
  },
}));
vi.mock("@/lib/mailer", () => ({ sendLeadNotification: vi.fn() }));

import { prisma } from "@/lib/db";
import { sendLeadNotification } from "@/lib/mailer";
import { POST } from "@/app/api/leads/route";

function request(body: unknown, ip: string) {
  return new NextRequest("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("lead requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request without privacy consent", async () => {
    const response = await POST(request({
      name: "Иван Иванов",
      email: "ivan@example.com",
      phone: "+7 900 000-00-00",
      company: "TRIOZ Test",
      serviceSlug: "crm-integration",
      message: "Нужно связать CRM и учетную систему.",
      privacyConsent: false,
      website: "",
    }, "203.0.113.10"));
    expect(response.status).toBe(400);
    expect(prisma.service.findFirst).not.toHaveBeenCalled();
  });

  it("creates a lead from the selected published service and sends notification", async () => {
    vi.mocked(prisma.service.findFirst).mockResolvedValue({ id: "svc-1", slug: "crm-integration", title: "CRM Интеграция" } as never);
    vi.mocked(prisma.leadRequest.create).mockResolvedValue({
      id: "lead-1",
      name: "Иван Иванов",
      email: "ivan@example.com",
      phone: "+7 900 000-00-00",
      company: "TRIOZ Test",
      serviceTitle: "CRM Интеграция",
      message: "Нужно связать CRM и учетную систему.",
      createdAt: new Date(),
    } as never);
    vi.mocked(sendLeadNotification).mockResolvedValue(undefined);

    const response = await POST(request({
      name: "Иван Иванов",
      email: "ivan@example.com",
      phone: "+7 900 000-00-00",
      company: "TRIOZ Test",
      serviceSlug: "crm-integration",
      message: "Нужно связать CRM и учетную систему.",
      privacyConsent: true,
      website: "",
    }, "203.0.113.11"));

    expect(response.status).toBe(201);
    expect(prisma.service.findFirst).toHaveBeenCalledWith({
      where: { slug: "crm-integration", isPublished: true },
      select: { id: true, slug: true, title: true },
    });
    expect(prisma.leadRequest.create).toHaveBeenCalled();
    expect(sendLeadNotification).toHaveBeenCalledWith(expect.objectContaining({ serviceSlug: "crm-integration" }));
  });
});
