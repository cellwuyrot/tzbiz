import { beforeEach, describe, expect, it, vi } from "vitest";

function lead() {
  return {
    id: "lead-1",
    name: "Иван Иванов",
    email: "ivan@example.com",
    phone: "+7 900 000-00-00",
    company: "TRIOZ Test",
    serviceTitle: "CRM Интеграция",
    serviceSlug: "crm-integration",
    message: "Нужно связать CRM и учетную систему.",
  };
}

describe("lead mailer", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.SMTP_SERVICE_URL;
    delete process.env.SMTP_SERVICE_KEY;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_PASS;
    process.env.LEADS_EMAIL_TO = "info@trioz.ru";
  });

  it("uses TrioZ mail service before direct SMTP and sends to info@trioz.ru", async () => {
    process.env.SMTP_SERVICE_URL = "https://smtp.test";
    process.env.SMTP_SERVICE_KEY = "sm_test_key";

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/api/me")) {
        return new Response(JSON.stringify({
          type: "site",
          site: {
            domain: "trioz.ru",
            sender_email: "info@trioz.ru",
            is_active: true,
            has_relay: true,
            dkim_configured: true,
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const { sendLeadNotification } = await import("@/lib/mailer");
    await sendLeadNotification(lead());

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://smtp.test/api/me");
    expect(calls[1].url).toBe("https://smtp.test/api/emails");

    const payload = JSON.parse(String(calls[1].init?.body));
    expect(payload.to).toBe("info@trioz.ru");
    expect(payload.from_email).toBe("info@trioz.ru");
    expect(payload.subject).toContain("CRM Интеграция");
    expect(payload.text).toContain("ivan@example.com");
    expect(calls[1].init?.headers).toMatchObject({ Authorization: "Bearer sm_test_key" });
  });

  it("fails loudly when the mail service rejects the message", async () => {
    process.env.SMTP_SERVICE_URL = "https://smtp.test";
    process.env.SMTP_SERVICE_KEY = "sm_test_key";

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/api/me")) {
        return new Response(JSON.stringify({
          type: "site",
          site: { domain: "trioz.ru", sender_email: "info@trioz.ru", is_active: true },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ detail: "site disabled" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }));

    const { sendLeadNotification } = await import("@/lib/mailer");
    await expect(sendLeadNotification(lead())).rejects.toThrow("Почтовый сервис отклонил письмо (403): site disabled");
  });
});
