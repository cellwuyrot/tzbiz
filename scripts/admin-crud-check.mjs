import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3300";
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) ||
  !/^file:.*integration/.test(process.env.DATABASE_URL || "")
)
  throw Error("Only disposable local integration databases allowed.");
const dir =
  process.env.INTEGRATION_ARTIFACT_DIR ||
  path.join(process.cwd(), "data/integration-artifacts");
const f = JSON.parse(
  await fs.readFile(path.join(dir, "qa-fixture.json"), "utf8"),
);
const token = f.adminCookie
  .split("; ")
  .find((s) => s.startsWith("trioz_csrf="))
  .slice("trioz_csrf=".length);
const tag = crypto.randomBytes(5).toString("hex"),
  checks = [];
async function api(url, method = "GET", body) {
  const form = body instanceof FormData;
  return fetch(base + url, {
    method,
    headers: {
      cookie: f.adminCookie,
      "x-csrf-token": token,
      ...(body && !form ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
  });
}
function pass(s) {
  checks.push(s);
  console.log("PASS " + s);
}
const create = await api("/api/admin/clients", "POST", {
  name: "Тестовый клиент CRUD",
  email: `crud-${tag}@example.test`,
});
assert.equal(create.status, 201);
const client = (await create.json()).client;
assert.equal(
  (
    await api(`/api/admin/clients/${client.id}`, "PATCH", {
      name: "Обновлённый клиент",
      email: client.email,
    })
  ).status,
  200,
);
assert.equal(
  (await api(`/api/admin/clients/${client.id}/reset-password`, "POST", {}))
    .status,
  200,
);
pass("client create, edit and password reset");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=",
  "base64",
);
function projectForm(preview = true) {
  const b = new FormData();
  Object.entries({
    title: "Тестовый проект",
    description: "Тестовая карточка проекта",
    projectUrl: "https://example.test/project",
    status: "IN_PROGRESS",
    clientId: client.id,
    isPublic: "false",
  }).forEach(([k, v]) => b.set(k, v));
  if (preview)
    b.set("preview", new Blob([png], { type: "image/png" }), "preview.png");
  return b;
}
const cp = await api("/api/admin/projects", "POST", projectForm());
assert.equal(cp.status, 201, await cp.clone().text());
const project = (await cp.json()).project;
const edit = projectForm(false);
edit.set("status", "DONE");
assert.equal(
  (await api(`/api/admin/projects/${project.id}`, "PATCH", edit)).status,
  200,
);
assert.equal(
  (await api(`/api/admin/projects/${project.id}`, "DELETE")).status,
  200,
);
pass("project create, status edit and deletion with uploaded preview");
const svc = new FormData();
Object.entries({
  slug: `crud-${tag}`,
  title: "Тестовая услуга CRUD",
  shortDescription: "Короткое описание",
  fullDescription: "Полное описание услуги",
  includes: '["Работа"]',
  stages: '["Первый этап"]',
  sortOrder: "99",
  isPublished: "false",
}).forEach(([k, v]) => svc.set(k, v));
svc.set("media", new Blob([png], { type: "image/png" }), "test.png");
const sc = await api("/api/admin/services", "POST", svc);
assert.equal(sc.status, 201, await sc.clone().text());
const service = (await sc.json()).service;
const media = service.media[0];
assert.equal(
  (
    await api(`/api/admin/services/${service.id}/media/${media.id}`, "PATCH", {
      sortOrder: 10,
    })
  ).status,
  200,
);
assert.equal(
  (await api(`/api/admin/services/${service.id}/media/${media.id}`, "DELETE"))
    .status,
  200,
);
assert.equal(
  (await api(`/api/admin/services/${service.id}`, "DELETE")).status,
  200,
);
pass("service creation, media reorder, media deletion and service deletion");
const ss = (await (await api("/api/admin/site-settings")).json()).settings;
assert.equal(
  (
    await api("/api/admin/site-settings", "PATCH", {
      ...ss,
      tagline: "Тестовая проверка сохранения настроек",
    })
  ).status,
  200,
);
assert.equal((await api("/api/admin/site-settings", "PATCH", ss)).status, 200);
pass("site settings save and restore");
assert.equal(
  (await api(`/api/admin/clients/${client.id}`, "DELETE")).status,
  200,
);
pass("client without financial history can be deleted");
await fs.writeFile(
  path.join(dir, "admin-crud-results.json"),
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
