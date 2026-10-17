/** Isolated local synthetic scenarios; never run against real customer data. */
import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3300",
  dir = process.env.INTEGRATION_ARTIFACT_DIR || "data/integration-artifacts";
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) ||
  !/^file:.*integration/.test(process.env.DATABASE_URL || "")
)
  throw Error("Only disposable local integration SQLite databases allowed.");
if (process.env.SMTP_HOST) throw Error("Disable SMTP for synthetic tests.");
const f = JSON.parse(
    await fs.readFile(path.join(dir, "qa-fixture.json"), "utf8"),
  ),
  db = new PrismaClient(),
  checks = [];
const token = (cookie) =>
  cookie
    .split("; ")
    .find((s) => s.startsWith("trioz_csrf="))
    ?.slice("trioz_csrf=".length) || "";
async function api(
  url,
  method = "GET",
  body,
  cookie = f.adminCookie,
  headers = {},
) {
  const form = body instanceof FormData;
  return fetch(base + url, {
    method,
    redirect: "manual",
    headers: {
      origin: base,
      ...(cookie ? { cookie, "x-csrf-token": token(cookie) } : {}),
      ...(body && !form ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
  });
}
function pass(s) {
  checks.push(s);
  console.log("PASS " + s);
}
async function ok(r, status = 200) {
  assert.equal(r.status, status, await r.clone().text());
  return r.json();
}
try {
  for (const route of ["/api/admin/documents", "/api/admin/analytics"]) {
    assert.equal((await api(route, "GET", undefined, "")).status, 401);
    assert.equal(
      (await api(route, "GET", undefined, f.clientCookie)).status,
      403,
    );
  }
  assert.equal(
    (
      await api("/api/admin/documents", "PUT", {}, f.adminCookie, {
        "x-csrf-token": "",
      })
    ).status,
    403,
  );
  pass("document and analytics role/CSRF protection");
  const docs = await ok(await api("/api/admin/documents"));
  assert.equal(docs.documents.length, 5);
  const oldVersions = (await ok(await api("/api/documents"))).versions;
  const product = {
    kind: "PRODUCT",
    serviceId: null,
    productType: "DIGITAL",
    projectKey: "trioz",
    projectUrl: "https://trioz.ru",
    externalProductId: "synthetic-cross-project",
    title: "Тест: продукт TrioZ",
    description:
      "Цифровой продукт другого проекта. Только синтетическое тестирование.",
    features: "Одна функция\nВторая функция",
    fulfillmentTerms:
      "Выдача доступа после отдельной проверки в проекте TrioZ, без автоматической активации Business.",
    mode: "ONE_TIME",
    settlementMode: "PREPAYMENT",
    amountRub: "321.09",
    currency: "RUB",
    periodUnit: null,
    periodCount: null,
    renewalTerms: "",
    cancellationTerms: "Тестовый порядок обращения и возврата.",
    internalNotes: "private-catalog-note",
    isPublished: true,
    isArchived: false,
  };
  const created = await ok(
    await api("/api/admin/billing/plans", "POST", product),
    201,
  );
  let card = created.plan;
  let publicHtml = await (
    await api(`/plans/${card.id}`, "GET", undefined, "")
  ).text();
  assert(publicHtml.includes("Где действует"));
  assert(publicHtml.includes("Выдача доступа"));
  assert(!publicHtml.includes("private-catalog-note"));
  assert(
    (await (await api("/plans", "GET", undefined, "")).text()).includes(
      card.title,
    ),
  );
  pass(
    "generic product card, project and delivery terms, no internal-note leak",
  );
  assert.equal(
    (
      await api("/api/admin/billing/plans", "POST", {
        ...product,
        projectUrl: "javascript:alert(1)",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/api/admin/billing/plans", "POST", {
        ...product,
        fulfillmentTerms: "",
      })
    ).status,
    400,
  );
  pass("unsafe project URL and missing delivery terms rejected");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=",
    "base64",
  );
  const image = new FormData();
  image.set("image", new Blob([png], { type: "image/png" }), "image.png");
  image.set("revision", String(card.revision));
  const uploaded = await ok(
    await api(`/api/admin/billing/plans/${card.id}/image`, "POST", image),
  );
  card = await db.billingPlan.findUniqueOrThrow({ where: { id: card.id } });
  assert.equal(card.revision, 2);
  assert.equal((await api(uploaded.path, "GET", undefined, "")).status, 200);
  assert.equal(
    await db.billingPlanAudit.count({ where: { planId: card.id } }),
    2,
  );
  pass("card image upload, public visibility and revision audit");
  assert.equal(
    (await api(`/api/admin/billing/plans/${card.id}/image`, "POST", image))
      .status,
    409,
  );
  pass("stale image update rejected");
  const marker = `Тестовая новая редакция ${crypto.randomUUID()}`;
  const draft = docs.documents.find((d) => d.slug === "privacy"),
    newBody =
      draft.body +
      `\n\n# ${marker}\nТолько изолированная проверка истории. <script>window.LEGAL_XSS=true</script>`;
  await ok(
    await api("/api/admin/documents", "PUT", {
      ...draft,
      body: newBody,
      publish: false,
    }),
  );
  let current = (await ok(await api("/api/admin/documents"))).documents.find(
    (d) => d.slug === "privacy",
  );
  assert.equal(current.publishedVersion, oldVersions.privacy);
  assert(
    !(await (await api("/privacy", "GET", undefined, "")).text()).includes(
      marker,
    ),
  );
  pass("draft edit does not replace public legal document");
  assert.equal(
    (
      await api("/api/admin/documents", "PUT", {
        ...current,
        publish: true,
        ownerConfirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (await api("/api/admin/documents", "PUT", { ...draft, publish: false }))
      .status,
    409,
  );
  pass("owner confirmation and optimistic legal revision required");
  // Save a real HTTP consent choice and use it only in this isolated test.
  const cr = await api("/api/auth/csrf", "GET", undefined, "");
  const csrfCookie = cr.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  await cr.json();
  let r = await api(
    "/api/privacy/consent",
    "POST",
    { analytics: true },
    csrfCookie,
  );
  assert.equal(r.status, 200, await r.clone().text());
  const consentCookie = r.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  assert(r.headers.get("set-cookie").includes("HttpOnly"));
  assert(r.headers.get("set-cookie").includes("SameSite=lax"));
  pass("explicit consent stored in host-only HttpOnly cookie");
  const total = async () =>
    (await db.pageViewDaily.aggregate({ _sum: { views: true } }))._sum.views ||
    0;
  let n = await total();
  assert.equal(
    (await api("/api/analytics/view", "POST", { path: "/plans" }, "")).status,
    204,
  );
  assert.equal(await total(), n);
  pass("no consent means no analytics write");
  assert.equal(
    (
      await api(
        "/api/analytics/view",
        "POST",
        { path: `/plans/${card.id}`, email: "must-not-store@example.test" },
        consentCookie,
      )
    ).status,
    204,
  );
  assert.equal(await total(), n + 1);
  n++;
  pass("consented public view increments only a path/day aggregate");
  for (const [headers, body, status] of [
    [{ dnt: "1" }, { path: "/plans" }, 204],
    [{ "sec-gpc": "1" }, { path: "/plans" }, 204],
    [{ origin: "https://evil.test" }, { path: "/plans" }, 403],
    [{}, { path: "/admin" }, 400],
    [{}, { path: "/plans?email=private" }, 400],
  ]) {
    assert.equal(
      (await api("/api/analytics/view", "POST", body, consentCookie, headers))
        .status,
      status,
    );
    assert.equal(await total(), n);
  }
  pass("DNT, GPC, foreign origins, private pages and query strings excluded");
  await ok(
    await api("/api/admin/documents", "PUT", {
      ...current,
      publish: true,
      ownerConfirmed: true,
    }),
  );
  const versions = (await ok(await api("/api/documents"))).versions;
  assert.notEqual(versions.privacy, oldVersions.privacy);
  const archived = await api(
    `/documents/privacy?version=${oldVersions.privacy}`,
    "GET",
    undefined,
    "",
  );
  assert.equal(archived.status, 200);
  assert(!(await archived.text()).includes(marker));
  const latest = await (await api("/privacy", "GET", undefined, "")).text();
  assert(latest.includes(marker));
  assert(!latest.includes("<script>window.LEGAL_XSS=true</script>"));
  pass("immutable archived legal revisions and escaped document text");
  assert.equal(
    (
      await api(
        "/api/analytics/view",
        "POST",
        { path: "/plans" },
        consentCookie,
      )
    ).status,
    204,
  );
  assert.equal(await total(), n);
  const staleChoice = await ok(
    await api("/api/privacy/consent", "GET", undefined, consentCookie),
  );
  assert.equal(staleChoice.analytics, false);
  assert.equal(staleChoice.chosen, false);
  pass("new policy publication invalidates old analytics permission");
  const order = {
    planId: card.id,
    revision: card.revision,
    requestKey: crypto.randomUUID(),
    message: "Тестовая заявка для продукта другого проекта",
    agreementAccepted: true,
    privacyConsent: true,
    offerAccepted: true,
    legalVersions: versions,
  };
  assert.equal(
    (
      await api(
        "/api/orders",
        "POST",
        { ...order, legalVersions: oldVersions },
        f.clientCookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await api(
        "/api/orders",
        "POST",
        { ...order, offerAccepted: false },
        f.clientCookie,
      )
    ).status,
    409,
  );
  pass("outdated legal versions and absent offer acknowledgement rejected");
  const ordered = await ok(
      await api("/api/orders", "POST", order, f.clientCookie),
      201,
    ),
    saved = await db.businessOrder.findUniqueOrThrow({
      where: { id: ordered.id },
    }),
    snapshot = JSON.parse(saved.snapshot);
  assert.equal(snapshot.plan.projectKey, "trioz");
  assert.equal(snapshot.plan.features, product.features);
  assert.equal(snapshot.legalVersions.privacy, versions.privacy);
  assert.equal(ordered.paymentConfirmed, false);
  assert(!snapshot.accessActive);
  assert.equal(saved.status, "AWAITING_INVOICE");
  assert.equal(
    (await api("/api/orders", "POST", order, f.clientCookie)).status,
    200,
  );
  assert.equal(
    (
      await api(
        "/api/orders",
        "POST",
        { ...order, message: "Другое сообщение с тем же ключом" },
        f.clientCookie,
      )
    ).status,
    409,
  );
  pass(
    "cross-project order snapshots and idempotency without fabricated access",
  );
  await ok(
    await api(`/api/admin/billing/plans/${card.id}`, "PATCH", {
      ...product,
      revision: card.revision,
      cardImageUrl: card.cardImageUrl,
      features: "Новые характеристики",
    }),
  );
  assert.equal(
    JSON.parse(
      (await db.businessOrder.findUniqueOrThrow({ where: { id: ordered.id } }))
        .snapshot,
    ).plan.features,
    product.features,
  );
  pass("editing product does not rewrite past order conditions");
  const offer = await db.legalPage.findUniqueOrThrow({
    where: { slug: "offer" },
  });
  await db.legalPage.update({
    where: { slug: "offer" },
    data: { publishedVersion: null },
  });
  try {
    const now = await db.billingPlan.findUniqueOrThrow({
      where: { id: card.id },
    });
    assert.equal(
      (
        await api(
          "/api/orders",
          "POST",
          { ...order, requestKey: crypto.randomUUID(), revision: now.revision },
          f.clientCookie,
        )
      ).status,
      503,
    );
  } finally {
    await db.legalPage.update({
      where: { slug: "offer" },
      data: { publishedVersion: offer.publishedVersion },
    });
  }
  pass("checkout fails closed when mandatory legal publication is absent");
  const no = await api(
    "/api/privacy/consent",
    "POST",
    { analytics: false },
    csrfCookie,
  );
  assert.equal(no.status, 200);
  const denied = no.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  await api("/api/analytics/view", "POST", { path: "/plans" }, denied);
  assert.equal(await total(), n);
  pass("withdrawal stops subsequent analytics writes");
  const report = await ok(await api("/api/admin/analytics"));
  assert(report.total >= 1);
  assert.equal(report.metric, "Просмотры, не уникальные посетители");
  assert.equal((await api("/api/admin/analytics?days=999999")).status, 400);
  pass("admin aggregate report and bounded date ranges");
  await db.pageViewDaily.create({
    data: { day: "1999-01-01", path: "/", views: 1 },
  });
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/jobs.ts"],
    { cwd: process.cwd(), env: process.env, stdio: "pipe" },
  );
  assert.equal(
    await db.pageViewDaily.count({ where: { day: "1999-01-01" } }),
    0,
  );
  pass("maintenance removes aggregates older than retention period");
  f.productId = card.id;
  f.crossProjectOrderId = ordered.id;
  await fs.writeFile(
    path.join(dir, "qa-fixture.json"),
    JSON.stringify(f, null, 2),
    { mode: 0o600 },
  );
  await fs.writeFile(
    path.join(dir, "catalog-privacy-results.json"),
    JSON.stringify({ ok: true, checks }, null, 2),
  );
} finally {
  await db.$disconnect();
}
