import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/api-auth", () => ({ requireApiRole: vi.fn() }));
vi.mock("@/lib/mailer", () => ({
  sendMailDiagnostic: vi.fn(),
  verifyMailConnection: vi.fn(),
}));
vi.mock("@/lib/integration-status", () => ({
  recordIntegrationCheck: vi.fn(),
  integrationStatus: vi.fn(),
}));
vi.mock("@/lib/lead-notifications", () => ({ retryLeadNotification: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    mailJob: { findUnique: vi.fn() },
    leadRequest: { findUnique: vi.fn() },
  },
}));
import { requireApiRole } from "@/lib/api-auth";
import { sendMailDiagnostic, verifyMailConnection } from "@/lib/mailer";
import { recordIntegrationCheck } from "@/lib/integration-status";
import { retryLeadNotification } from "@/lib/lead-notifications";
import { POST as testMail } from "@/app/api/admin/integrations/email/test/route";
import { POST as verifyMail } from "@/app/api/admin/integrations/email/verify/route";
import { POST as retryMail } from "@/app/api/admin/leads/[id]/notifications/retry/route";
let seq = 0;
const context = {
  params: Promise.resolve({ id: "cm123456789012345678901234" }),
};
function request(body: unknown = {}) {
  return new NextRequest(
    "http://localhost:3000/api/admin/integrations/email/test",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "trioz_csrf=test-token",
        "x-csrf-token": "test-token",
      },
      body: JSON.stringify(body),
    },
  );
}
describe("explicit administrator mail actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireApiRole).mockResolvedValue({
      user: { id: `admin-${++seq}`, role: "ADMIN" } as never,
      response: null,
    });
    vi.mocked(recordIntegrationCheck).mockResolvedValue(true);
  });
  afterEach(() => vi.restoreAllMocks());
  it("requires an explicit confirmation and valid recipient before diagnostic mail", async () => {
    for (const body of [
      { email: "admin@example.com" },
      { email: "bad", confirmSend: true },
      { email: "admin@example.com", confirmSend: false },
    ])
      expect((await testMail(request(body))).status).toBe(400);
    expect(sendMailDiagnostic).not.toHaveBeenCalled();
  });
  it("reports partial diagnostic success rather than claiming both messages sent", async () => {
    vi.mocked(sendMailDiagnostic).mockResolvedValue({
      client: { status: "SMTP_ACCEPTED", errorCategory: null },
      internal: { status: "FAILED", errorCategory: "AUTH" },
    });
    const response = await testMail(
      request({ email: "admin@example.com", confirmSend: true }),
    );
    expect(await response.json()).toMatchObject({ ok: false, recorded: true });
    expect(recordIntegrationCheck).toHaveBeenCalledWith(
      "smtp.test",
      "PARTIAL",
      "AUTH",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("verification does not call diagnostic mail", async () => {
    vi.mocked(verifyMailConnection).mockResolvedValue({
      status: "FAILED",
      errorCategory: "CONFIG",
    });
    expect((await verifyMail(request())).status).toBe(200);
    expect(sendMailDiagnostic).not.toHaveBeenCalled();
  });
  it("requires duplicate-risk confirmation for a retry", async () => {
    expect(
      (await retryMail(request({ channel: "client" }), context)).status,
    ).toBe(400);
    expect(retryLeadNotification).not.toHaveBeenCalled();
  });
  it("returns conflict without claiming delivery", async () => {
    vi.mocked(retryLeadNotification).mockResolvedValue({ conflict: true });
    expect(
      (
        await retryMail(
          request({ channel: "client", confirmDuplicateRisk: true }),
          context,
        )
      ).status,
    ).toBe(409);
  });
  it("rate limits diagnostic sends per administrator", async () => {
    vi.mocked(sendMailDiagnostic).mockResolvedValue({
      client: { status: "FAILED", errorCategory: "CONFIG" },
      internal: { status: "FAILED", errorCategory: "CONFIG" },
    });
    for (let n = 0; n < 3; n++)
      expect(
        (
          await testMail(
            request({ email: "admin@example.com", confirmSend: true }),
          )
        ).status,
      ).toBe(200);
    expect(
      (
        await testMail(
          request({ email: "admin@example.com", confirmSend: true }),
        )
      ).status,
    ).toBe(429);
    expect(sendMailDiagnostic).toHaveBeenCalledTimes(3);
  });
});
