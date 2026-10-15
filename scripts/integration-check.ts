/** Run only against a disposable LOCAL database and local Next server. Creates synthetic records. */
import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { consumeRate } from "../lib/rate-limit";
import { processMailBatch } from "../lib/mail-outbox";
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3200";
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) ||
  !/^file:.*(revision|integration)/.test(process.env.DATABASE_URL || "")
)
  throw Error(
    "Integration tests require loopback HTTP and a disposable revision/integration SQLite database.",
  );
if (process.env.SMTP_HOST) throw Error("Refusing synthetic tests with SMTP configured.");
const artifacts = process.env.INTEGRATION_ARTIFACT_DIR || path.join(process.cwd(), "data", "integration-artifacts");
const db = new PrismaClient(),
  tag = crypto.randomBytes(5).toString("hex");
const results: string[] = [];
function pass(s: string) {
  results.push(s);
  console.log(`PASS ${s}`);
}
async function session(role: "ADMIN" | "CLIENT") {
  const password = crypto.randomBytes(24).toString("base64url"),
    email = `${role.toLowerCase()}-${tag}@example.test`;
  const user = await db.user.create({
    data: {
      email,
      name: `Synthetic ${role}`,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  const c = await fetch(`${base}/api/auth/csrf`),
    { token } = await c.json();
  const csrf = c.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: csrf,
      "x-csrf-token": token,
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(r.status, 200, await r.text());
  const cookie =
    csrf +
    "; " +
    r.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
  return { user, token, cookie };
}
type Session = Awaited<ReturnType<typeof session>>;
async function api(
  s: Session | null,
  path: string,
  method = "GET",
  body?: unknown,
  csrf = true,
) {
  return fetch(base + path, {
    method,
    headers: {
      ...(s ? { cookie: s.cookie } : {}),
      ...(s && csrf ? { "x-csrf-token": s.token } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function main() {
  try {
    await fs.mkdir(artifacts, { recursive: true, mode: 0o700 });
    const admin = await session("ADMIN"),
      client = await session("CLIENT");
    assert.equal((await api(null, "/api/admin/orders")).status, 401);
    assert.equal((await api(client, "/api/admin/orders")).status, 403);
    assert.equal(
      (await api(admin, "/api/admin/commerce", "PUT", {}, false)).status,
      403,
    );
    pass("anonymous/client/CSRF protections");
    const settings = await db.commerceSettings.findUnique({
      where: { id: "commerce" },
    });
    assert.equal(
      (
        await api(admin, "/api/admin/commerce", "PUT", {
          sellerName: "Синтетический продавец",
          sellerDetails:
            "Только тестовые реквизиты — не использовать для оплаты",
          supportEmail: "qa@example.test",
          paymentInstructions: "Тестовый порядок выставления счёта",
          fulfillmentTerms: "Тестовые условия предоставления услуги",
          refundTerms: "Тестовые условия отмены и возврата",
          approved: true,
          revision: settings?.revision || 0,
        })
      ).status,
      200,
    );
    pass("owner-controlled readiness settings");
    const svc = await db.service.create({
      data: {
        slug: `qa-${tag}`,
        title: "QA service",
        shortDescription: "</script><script>window.__auditXss=1</script>",
        fullDescription: "Synthetic service used for local checks",
        includes: '["Test"]',
        stages: '["Test"]',
        isPublished: true,
      },
    });
    const basePlan = {
      kind: "SERVICE",
      serviceId: svc.id,
      title: "Тестовое предложение",
      description: "Описание синтетической услуги",
      mode: "ONE_TIME",
      settlementMode: "NO_PREPAYMENT",
      amountRub: "",
      currency: "RUB",
      periodUnit: null,
      periodCount: null,
      renewalTerms: "",
      cancellationTerms: "Тестовые условия отмены обращения",
      internalNotes: "private-qa-note",
      isPublished: true,
      isArchived: false,
    };
    const specs = [
      basePlan,
      {
        ...basePlan,
        title: "С предоплатой",
        settlementMode: "PREPAYMENT",
        amountRub: "123.45",
      },
      ...(["PREMIUM", "VPN"] as const).map((kind) => ({
        ...basePlan,
        title: `Витрина ${kind}`,
        kind,
        serviceId: null,
        mode: "RECURRING",
        settlementMode: "SUBSCRIPTION",
        amountRub: "200",
        periodUnit: "MONTH",
        periodCount: 1,
        renewalTerms: "Тестовые условия продления — не реальное списание",
        externalProductId: `synthetic-${kind.toLowerCase()}`,
      })),
    ];
    const plans = [];
    for (const spec of specs) {
      const r = await api(admin, "/api/admin/billing/plans", "POST", spec);
      assert.equal(r.status, 201, await r.clone().text());
      plans.push((await r.json()).plan);
    }
    pass("all three settlement modes, Premium and VPN mappings");
    const pr = plans[2];
    const edited = await api(
      admin,
      `/api/admin/billing/plans/${pr.id}`,
      "PATCH",
      {
        ...specs[2],
        title: "Новое название Premium",
        description: "Другое описание на витрине",
        revision: pr.revision,
      },
    );
    assert.equal(edited.status, 200);
    const changed = (await edited.json()).plan;
    assert.equal(changed.externalProductId, "synthetic-premium");
    plans[2] = changed;
    pass("renaming Premium preserves technical product identity");
    const publicPage = await fetch(base + "/plans");
    assert(!(await publicPage.text()).includes("private-qa-note"));
    pass("public projection hides internal notes");
    const orderIds = [];
    for (const p of plans) {
      const body = {
        planId: p.id,
        revision: p.revision,
        requestKey: crypto.randomUUID(),
        message: "Тестовая задача для заявки",
        agreementAccepted: true,
        privacyConsent: true,
        amountMinor: 1,
      };
      const r = await api(client, "/api/orders", "POST", body);
      assert.equal(r.status, 201, await r.clone().text());
      const saved = await r.json();
      assert.equal(saved.paymentConfirmed, false);
      orderIds.push(saved.id);
      const again = await api(client, "/api/orders", "POST", body);
      assert.equal(again.status, 200);
      assert.equal((await again.json()).id, saved.id);
      assert.equal(
        (
          await api(client, "/api/orders", "POST", {
            ...body,
            message: "Другой текст с тем же ключом",
          })
        ).status,
        409,
      );
    }
    const prepaid = await db.businessOrder.findUniqueOrThrow({
      where: { id: orderIds[1] },
    });
    assert.equal(prepaid.amountMinor, 12345);
    pass("server-owned prices and per-user idempotent request keys");
    assert.equal(
      (
        await api(admin, `/api/admin/orders/${orderIds[1]}`, "PATCH", {
          status: "DONE",
          updatedAt: prepaid.updatedAt.toISOString(),
        })
      ).status,
      409,
    );
    const sub = await db.businessOrder.findUniqueOrThrow({
      where: { id: orderIds[2] },
    });
    assert.equal(
      (
        await api(admin, `/api/admin/orders/${sub.id}`, "PATCH", {
          status: "IN_PROGRESS",
          updatedAt: sub.updatedAt.toISOString(),
        })
      ).status,
      409,
    );
    pass(
      "unpaid orders and TZ ID access cannot be activated by status checkbox",
    );
    const noPre = await db.businessOrder.findUniqueOrThrow({
      where: { id: orderIds[0] },
    });
    assert.equal(
      (
        await api(admin, `/api/admin/orders/${noPre.id}`, "PATCH", {
          status: "IN_PROGRESS",
          updatedAt: noPre.updatedAt.toISOString(),
        })
      ).status,
      200,
    );
    assert.equal(
      JSON.parse(
        (await db.businessOrder.findUniqueOrThrow({ where: { id: noPre.id } }))
          .history,
      ).length,
      1,
    );
    pass("allowed service workflow and status audit");
    const oldTitle = noPre.title;
    const updated = await api(
      admin,
      `/api/admin/billing/plans/${plans[0].id}`,
      "PATCH",
      { ...specs[0], title: "Будущее название", revision: plans[0].revision },
    );
    assert.equal(updated.status, 200);
    assert.equal(
      (await db.businessOrder.findUniqueOrThrow({ where: { id: noPre.id } }))
        .title,
      oldTitle,
    );
    assert.equal(
      (
        await api(client, "/api/orders", "POST", {
          planId: plans[0].id,
          revision: plans[0].revision,
          requestKey: crypto.randomUUID(),
          message: "Тест устаревшего предложения",
          agreementAccepted: true,
          privacyConsent: true,
        })
      ).status,
      409,
    );
    pass("immutable snapshots and stale revision rejection");
    const key = crypto.randomUUID(),
      leadBody = {
        name: "Тестовый клиент",
        email: `lead-${tag}@example.test`,
        phone: "+79990000000",
        serviceSlug: svc.slug,
        message: "Описание тестовой задачи",
        agreementAccepted: true,
        privacyConsent: true,
      };
    const send = () =>
      fetch(base + "/api/leads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": key,
          origin: base,
        },
        body: JSON.stringify(leadBody),
      });
    const first = await send();
    assert.equal(first.status, 201, await first.clone().text());
    const lead = await first.json();
    assert.equal((await send()).status, 200);
    assert.equal(await db.mailJob.count({ where: { leadId: lead.id } }), 2);
    pass("lead idempotency and atomic two-channel outbox");
    // No SMTP configured in this isolated test. Force jobs pending; failure must not remove the lead.
    assert(
      !process.env.SMTP_HOST,
      "Do not run synthetic mail tests with a real SMTP configuration",
    );
    await processMailBatch();
    assert(await db.leadRequest.findUnique({ where: { id: lead.id } }));
    assert.equal(
      await db.mailJob.count({
        where: { leadId: lead.id, status: "PENDING", attempts: 1 },
      }),
      2,
    );
    pass("mail configuration failure persists retry jobs and lead");
    const filename = "b".repeat(40) + ".mp4";
    await fs.mkdir("uploads", { recursive: true });
    await fs.writeFile("uploads/" + filename, Buffer.from("0123456789"));
    await db.serviceMedia.create({
      data: {
        serviceId: svc.id,
        type: "VIDEO",
        path: "/api/uploads/" + filename,
      },
    });
    const video = await fetch(base + "/api/uploads/" + filename, {
      headers: { range: "bytes=2-5" },
    });
    assert.equal(video.status, 206);
    assert.equal(await video.text(), "2345");
    assert.equal(video.headers.get("content-range"), "bytes 2-5/10");
    assert.equal(
      (
        await fetch(base + "/api/uploads/" + filename, {
          headers: { range: "bytes=99-" },
        })
      ).status,
      416,
    );
    pass("streaming range 206 and invalid range 416");
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      slug: `renamed-${tag}`,
      title: svc.title,
      shortDescription: svc.shortDescription,
      fullDescription: svc.fullDescription,
      includes: svc.includes,
      stages: svc.stages,
      sortOrder: "0",
      isPublished: "true",
    }))
      fd.set(k, String(v));
    const renamed = await fetch(base + `/api/admin/services/${svc.id}`, {
      method: "PATCH",
      headers: { cookie: admin.cookie, "x-csrf-token": admin.token },
      body: fd,
    });
    assert.equal(renamed.status, 200, await renamed.clone().text());
    const redirect = await fetch(base + `/services/${svc.slug}`, {
      redirect: "manual",
    });
    assert.equal(redirect.status, 308);
    assert(redirect.headers.get("location")?.includes(`renamed-${tag}`));
    pass("service rename preserves permanent redirects");
    const reserve = new FormData();
    for (const [k, v] of fd.entries()) reserve.set(k, v);
    reserve.set("slug", svc.slug);
    assert.equal(
      (
        await fetch(base + "/api/admin/services", {
          method: "POST",
          headers: { cookie: admin.cookie, "x-csrf-token": admin.token },
          body: reserve,
        })
      ).status,
      409,
    );
    pass("old service addresses cannot be assigned to another service");
    const rateNow = Date.now();
    const rates = await Promise.all([consumeRate("qa-shared",tag,1,60_000,rateNow),consumeRate("qa-shared",tag,1,60_000,rateNow)]);
    assert.equal(rates.filter(r=>r.allowed).length,1);
    pass("atomic shared-storage rate limiting");
    await db.session.create({ data: { id: `expired-${tag}`, userId: client.user.id, expiresAt: new Date(0) } });
    await db.rateBucket.create({ data: { key: `expired-${tag}`, hits: 1, expiresAt: new Date(0) } });
    await db.tzLoginAttempt.create({ data: { stateHash: `expired-${tag}`, expiresAt: new Date(0) } });
    execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/jobs.ts"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
    assert.equal(await db.session.findUnique({ where: { id: `expired-${tag}` } }), null);
    assert.equal(await db.rateBucket.findUnique({ where: { key: `expired-${tag}` } }), null);
    assert.equal(await db.tzLoginAttempt.findUnique({ where: { stateHash: `expired-${tag}` } }), null);
    pass("scheduled maintenance removes expired sessions, rates and login attempts");
    await fs.writeFile(
      path.join(artifacts, "qa-fixture.json"),
      JSON.stringify(
        {
          serviceSlug: `renamed-${tag}`,
          planIds: plans.map((p) => p.id),
          adminCookie: admin.cookie,
          clientCookie: client.cookie,
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(artifacts, "integration-results.json"),
      JSON.stringify({ passed: results.length, checks: results }, null, 2),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Task failed.");
  process.exitCode = 1;
});
