import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bankConfig, bankRequest, bankToken, checkoutAvailable, paymentTransition, receiptFor, safePaymentUrl, validBankToken } from "@/lib/billing/tbank";
beforeEach(() => { vi.stubEnv("TBANK_ENABLED", "true"); vi.stubEnv("TBANK_TERMINAL_KEY", "synthetic-terminal"); vi.stubEnv("TBANK_PASSWORD", "synthetic-password"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://business.trioz.ru"); vi.stubEnv("TBANK_RECEIPT_MODE", "bank"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("T-Bank token", () => {
  it("matches the official UTF-8 signature vector", () => {
    expect(bankToken({ TerminalKey: "MerchantTerminalKey", Amount: 19200, OrderId: "00000", Description: "Подарочная карта на 1000 рублей", DATA: { ignored: true }, Receipt: {} }, "11111111111111")).toBe("72dd466f8ace0a37a1f740ce5fb78101712bc0665d91a8108c7c8a0ccd426db2");
  });
  it("ignores nested objects, Token and null but signs booleans", () => {
    const body = { TerminalKey: "test", Amount: 1000, Success: true };
    const Token = bankToken(body, "secret");
    expect(validBankToken({ ...body, Token, Data: { x: "ignored" }, nullable: null }, "secret")).toBe(true);
    expect(validBankToken({ ...body, Success: false, Token }, "secret")).toBe(false);
    expect(validBankToken({ ...body, Amount: 1, Token }, "secret")).toBe(false);
    expect(validBankToken({ ...body, Token: "bad" }, "secret")).toBe(false);
  });
});
it("uses only server-to-server Init and never transmits the raw password", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ Success: true }) }); vi.stubGlobal("fetch", fetcher);
  await bankRequest("Init", { Amount: 500, OrderId: "order" });
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("https://securepay.tinkoff.ru/v2/Init");
  expect(options.body).not.toContain("synthetic-password");
  expect(JSON.parse(options.body)).toMatchObject({ TerminalKey: "synthetic-terminal", Token: expect.stringMatching(/^[a-f0-9]{64}$/) });
});
it.each(["http://securepay.tinkoff.ru/a", "https://securepay.tinkoff.ru.evil.test/a", "javascript:alert(1)", "https://evil.test", "https://user@securepay.tinkoff.ru/a"])("rejects an unsafe checkout URL: %s", value => expect(() => safePaymentUrl(value)).toThrow());
it("accepts only bank HTTPS payment hosts", () => expect(safePaymentUrl("https://securepay.tinkoff.ru/a")).toBe("https://securepay.tinkoff.ru/a"));
it("fails closed without secrets or explicit fiscal mode", () => {
  vi.stubEnv("TBANK_PASSWORD", ""); expect(() => bankConfig()).toThrow();
  vi.stubEnv("TBANK_PASSWORD", "synthetic"); vi.stubEnv("TBANK_RECEIPT_MODE", ""); expect(() => bankConfig()).toThrow(/фискализацию/);
});
it("creates a fiscal receipt with integer kopecks and no invented tax settings", () => {
  expect(() => receiptFor("Услуга", 12345, "test@example.com", "SERVICE")).toThrow();
  vi.stubEnv("TBANK_TAXATION", "usn_income"); vi.stubEnv("TBANK_TAX", "none");
  expect(receiptFor("Услуга", 12345, "test@example.com", "SERVICE")).toMatchObject({ Items: [{ Price: 12345, Amount: 12345, Quantity: 1, PaymentMethod: "full_prepayment", PaymentObject: "service" }] });
});
it("does not charge negotiated, zero or post-payment prices", () => {
  expect(checkoutAvailable("PREPAYMENT", 123)).toBe(true); expect(checkoutAvailable("SUBSCRIPTION", 123)).toBe(true);
  for (const amount of [null, 0, -1, 1.1, NaN]) expect(checkoutAvailable("PREPAYMENT", amount)).toBe(false);
  expect(checkoutAvailable("NO_PREPAYMENT", 123)).toBe(false); expect(checkoutAvailable("PREPAYMENT", 123, "USD")).toBe(false);
});
it.each([["CONFIRMED", "AUTHORIZED"], ["CONFIRMED", "NEW"], ["REFUNDED", "CONFIRMED"], ["PARTIAL_REFUNDED", "CONFIRMED"], ["NEW", "NEW"], ["REJECTED", "NEW"], ["AUTHORIZED", "FORM_SHOWED"]])("ignores duplicate/out-of-order status %s → %s", (from, to) => expect(paymentTransition(from, to)).toBe(false));
it.each([["CREATING", "CONFIRMED"], ["NEW", "CONFIRMED"], ["AUTHORIZED", "CONFIRMED"], ["CONFIRMED", "REFUNDED"], ["CONFIRMED", "PARTIAL_REFUNDED"]])("accepts status %s → %s", (from, to) => expect(paymentTransition(from, to)).toBe(true));
