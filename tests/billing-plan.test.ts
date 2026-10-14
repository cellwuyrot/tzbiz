import { describe, it, expect } from "vitest";
import { planInputSchema, planData, publicPlan, rublesToMinor, minorToRubles } from "@/lib/billing/plan";
const plan = { kind: "SERVICE", serviceId: "cm123456789012345678901234", title: "Сервис тест", description: "Описание тестовой услуги", mode: "ONE_TIME", amountRub: "1500,25", currency: "RUB", periodUnit: null, periodCount: null, renewalTerms: "", cancellationTerms: "Утверждённые тестовые условия отмены", internalNotes: "private notes", isPublished: false, isArchived: false };
describe("billing catalog money and validation", () => {
  it.each([["1", 100], ["1.2", 120], ["1500,25", 150025], ["", null]])("parses %s without float rounding", (value, expected) => { expect(rublesToMinor(value as string)).toBe(expected); });
  it.each(["-1", "0", "1.001", "1e3", "99999999.99", "NaN", "1 000"])('rejects invalid price %s', value => expect(() => rublesToMinor(value)).toThrow());
  it("round-trips the smallest currency unit", () => { expect(minorToRubles(101)).toBe("1.01"); });
  it("drafts can omit prices, published plans cannot", () => {
    expect(planInputSchema.safeParse({ ...plan, amountRub: "" }).success).toBe(true);
    expect(planInputSchema.safeParse({ ...plan, amountRub: "", isPublished: true }).success).toBe(false);
  });
  it("requires recurring interval and explanatory terms", () => {
    expect(planInputSchema.safeParse({ ...plan, mode: "RECURRING" }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...plan, mode: "RECURRING", periodUnit: "MONTH", periodCount: 1, renewalTerms: "Описание автопродления и списаний" }).success).toBe(true);
  });
  it("requires service linkage, but prohibits attaching Premium to a service", () => {
    expect(planInputSchema.safeParse({ ...plan, serviceId: null }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...plan, kind: "PREMIUM" }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...plan, kind: "VPN", serviceId: null }).success).toBe(true);
  });
  it("never publishes an archived plan or an unapproved cancellation text", () => {
    expect(planInputSchema.safeParse({ ...plan, isPublished: true, isArchived: true }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...plan, isPublished: true, cancellationTerms: "" }).success).toBe(false);
  });
  it("clears recurring-only fields on a one-time plan", () => {
    const data = planData(planInputSchema.parse({ ...plan, periodUnit: "MONTH", periodCount: 1, renewalTerms: "Unused recurring terms" }));
    expect(data).toMatchObject({ amountMinor: 150025, periodUnit: null, periodCount: null, renewalTerms: "" });
    expect(data).not.toHaveProperty("amountRub");
  });
  it("does not expose internal notes or audit actor data in public output", () => {
    const result = publicPlan({ ...planData(planInputSchema.parse(plan)), id: "id", revision: 1, actorId: "private-admin" });
    expect(result).not.toHaveProperty("internalNotes"); expect(result).not.toHaveProperty("actorId");
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
