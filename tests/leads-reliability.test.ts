import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/db", () => ({ prisma: { service: { findFirst: vi.fn() }, leadRequest: { create: vi.fn() } } }));
vi.mock("@/lib/mailer", () => ({ sendLeadNotification: vi.fn() }));
import { prisma } from "@/lib/db";
import { sendLeadNotification } from "@/lib/mailer";
import { AGREEMENT_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { POST } from "@/app/api/leads/route";

const body = { name: "Иван Тест", email: "client@example.com", phone: "+70000000000", company: "", serviceSlug: "service-test", message: "Тестовая задача без персональных сведений.", privacyConsent: true, agreementAccepted: true, website: "" };
let sequence = 0;
function request(data: unknown = body, origin = "http://localhost:3000", ip = `test-${++sequence}`) {
  return new NextRequest("http://localhost:3000/api/leads", { method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(data) });
}
describe("lead durability and consent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(prisma.service.findFirst).mockResolvedValue({ id: "service-1", slug: body.serviceSlug, title: "Test" } as never);
    vi.mocked(prisma.leadRequest.create).mockResolvedValue({ id: "lead-1", ...body, serviceTitle: "Test", createdAt: new Date() } as never);
    vi.mocked(sendLeadNotification).mockResolvedValue({ clientNotified: true, internalNotified: true });
  });
  afterEach(() => vi.restoreAllMocks());
  it.each([
    { clientNotified: true, internalNotified: true }, { clientNotified: false, internalNotified: true },
    { clientNotified: true, internalNotified: false }, { clientNotified: false, internalNotified: false },
  ])("keeps a saved lead and reports aggregate acceptance: %j", async (result) => {
    vi.mocked(sendLeadNotification).mockImplementation(async () => {
      expect(prisma.leadRequest.create).toHaveBeenCalledTimes(1);
      return result;
    });
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, emailNotified: result.clientNotified && result.internalNotified });
    expect(prisma.leadRequest.create).toHaveBeenCalledTimes(1);
  });
  it("also keeps the saved lead after an unexpected mailer exception", async () => {
    vi.mocked(sendLeadNotification).mockRejectedValue(new Error("secret SMTP error"));
    const response = await POST(request());
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ ok: true, emailNotified: false });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret");
  });
  it("records server timestamps and document versions", async () => {
    await POST(request());
    const data = vi.mocked(prisma.leadRequest.create).mock.calls[0][0].data;
    expect(data).toMatchObject({ agreementVersion: AGREEMENT_VERSION, privacyVersion: PRIVACY_VERSION });
    expect(data.privacyConsentAt).toBeInstanceOf(Date); expect(data.agreementAcceptedAt).toEqual(data.privacyConsentAt);
  });
  it.each(["privacyConsent", "agreementAccepted"])("requires %s independently", async (field) => {
    for (const value of [false, undefined, "true"]) {
      const response = await POST(request({ ...body, [field]: value }));
      expect(response.status).toBe(400);
    }
    expect(prisma.leadRequest.create).not.toHaveBeenCalled();
  });
  it("rejects an unpublished service without mail", async () => {
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
    expect((await POST(request())).status).toBe(400); expect(sendLeadNotification).not.toHaveBeenCalled();
  });
  it("returns safe JSON on DB failure and never sends before saving", async () => {
    vi.mocked(prisma.leadRequest.create).mockRejectedValue(new Error("private database credentials"));
    const response = await POST(request());
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("private");
    expect(sendLeadNotification).not.toHaveBeenCalled();
  });
  it("rejects foreign Origin and honeypot submissions", async () => {
    expect((await POST(request(body, "https://foreign.example"))).status).toBe(403);
    expect((await POST(request({ ...body, website: "bot" }))).status).toBe(400);
    expect(prisma.leadRequest.create).not.toHaveBeenCalled();
  });
  it("limits the fifth attempt from one key", async () => {
    const ip = `rate-test-${++sequence}`;
    for (let i = 0; i < 4; i++) expect((await POST(request(body, "http://localhost:3000", ip))).status).toBe(201);
    expect((await POST(request(body, "http://localhost:3000", ip))).status).toBe(429);
  });
});
