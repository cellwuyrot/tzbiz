import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/services/subscriptions", () => ({ applyServicePayment: vi.fn() }));
import { applyServicePayment } from "@/lib/services/subscriptions";
import { bankToken } from "@/lib/billing/tbank";
import { POST } from "@/app/api/subscriptions/bank/notify/route";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("TBANK_ENABLED", "true"); vi.stubEnv("TBANK_TERMINAL_KEY", "synthetic"); vi.stubEnv("TBANK_PASSWORD", "synthetic-password"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://business.trioz.ru"); vi.stubEnv("TBANK_RECEIPT_MODE", "bank"); });
afterEach(() => vi.unstubAllEnvs());
function request(valid = true) {
  const payload = { TerminalKey: "synthetic", OrderId: "synthetic-order", PaymentId: "123", Amount: 20000, Status: "REJECTED", Success: false };
  return new NextRequest("https://business.trioz.ru/api/subscriptions/bank/notify", { method: "POST", body: JSON.stringify({ ...payload, Token: valid ? bankToken(payload, "synthetic-password") : "invalid" }) });
}
it("accepts a signed failure callback and acknowledges only after processing", async () => { const response = await POST(request()); expect(response.status).toBe(200); expect(await response.text()).toBe("OK"); expect(applyServicePayment).toHaveBeenCalledWith(expect.objectContaining({ Status: "REJECTED", Success: false })); });
it("rejects forged failure callbacks without changing access", async () => { const response = await POST(request(false)); expect(response.status).toBe(403); expect(applyServicePayment).not.toHaveBeenCalled(); });
it("asks the bank to retry if processing could not be persisted", async () => { vi.mocked(applyServicePayment).mockRejectedValueOnce(Error("database unavailable")); const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).toBe("RETRY"); });
