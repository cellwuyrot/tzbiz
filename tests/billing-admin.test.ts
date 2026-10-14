import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/api-auth", () => ({ requireApiRole: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn(), billingPlan: { findMany: vi.fn() }, service: { findMany: vi.fn() } } }));
import { prisma } from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { saveBillingPlan } from "@/lib/billing/admin";
import { planInputSchema } from "@/lib/billing/plan";
import { POST } from "@/app/api/admin/billing/plans/route";
const input = { kind: "SERVICE", serviceId: "cm123456789012345678901234", title: "Тест", description: "Описание услуги", mode: "ONE_TIME", amountRub: "10", currency: "RUB", periodUnit: null, periodCount: null, renewalTerms: "", cancellationTerms: "Тестовые условия отмены", internalNotes: "", isPublished: true, isArchived: false };
const tx = { service: { findUnique: vi.fn() }, billingPlan: { create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() }, billingPlanAudit: { create: vi.fn() } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireApiRole).mockResolvedValue({ user: { id: "admin", role: "ADMIN" } as never, response: null });
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: unknown) => unknown)(tx) as never);
  tx.service.findUnique.mockResolvedValue({ isPublished: true }); tx.billingPlan.create.mockResolvedValue({ id: "plan" });
  tx.billingPlan.findUniqueOrThrow.mockResolvedValue({ id: "plan", revision: 1 });
});
describe("plan administration", () => {
  it("saves a plan and a revision snapshot in one transaction", async () => {
    expect(await saveBillingPlan(planInputSchema.parse(input), "admin")).toMatchObject({ plan: { id: "plan" } });
    expect(tx.billingPlanAudit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: "admin", planId: "plan", revision: 1 }) }));
  });
  it("refuses stale edit revision instead of overwriting another editor", async () => {
    tx.billingPlan.updateMany.mockResolvedValue({ count: 0 });
    expect(await saveBillingPlan(planInputSchema.parse(input), "admin", { id: "plan", revision: 1 })).toEqual({ conflict: true });
    expect(tx.billingPlanAudit.create).not.toHaveBeenCalled();
  });
  it("does not publish a tariff for an unpublished/deleted service", async () => {
    tx.service.findUnique.mockResolvedValue({ isPublished: false });
    expect(await saveBillingPlan(planInputSchema.parse(input), "admin")).toEqual({ invalidService: true });
    expect(tx.billingPlan.create).not.toHaveBeenCalled();
  });
  it("allows Premium catalog entries without touching central subscriptions", async () => {
    await saveBillingPlan(planInputSchema.parse({ ...input, kind: "PREMIUM", serviceId: null }), "admin");
    expect(tx.service.findUnique).not.toHaveBeenCalled();
    expect(tx.billingPlan.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "PREMIUM" }) }));
  });
  it("returns a safe validation error before any DB mutation", async () => {
    const req = new NextRequest("https://business.trioz.ru/api/admin/billing/plans", { method: "POST", headers: { cookie: "trioz_csrf=test", "x-csrf-token": "test", "content-type": "application/json" }, body: JSON.stringify({ ...input, amountRub: "-5" }) });
    expect((await POST(req)).status).toBe(400); expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
