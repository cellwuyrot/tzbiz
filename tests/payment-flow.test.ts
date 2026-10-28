import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ consumeRate: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/billing/tbank", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/billing/tbank")>(), bankRequest: vi.fn() }));
// Dedicated on-disk SQLite database, including every production-shape migration.
vi.mock("@/lib/db", async () => {
  const fs = await import("node:fs"), path = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const { createRequire } = await import("node:module");
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  const dir = fs.mkdtempSync(path.join(process.cwd(), "data/payment-integration-"));
  const url = `file:${path.join(dir, "test.db")}`;
  const schema = fs.readFileSync("prisma/schema.sqlite.prisma", "utf8").replace(/provider\s*=\s*"prisma-client-js"/, `provider = "prisma-client-js"\n  output = "${path.join(dir, "client")}"`);
  fs.writeFileSync(path.join(dir, "schema.prisma"), schema);
  fs.cpSync("prisma/migrations-sqlite", path.join(dir, "migrations"), { recursive: true });
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "generate", "--schema", path.join(dir, "schema.prisma")], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const { PrismaClient } = createRequire(path.join(process.cwd(), "package.json"))(path.join(dir, "client"));
  process.env.PAYMENT_TEST_DATABASE_URL = url;
  return { prisma: new PrismaClient({ datasourceUrl: url }) };
});
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bankRequest, bankToken } from "@/lib/billing/tbank";
import { POST as pay } from "@/app/api/orders/[id]/pay/route";
import { POST as notify } from "@/app/api/payments/tbank/notify/route";
import { POST as check } from "@/app/api/orders/[id]/payment/route";
let directory: string, user: { id: string; email: string }, orderId: string;
const origin = "https://business.trioz.ru";
const ctx = () => ({ params: Promise.resolve({ id: orderId }) });
const request = (url = "/pay", csrf = true, data: unknown = {}) => new NextRequest(origin + url, { method: "POST", headers: { "content-type": "application/json", ...(csrf ? { cookie: "trioz_csrf=test", "x-csrf-token": "test" } : {}) }, body: JSON.stringify(data) });
async function notification(status: string, overrides = {}) {
  const payment = await prisma.bankPayment.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: "desc" } });
  const body = { TerminalKey: "test-terminal", OrderId: payment.id, PaymentId: payment.paymentId || "123456789", Amount: 12345, Success: true, ErrorCode: "0", Status: status, ...overrides };
  return notify(request("/api/payments/tbank/notify", false, { ...body, Token: bankToken(body, "test-bank-password") }));
}
beforeAll(async () => {
  const databaseUrl = process.env.PAYMENT_TEST_DATABASE_URL!;
  directory = path.dirname(databaseUrl.slice(5));
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", path.join(directory, "schema.prisma")], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  // mocked PrismaClient above resolves DATABASE_URL on first connection.
}, 30_000);
afterAll(async () => { await prisma.$disconnect(); fs.rmSync(directory, { recursive: true, force: true }); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.clearAllMocks();
  await prisma.bankPayment.deleteMany();
  vi.stubEnv("TBANK_ENABLED", "true"); vi.stubEnv("TBANK_TERMINAL_KEY", "test-terminal"); vi.stubEnv("TBANK_PASSWORD", "test-bank-password"); vi.stubEnv("TBANK_RECEIPT_MODE", "external"); vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  user = await prisma.user.create({ data: { name: "Тестовый клиент", email: `test-${crypto.randomUUID()}@example.test`, passwordHash: "unused", role: "CLIENT" } });
  const plan = await prisma.billingPlan.create({ data: { title: "Тестовый тариф", description: "Тестирование оплаты", kind: "PRODUCT", mode: "ONE_TIME", amountMinor: 12345 } });
  const order = await prisma.businessOrder.create({ data: { userId: user.id, planId: plan.id, requestKey: crypto.randomUUID(), requestHash: "hash", title: plan.title, settlementMode: "PREPAYMENT", amountMinor: 12345, currency: "RUB", planRevision: 1, snapshot: JSON.stringify({ plan: { productType: "SERVICE" } }), message: "Тестовый заказ", acceptedAt: new Date(), status: "AWAITING_INVOICE" } });
  orderId = order.id;
  await prisma.commerceSettings.upsert({ where: { id: "commerce" }, create: { id: "commerce", approved: true }, update: { approved: true } });
  vi.mocked(getCurrentUser).mockResolvedValue(user as never);
  vi.mocked(bankRequest).mockImplementation(async (method, payload) => {
    if (method === "Init") return { Success: true, ErrorCode: "0", TerminalKey: "test-terminal", OrderId: payload.OrderId, Amount: payload.Amount, PaymentId: "123456789", PaymentURL: "https://securepay.tinkoff.ru/test" };
    const payment = await prisma.bankPayment.findFirstOrThrow({ where: { orderId } });
    return { Success: true, ErrorCode: "0", TerminalKey: "test-terminal", OrderId: payment.id, Amount: payment.amountMinor, PaymentId: payment.paymentId, Status: "CONFIRMED" };
  });
});
describe("real database payment flow, simulated bank", () => {
  it("blocks anonymous, missing CSRF and another customer's order before contacting the bank", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null); expect((await pay(request(), ctx())).status).toBe(401);
    expect((await pay(request("/pay", false), ctx())).status).toBe(403);
    expect((await pay(request(), { params: Promise.resolve({ id: "foreign-order" }) })).status).toBe(404);
    expect(bankRequest).not.toHaveBeenCalled();
  });
  it("creates payment using the database price, not the client supplied amount", async () => {
    expect((await pay(request("/pay", true, { amount: 1 }), ctx())).status).toBe(200);
    expect(bankRequest).toHaveBeenCalledWith("Init", expect.objectContaining({ Amount: 12345, PayType: "O", NotificationURL: origin + "/api/payments/tbank/notify" }));
    expect(vi.mocked(bankRequest).mock.calls[0][1]).not.toHaveProperty("Recurrent");
  });
  it("reuses a pending URL and never calls Init twice on repeated click", async () => {
    await pay(request(), ctx()); await pay(request(), ctx());
    expect(bankRequest).toHaveBeenCalledTimes(1);
    expect(await prisma.bankPayment.count({ where: { orderId } })).toBe(1);
  });
  it("accepts CONFIRMED only from a valid signature; duplicate and late AUTHORIZED do not regress", async () => {
    await pay(request(), ctx());
    expect((await notify(request("/notify", false, { TerminalKey: "test-terminal", Token: "a".repeat(64) }))).status).toBe(403);
    expect((await notification("CONFIRMED", { Amount: 1 })).status).toBe(503);
    expect((await notification("CONFIRMED", { PaymentId: "999" })).status).toBe(503);
    expect((await notification("CONFIRMED")).status).toBe(200);
    const first = await prisma.bankPayment.findFirstOrThrow({ where: { orderId } });
    expect(first.status).toBe("CONFIRMED");
    expect(await (await notification("CONFIRMED")).text()).toBe("OK");
    await notification("AUTHORIZED");
    const last = await prisma.bankPayment.findFirstOrThrow({ where: { orderId } });
    expect(last.status).toBe("CONFIRMED"); expect(last.revision).toBe(first.revision);
    expect((await pay(request(), ctx())).status).toBe(409);
  });
  it("processes refunds without re-enabling checkout or accepting a late confirmation", async () => {
    await pay(request(), ctx()); await notification("CONFIRMED"); await notification("REFUNDED", { Amount: 0 }); await notification("CONFIRMED");
    expect((await prisma.bankPayment.findFirstOrThrow({ where: { orderId } })).status).toBe("REFUNDED");
    expect((await pay(request(), ctx())).status).toBe(409);
  });
  it("recovers a missed webhook through authenticated GetState", async () => {
    await pay(request(), ctx()); expect((await check(request(), ctx())).status).toBe(200);
    expect((await prisma.bankPayment.findFirstOrThrow({ where: { orderId } })).status).toBe("CONFIRMED");
  });
  it("does not create another payment after an Init timeout", async () => {
    vi.mocked(bankRequest).mockRejectedValueOnce(Error("timeout"));
    expect((await pay(request(), ctx())).status).toBe(502);
    expect((await pay(request(), ctx())).status).toBe(409);
    expect(bankRequest).toHaveBeenCalledTimes(1);
    // Signed callback can recover even when Init returned no PaymentId.
    expect((await notification("CONFIRMED")).status).toBe(200);
  });
  it("does not treat a malformed Init reply as a safe rejection", async () => {
    vi.mocked(bankRequest).mockResolvedValueOnce({});
    expect((await pay(request(), ctx())).status).toBe(502);
    expect((await pay(request(), ctx())).status).toBe(409);
  });
  it("allows retry only after an explicit bank rejection", async () => {
    vi.mocked(bankRequest).mockResolvedValueOnce({ Success: false, ErrorCode: "7" });
    expect((await pay(request(), ctx())).status).toBe(502);
    expect((await pay(request(), ctx())).status).toBe(200);
    expect(await prisma.bankPayment.count({ where: { orderId } })).toBe(2);
  });
});

it("serialises concurrent checkout clicks to exactly one bank Init", async () => {
  const results = await Promise.all([pay(request(), ctx()), pay(request(), ctx())]);
  expect(results.map(r => r.status)).toContain(200);
  expect(bankRequest).toHaveBeenCalledTimes(1);
  expect(await prisma.bankPayment.count({ where: { orderId } })).toBe(1);
});
it("does not collect a second payment when a manual invoice already exists", async () => {
  await prisma.invoice.create({ data: { number: crypto.randomUUID(), requestKey: crypto.randomUUID(), requestHash: "invoice-hash", userId: user.id, orderId, method: "BANK_TRANSFER", title: "Счёт", amountMinor: 12345, buyerName: "Клиент", sellerSnapshot: "{}", taxNote: "Без НДС", dueDate: new Date(Date.now()+86400000), createdById: user.id } });
  expect((await pay(request(), ctx())).status).toBe(409);
  expect(bankRequest).not.toHaveBeenCalled();
});
