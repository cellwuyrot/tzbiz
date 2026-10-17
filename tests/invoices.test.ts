import { afterEach, describe, expect, it, vi } from "vitest";
import {
  invoiceInput,
  invoiceAction,
  bankReady,
  validPaymentUrl,
} from "@/lib/invoices";
import { failureInfo, logFailure } from "@/lib/diagnostics";
import { canTransition } from "@/lib/commerce-client";
const input = {
  requestKey: "18dfdc1f-6b84-4a28-99e8-01e43f2e22c9",
  userId: "cm123456789012345678901234",
  method: "BANK_TRANSFER",
  title: "Разработка сайта",
  amountRub: "123.45",
  buyerName: "Тестовая организация",
  buyerInn: "1234567890",
  buyerDetails: "Тестовые данные",
  dueDate: "2026-12-31",
  taxNote: "Без НДС",
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("invoices and payment boundaries", () => {
  it("validates a bank transfer invoice", () =>
    expect(invoiceInput.safeParse(input).success).toBe(true));
  it.each(["0", "-1", "1.999", "NaN", "99999999.99", ""])(
    "rejects invalid amount %s",
    (amountRub) =>
      expect(invoiceInput.safeParse({ ...input, amountRub }).success).toBe(
        false,
      ),
  );
  it("rejects impossible calendar dates", () =>
    expect(
      invoiceInput.safeParse({ ...input, dueDate: "2026-02-31" }).success,
    ).toBe(false));
  it("requires real configured bank fields", () => {
    expect(bankReady(null)).toBe(false);
    expect(
      bankReady({
        sellerName: "Example",
        sellerDetails: "Example details",
        sellerInn: "1234567890",
        bankName: "Example bank",
        bankBik: "123456789",
        bankAccount: "1".repeat(20),
        bankCorrespondentAccount: "2".repeat(20),
      }),
    ).toBe(true);
  });
  it("disables all payment URLs until allowed hosts are configured", () => {
    vi.stubEnv("PAYMENT_LINK_HOSTS", "");
    expect(validPaymentUrl("https://pay.example.test/payment")).toBe(false);
  });
  it.each([
    "http://pay.example.test/p",
    "https://pay.example.test.evil.test/p",
    "https://evil.test/p",
    "https://user:pass@pay.example.test/p",
    "https://pay.example.test:444/p",
    "javascript:alert(1)",
  ])("rejects unsafe URL %s", (url) => {
    vi.stubEnv("PAYMENT_LINK_HOSTS", "pay.example.test");
    expect(validPaymentUrl(url)).toBe(false);
  });
  it("allows only exact approved HTTPS host", () => {
    vi.stubEnv("PAYMENT_LINK_HOSTS", "pay.example.test");
    expect(validPaymentUrl("https://pay.example.test/p?id=123")).toBe(true);
  });
  it("requires acquiring link verification", () => {
    vi.stubEnv("PAYMENT_LINK_HOSTS", "pay.example.test");
    const v = {
      ...input,
      method: "ACQUIRING",
      paymentUrl: "https://pay.example.test/p",
    };
    expect(invoiceInput.safeParse(v).success).toBe(false);
    expect(
      invoiceInput.safeParse({ ...v, providerConfirmed: true }).success,
    ).toBe(true);
  });
  it("requires provider URL, period and cancellation terms for recurring invoices", () => {
    vi.stubEnv("PAYMENT_LINK_HOSTS", "pay.example.test");
    const v = {
      ...input,
      method: "RECURRING",
      providerConfirmed: true,
      paymentUrl: "https://pay.example.test/sub",
    };
    expect(invoiceInput.safeParse(v).success).toBe(false);
    expect(
      invoiceInput.safeParse({
        ...v,
        periodMonths: 1,
        renewalTerms:
          "Продление только у провайдера, отмена в его личном кабинете.",
      }).success,
    ).toBe(true);
  });
  it("rejects a link attached to a bank transfer", () =>
    expect(
      invoiceInput.safeParse({
        ...input,
        paymentUrl: "https://pay.example.test",
      }).success,
    ).toBe(false));
  it("requires explicit confirmation and evidence for a paid invoice", () => {
    expect(
      invoiceAction.safeParse({ action: "PAID", revision: 1, confirm: true })
        .success,
    ).toBe(false);
    expect(
      invoiceAction.safeParse({
        action: "PAID",
        revision: 1,
        confirm: true,
        reference: "bank-12345",
      }).success,
    ).toBe(true);
    expect(
      invoiceAction.safeParse({
        action: "PAID",
        revision: 1,
        confirm: false,
        reference: "bank-12345",
      }).success,
    ).toBe(false);
  });
  it("never equates a paid invoice with a TZ ID subscription", () => {
    expect(
      canTransition("SUBSCRIPTION", "INTEGRATION_PENDING", "DONE", true),
    ).toBe(false);
    expect(
      canTransition("PREPAYMENT", "AWAITING_PAYMENT", "IN_PROGRESS", false),
    ).toBe(false);
    expect(
      canTransition("PREPAYMENT", "AWAITING_PAYMENT", "IN_PROGRESS", true),
    ).toBe(true);
    expect(canTransition("PREPAYMENT", "IN_PROGRESS", "DONE", true)).toBe(true);
  });
});
describe("safe actionable diagnostics", () => {
  it.each([
    ["P2021", "DATABASE_SCHEMA"],
    ["P2022", "DATABASE_SCHEMA"],
    ["P1000", "DATABASE_ACCESS"],
    ["P1001", "DATABASE_UNAVAILABLE"],
    ["unknown", "INTERNAL_ERROR"],
  ])("classifies %s", (code, expected) =>
    expect(failureInfo({ code }).code).toBe(expected),
  );
  it("never logs database URL, raw message or credentials", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = logFailure("test", {
      code: "P1000",
      message: "postgres://user:SECRET@db/test",
    });
    expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
  });
});
