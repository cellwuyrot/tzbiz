/** Local-only synthetic checks. No real provider API or payment is called. */
import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3300";
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) ||
  !/^file:.*integration/.test(process.env.DATABASE_URL || "")
)
  throw Error(
    "Only disposable local integration SQLite databases are allowed.",
  );
if (process.env.SMTP_HOST) throw Error("Disable SMTP for synthetic checks.");
const dir =
  process.env.INTEGRATION_ARTIFACT_DIR ||
  path.join(process.cwd(), "data/integration-artifacts");
const fixture = JSON.parse(
  await fs.readFile(path.join(dir, "qa-fixture.json"), "utf8"),
);
const db = new PrismaClient(),
  results = [];
function pass(s) {
  results.push(s);
  console.log(`PASS ${s}`);
}
const csrf = fixture.adminCookie
  .split("; ")
  .find((s) => s.startsWith("trioz_csrf="))
  .slice("trioz_csrf=".length);
async function api(
  url,
  method = "GET",
  body,
  cookie = fixture.adminCookie,
  token = csrf,
) {
  return fetch(base + url, {
    method,
    redirect: "manual",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(token ? { "x-csrf-token": token } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
try {
  const raw = fixture.clientCookie
    .split("; ")
    .find((s) => s.startsWith("trioz_session="))
    .slice("trioz_session=".length);
  const session = await db.session.findUniqueOrThrow({
    where: {
      id: crypto
        .createHmac("sha256", process.env.SESSION_SECRET)
        .update(raw)
        .digest("hex"),
    },
  });
  const clientId = session.userId;
  assert.equal(
    (await api("/api/admin/invoices", "GET", undefined, "")).status,
    401,
  );
  assert.equal(
    (await api("/api/admin/invoices", "GET", undefined, fixture.clientCookie))
      .status,
    403,
  );
  assert.equal(
    (await api("/api/admin/invoices", "POST", {}, fixture.adminCookie, ""))
      .status,
    403,
  );
  pass("invoice role and CSRF protection");
  const input = {
    requestKey: crypto.randomUUID(),
    userId: clientId,
    method: "BANK_TRANSFER",
    title: "Тест: разработка сайта",
    amountRub: "123.45",
    buyerName: "Синтетический плательщик",
    buyerInn: "1234567890",
    buyerDetails: "Только тестовые реквизиты",
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    taxNote: "Без НДС (тест)",
  };
  assert.equal((await api("/api/admin/invoices", "POST", input)).status, 409);
  pass("bank invoice blocked without bank details");
  let settings = (await (await api("/api/admin/commerce")).json()).settings;
  const bankFields = {
    sellerInn: "1234567890",
    sellerKpp: "123456789",
    bankName: "Тестовый банк — не использовать для переводов",
    bankBik: "123456789",
    bankAccount: "1".repeat(20),
    bankCorrespondentAccount: "2".repeat(20),
  };
  assert.equal(
    (await api("/api/admin/commerce", "PUT", { ...settings, ...bankFields }))
      .status,
    200,
  );
  const first = await api("/api/admin/invoices", "POST", input);
  assert.equal(first.status, 201, await first.clone().text());
  const bank = (await first.json()).invoice;
  assert.equal((await api("/api/admin/invoices", "POST", input)).status, 200);
  assert.equal(
    (await api("/api/admin/invoices", "POST", { ...input, title: "Changed" }))
      .status,
    409,
  );
  pass("bank invoice creation and idempotency");
  const acquiring = {
    ...input,
    requestKey: crypto.randomUUID(),
    method: "ACQUIRING",
    providerConfirmed: true,
    paymentUrl: "https://pay.example.test/invoice-qa",
  };
  assert.equal(
    (
      await api("/api/admin/invoices", "POST", {
        ...acquiring,
        paymentUrl: "https://evil.example.test/p",
      })
    ).status,
    400,
  );
  const cardResponse = await api("/api/admin/invoices", "POST", acquiring);
  assert.equal(cardResponse.status, 201, await cardResponse.clone().text());
  const card = (await cardResponse.json()).invoice;
  pass("acquiring link uses exact approved provider host");
  const recurring = {
    ...acquiring,
    requestKey: crypto.randomUUID(),
    method: "RECURRING",
    paymentUrl: "https://pay.example.test/subscription-qa",
  };
  assert.equal(
    (await api("/api/admin/invoices", "POST", recurring)).status,
    400,
  );
  const subResponse = await api("/api/admin/invoices", "POST", {
    ...recurring,
    periodMonths: 1,
    renewalTerms:
      "Тест: продление у провайдера ежемесячно. Отмена в кабинете провайдера.",
  });
  assert.equal(subResponse.status, 201);
  const subscription = (await subResponse.json()).invoice;
  pass("external recurring invoice requires period and cancellation terms");
  assert.equal(
    (await api(`/invoices/${bank.id}`, "GET", undefined, fixture.clientCookie))
      .status,
    200,
  );
  assert.equal(
    (await api(`/invoices/${bank.id}`, "GET", undefined, "")).status,
    307,
  );
  const other = await db.user.create({
    data: {
      name: "Other QA client",
      email: `other-${crypto.randomUUID()}@example.test`,
      passwordHash: "disabled-local-test-only",
      role: "CLIENT",
    },
  });
  const otherRaw = crypto.randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: crypto
        .createHmac("sha256", process.env.SESSION_SECRET)
        .update(otherRaw)
        .digest("hex"),
      userId: other.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  assert.equal(
    (
      await api(
        `/invoices/${bank.id}`,
        "GET",
        undefined,
        `trioz_session=${otherRaw}`,
      )
    ).status,
    404,
  );
  pass("invoice ownership and anonymous access protection");
  assert.equal(
    (
      await api(`/api/admin/invoices/${bank.id}`, "PATCH", {
        action: "PAID",
        revision: 1,
        confirm: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api(`/api/admin/invoices/${bank.id}`, "PATCH", {
        action: "PAID",
        revision: 1,
        confirm: true,
        reference: "qa-bank-operation",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api(`/api/admin/invoices/${bank.id}`, "PATCH", {
        action: "CANCELLED",
        revision: 2,
        confirm: true,
      })
    ).status,
    409,
  );
  const paid = await db.invoice.findUniqueOrThrow({ where: { id: bank.id } });
  assert.equal(paid.status, "PAID");
  assert(paid.paidAt);
  assert.equal(JSON.parse(paid.history)[1].verification, "MANUAL");
  pass("manual payment evidence, audit and terminal-state protection");
  settings = (await (await api("/api/admin/commerce")).json()).settings;
  await api("/api/admin/commerce", "PUT", {
    ...settings,
    bankName: "Изменённое название тестового банка",
  });
  const preserved = await db.invoice.findUniqueOrThrow({
    where: { id: bank.id },
  });
  assert.equal(
    JSON.parse(preserved.sellerSnapshot).bankName,
    bankFields.bankName,
  );
  pass("immutable seller and bank snapshot");
  assert.equal(
    (
      await api(`/api/admin/invoices/${card.id}`, "PATCH", {
        action: "PAID",
        revision: 99,
        confirm: true,
        reference: "qa-operation",
      })
    ).status,
    409,
  );
  pass("concurrent invoice edit protection");
  assert.equal(
    (
      await api(`/api/admin/invoices/${card.id}`, "PATCH", {
        action: "CANCELLED",
        revision: 1,
        confirm: true,
      })
    ).status,
    200,
  );
  const cancelledText = await (
    await api(`/invoices/${card.id}`, "GET", undefined, fixture.clientCookie)
  ).text();
  assert(!cancelledText.includes('href="https://pay.example.test/invoice-qa"'));
  pass("cancelled invoice hides external payment action");
  const order = await db.businessOrder.findFirstOrThrow({
    where: { userId: clientId, settlementMode: "PREPAYMENT" },
  });
  if (order.status !== "AWAITING_PAYMENT")
    assert.equal(
      (
        await api(`/api/admin/orders/${order.id}`, "PATCH", {
          status: "AWAITING_PAYMENT",
          updatedAt: order.updatedAt.toISOString(),
        })
      ).status,
      200,
    );
  const o = await db.businessOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(
    (
      await api(`/api/admin/orders/${o.id}`, "PATCH", {
        status: "IN_PROGRESS",
        updatedAt: o.updatedAt.toISOString(),
      })
    ).status,
    409,
  );
  const linkedResponse = await api("/api/admin/invoices", "POST", {
    ...input,
    requestKey: crypto.randomUUID(),
    orderId: o.id,
  });
  assert.equal(linkedResponse.status, 201);
  const linked = (await linkedResponse.json()).invoice;
  assert.equal(
    (
      await api(`/api/admin/invoices/${linked.id}`, "PATCH", {
        action: "PAID",
        revision: 1,
        confirm: true,
        reference: "qa-linked-bank-transfer",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api(`/api/admin/orders/${o.id}`, "PATCH", {
        status: "IN_PROGRESS",
        updatedAt: o.updatedAt.toISOString(),
      })
    ).status,
    200,
  );
  pass("prepayment work starts only after linked full payment reconciliation");
  const subscriptionOrder = await db.businessOrder.findFirstOrThrow({
    where: { userId: clientId, settlementMode: "SUBSCRIPTION" },
  });
  assert.equal(
    (
      await api(`/api/admin/invoices/${subscription.id}`, "PATCH", {
        action: "PAID",
        revision: 1,
        confirm: true,
        reference: "qa-provider-operation",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await db.businessOrder.findUniqueOrThrow({
        where: { id: subscriptionOrder.id },
      })
    ).status,
    "INTEGRATION_PENDING",
  );
  pass("paid external subscription invoice does not fabricate TZ ID access");
  assert.equal(
    (await api(`/api/admin/clients/${clientId}`, "DELETE")).status,
    409,
  );
  pass("client deletion preserves financial records with clear conflict");
  const lead = await db.leadRequest.findFirstOrThrow();
  const client = await db.user.findUniqueOrThrow({ where: { id: clientId } });
  await db.leadRequest.update({
    where: { id: lead.id },
    data: {
      email: client.email,
      company: "Тестовая компания",
      message: "Длинный комментарий клиента. ".repeat(170),
    },
  });
  for (let i = 0; i < 21; i++)
    await db.leadRequest.create({
      data: {
        name: `Тест ${i}`,
        email: `qa-${i}@example.test`,
        phone: "+79990000000",
        company: "",
        serviceTitle: "Тестовая услуга",
        message: "Тестовый текст заявки",
        privacyConsentAt: new Date(),
      },
    });
  const list = await (await api("/api/admin/leads?page=2")).json();
  assert(list.leads.length > 0 && list.leads.length <= 20);
  assert(list.total >= 22);
  pass("lead pagination exposes records beyond the first page");
  const clients = (
    await (
      await api(`/api/admin/clients?q=${encodeURIComponent(client.email)}`)
    ).json()
  ).clients;
  assert.equal(
    clients[0].latestLead.message.length,
    "Длинный комментарий клиента. ".repeat(170).length,
  );
  pass("client search resolves latest lead independently of lead page");
  const integrations = await (await api("/api/admin/integrations")).json();
  assert(integrations.worker.healthy);
  pass("integration diagnostics report worker heartbeat");
  fixture.invoiceIds = [bank.id, card.id, subscription.id, linked.id];
  await fs.writeFile(
    path.join(dir, "qa-fixture.json"),
    JSON.stringify(fixture),
  );
  await fs.writeFile(
    path.join(dir, "invoice-results.json"),
    JSON.stringify({ passed: results.length, checks: results }, null, 2),
  );
} finally {
  await db.$disconnect();
}
