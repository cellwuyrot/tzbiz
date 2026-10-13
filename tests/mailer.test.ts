import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { sendMail, createTransport } = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));
import { sendLeadNotification } from "@/lib/mailer";

const lead = {
  id: "lead-1", name: `<script>&"'`, email: "client@example.com", phone: "<phone>",
  company: "<company>", serviceTitle: "<service>", serviceSlug: "service", message: "<img src=x>\n&message",
  createdAt: new Date("2026-10-13T12:00:00Z"),
};
describe("independent lead notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SMTP_HOST", "smtp.example.com"); vi.stubEnv("SMTP_USER", "different-login");
    vi.stubEnv("SMTP_PASS", "test-placeholder"); vi.stubEnv("SMTP_PORT", "465"); vi.stubEnv("SMTP_SECURE", "true");
    vi.stubEnv("EMAIL_FROM", "union@business.trioz.ru"); vi.stubEnv("LEADS_EMAIL_TO", "info@trioz.ru");
    vi.stubEnv("EMAIL_REPLY_TO", "info@trioz.ru");
    createTransport.mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({ accepted: ["recipient"], rejected: [] });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("sends two separate messages through the existing transport", async () => {
    expect(await sendLeadNotification(lead)).toEqual({ clientNotified: true, internalNotified: true });
    expect(createTransport).toHaveBeenCalledTimes(1); expect(sendMail).toHaveBeenCalledTimes(2);
    const [client, internal] = sendMail.mock.calls.map(([message]) => message);
    expect(client).toMatchObject({ to: lead.email, from: "union@business.trioz.ru", replyTo: "info@trioz.ru" });
    expect(internal).toMatchObject({ to: "info@trioz.ru", from: client.from, replyTo: lead.email });
    expect(client.text).toContain(lead.id); expect(client.text).toContain(lead.serviceTitle);
    expect(client.text).not.toContain(lead.message); expect(internal.text).toContain(lead.message);
    expect(internal.text).toContain(lead.createdAt.toISOString());
    expect(createTransport.mock.calls[0][0].auth.user).toBe("different-login");
  });
  it.each(["client", "internal"])("attempts the other channel when %s fails", async (failed) => {
    sendMail.mockImplementation(async (message) => {
      if (message.to === (failed === "client" ? lead.email : "info@trioz.ru")) throw new Error("private smtp address / credentials");
      return { accepted: [message.to], rejected: [] };
    });
    expect(await sendLeadNotification(lead)).toEqual({ clientNotified: failed !== "client", internalNotified: failed !== "internal" });
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private smtp");
  });
  it("contains setup failure without leaking error details", async () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(await sendLeadNotification(lead)).toEqual({ clientNotified: false, internalNotified: false });
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("attempts both sends if SMTP is unreachable", async () => {
    sendMail.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await sendLeadNotification(lead)).toEqual({ clientNotified: false, internalNotified: false });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
  it("does not claim success when SMTP rejects the recipient", async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: [lead.email] });
    expect(await sendLeadNotification(lead)).toEqual({ clientNotified: false, internalNotified: false });
  });
  it("escapes every dynamic HTML value and preserves line breaks", async () => {
    await sendLeadNotification(lead);
    for (const [message] of sendMail.mock.calls) {
      expect(message.html).not.toContain("<script>"); expect(message.html).not.toContain("<service>");
      expect(message.html).not.toContain("<img src=x>");
    }
    expect(sendMail.mock.calls[0][0].html).toContain("&lt;script&gt;&amp;&quot;&#039;");
    expect(sendMail.mock.calls[1][0].html).toContain("&lt;img src=x&gt;<br />&amp;message");
  });
  it("respects explicit secure=false and requires STARTTLS", async () => {
    vi.stubEnv("SMTP_SECURE", "false"); await sendLeadNotification(lead);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true }));
  });
});
