import { describe, it, expect } from "vitest";
import { safeJsonLd } from "@/lib/json-ld";
import { safeReturnTo } from "@/lib/return-to";
import { parseRange } from "@/lib/http-range";
import { planInputSchema } from "@/lib/billing/plan";
import { canTransition } from "@/lib/commerce-client";
const plan = {
  kind: "SERVICE",
  serviceId: "cm123456789012345678901234",
  title: "Услуга",
  description: "Описание тестовой услуги",
  mode: "ONE_TIME",
  settlementMode: "NO_PREPAYMENT",
  amountRub: "",
  currency: "RUB",
  periodUnit: null,
  periodCount: null,
  renewalTerms: "",
  cancellationTerms: "Порядок отмены и обращения",
  internalNotes: "",
  isPublished: true,
  isArchived: false,
};
describe("commerce and audit regressions", () => {
  it("escapes HTML script boundaries but round-trips all text", () => {
    const input = { description: "</script><script>alert(1)</script>\u2028" };
    const s = safeJsonLd(input);
    expect(s).not.toContain("<");
    expect(JSON.parse(s)).toEqual(input);
  });
  it.each([
    "https://evil.test/",
    "//evil.test",
    "/\\evil.test",
    "/admin",
    "/api/auth/logout",
    "/plans\nInjected",
  ])("rejects unsafe return URL %s", (v) =>
    expect(safeReturnTo(v)).toBe("/account"),
  );
  it("retains a plan selection after sign-in", () =>
    expect(safeReturnTo("/plans/test-plan?source=service")).toBe(
      "/plans/test-plan?source=service",
    ));
  it.each([
    ["bytes=0-3", { start: 0, end: 3 }],
    ["bytes=5-", { start: 5, end: 9 }],
    ["bytes=-4", { start: 6, end: 9 }],
    ["bytes=0-99", { start: 0, end: 9 }],
  ])("parses %s", (s, v) => expect(parseRange(s as string, 10)).toEqual(v));
  it.each([
    "bytes=20-30",
    "bytes=4-2",
    "bytes=-0",
    "bytes=0-1,4-5",
    "nonsense",
  ])("rejects unsupported range %s", (s) =>
    expect(parseRange(s, 10)).toBe("invalid"),
  );
  it("allows a published no-prepayment quote without inventing a price", () =>
    expect(planInputSchema.safeParse(plan).success).toBe(true));
  it("requires a price for prepayment", () =>
    expect(
      planInputSchema.safeParse({ ...plan, settlementMode: "PREPAYMENT" })
        .success,
    ).toBe(false));
  it("rejects a disguised one-time Premium product", () =>
    expect(
      planInputSchema.safeParse({ ...plan, kind: "PREMIUM", serviceId: null })
        .success,
    ).toBe(false));
  it("requires an actual technical product mapping for published TZ ID offers", () => {
    const p = {
      ...plan,
      kind: "PREMIUM",
      serviceId: null,
      mode: "RECURRING",
      settlementMode: "SUBSCRIPTION",
      periodUnit: "MONTH",
      periodCount: 1,
      amountRub: "100",
      renewalTerms: "Условия продления подписки",
    };
    expect(planInputSchema.safeParse(p).success).toBe(false);
    expect(
      planInputSchema.safeParse({ ...p, externalProductId: "synthetic-id" })
        .success,
    ).toBe(true);
  });
  it("never activates a subscription or marks an unpaid prepayment order fulfilled by changing status", () => {
    expect(canTransition("SUBSCRIPTION", "INTEGRATION_PENDING", "DONE")).toBe(
      false,
    );
    expect(canTransition("PREPAYMENT", "AWAITING_PAYMENT", "IN_PROGRESS")).toBe(
      false,
    );
    expect(canTransition("NO_PREPAYMENT", "IN_REVIEW", "IN_PROGRESS")).toBe(
      true,
    );
    expect(canTransition("NO_PREPAYMENT", "DONE", "IN_PROGRESS")).toBe(false);
  });
});
