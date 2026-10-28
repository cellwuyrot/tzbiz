import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/db", () => ({
  prisma: {
    legalPage: { findMany: vi.fn() },
    pageViewDaily: { upsert: vi.fn() },
    billingPlan: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRate: vi.fn(async () => ({ allowed: true })),
  requestIp: () => "isolated-security-bucket",
}));
import { prisma } from "@/lib/db";
import { analyticsPath, readConsent, privacySignal } from "@/lib/privacy";
import {
  legalDigest,
  legalSections,
  versionsMatch,
  legalState,
} from "@/lib/legal-store";
import { consentPolicy } from "@/lib/analytics-consent";
import { planInputSchema, publicPlan } from "@/lib/billing/plan";
import { POST as view } from "@/app/api/analytics/view/route";
import { POST as choose, GET as choice } from "@/app/api/privacy/consent/route";
const origin = "https://business.trioz.ru";
function req(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(origin + path, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.legalPage.findMany).mockResolvedValue([
    { slug: "privacy", publishedVersion: "privacy-v1" },
    { slug: "cookies", publishedVersion: "cookies-v1" },
  ] as never);
});
describe("privacy and consent boundaries", () => {
  it.each([
    "/admin",
    "/account",
    "/dashboard",
    "/invoices/c123456789012345678901234",
    "/?email=private",
    "/plans?utm=x",
    "https://evil.test",
    "//evil.test",
    "/api/auth/login",
  ])("excludes private or query path %s", (p) =>
    expect(analyticsPath(p)).toBeNull(),
  );
  it.each([
    "/",
    "/plans",
    "/payment",
    "/privacy",
    "/documents/offer",
    "/services/test-service",
  ])("allows public path %s", (p) => expect(analyticsPath(p)).toBe(p));
  it("defaults analytics off and rejects old unversioned analytics consent", () => {
    expect(readConsent(undefined).analytics).toBe(false);
    expect(readConsent("1:yes").analytics).toBe(false);
    expect(readConsent("1:no").chosen).toBe(true);
  });
  it("honours DNT and GPC", () => {
    expect(privacySignal(new Headers({ dnt: "1" }))).toBe(true);
    expect(privacySignal(new Headers({ "sec-gpc": "1" }))).toBe(true);
  });
  it("does not touch analytics storage without consent", async () => {
    expect((await view(req("/api/analytics/view", { path: "/" }))).status).toBe(
      204,
    );
    expect(prisma.pageViewDaily.upsert).not.toHaveBeenCalled();
    expect(prisma.legalPage.findMany).not.toHaveBeenCalled();
  });
  it("rejects cross-site collection", async () => {
    expect(
      (
        await view(
          req(
            "/api/analytics/view",
            { path: "/" },
            { origin: "https://evil.test" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(prisma.pageViewDaily.upsert).not.toHaveBeenCalled();
  });
  it("requires CSRF for saving cookie choice", async () =>
    expect(
      (await choose(req("/api/privacy/consent", { analytics: true }))).status,
    ).toBe(403));
  it("allows declining even if the database is unavailable", async () => {
    vi.mocked(prisma.legalPage.findMany).mockRejectedValueOnce(
      Error("offline"),
    );
    const r = await choose(
      req(
        "/api/privacy/consent",
        { analytics: false },
        { cookie: "trioz_csrf=test", "x-csrf-token": "test" },
      ),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toContain("HttpOnly");
    expect(r.headers.get("set-cookie")).toContain("1%3Ano");
    expect(prisma.legalPage.findMany).not.toHaveBeenCalled();
  });
  it("does not permit analytics with unpublished policies", async () => {
    vi.mocked(prisma.legalPage.findMany).mockResolvedValue([]);
    const r = await choose(
      req(
        "/api/privacy/consent",
        { analytics: true },
        { cookie: "trioz_csrf=test", "x-csrf-token": "test" },
      ),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ chosen: true, analytics: false, analyticsReady: false, notice: expect.any(String) });
    expect(r.headers.get("set-cookie")).toContain("1%3Ano");
  });
  it("stores only a daily path aggregate after valid consent", async () => {
    const policy = await consentPolicy();
    const r = await view(
      req(
        "/api/analytics/view",
        { path: "/", email: "must-not-store@example.test" },
        { cookie: `trioz_cookie_choice=1:yes:${policy}` },
      ),
    );
    expect(r.status).toBe(204);
    expect(prisma.pageViewDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          path: "/",
          views: 1,
        },
        update: { views: { increment: 1 } },
      }),
    );
    expect(
      JSON.stringify(vi.mocked(prisma.pageViewDaily.upsert).mock.calls),
    ).not.toContain("email");
  });
  it("rejects previously valid consent after policy publication", async () => {
    const policy = await consentPolicy();
    vi.mocked(prisma.legalPage.findMany).mockResolvedValue([
      { slug: "privacy", publishedVersion: "privacy-v2" },
      { slug: "cookies", publishedVersion: "cookies-v1" },
    ] as never);
    const cookie = `trioz_cookie_choice=1:yes:${policy}`;
    expect(
      (await view(req("/api/analytics/view", { path: "/" }, { cookie })))
        .status,
    ).toBe(204);
    expect(prisma.pageViewDaily.upsert).not.toHaveBeenCalled();
    const r = await choice(
      new NextRequest(origin + "/api/privacy/consent", { headers: { cookie } }),
    );
    expect(await r.json()).toMatchObject({ chosen: false, analytics: false });
  });
  it.each([{ dnt: "1" }, { "sec-gpc": "1" }])(
    "does not collect with a privacy signal",
    async (signal) => {
      const policy = await consentPolicy();
      await view(
        req("/api/analytics/view", { path: "/" }, {
          cookie: `trioz_cookie_choice=1:yes:${policy}`,
          ...signal,
        } as unknown as Record<string, string>),
      );
      expect(prisma.pageViewDaily.upsert).not.toHaveBeenCalled();
    },
  );
});
describe("versioned legal text", () => {
  it("changes digest when title or text changes", () => {
    expect(legalDigest("A", "B")).not.toBe(legalDigest("A", "C"));
    expect(legalDigest("A", "B")).not.toBe(legalDigest("C", "B"));
  });
  it("parses plain text without converting HTML into executable markup", () => {
    expect(
      legalSections("# Title\n<script>unsafe()</script>\n\nParagraph"),
    ).toEqual([
      {
        title: "Title",
        paragraphs: ["<script>unsafe()</script>", "Paragraph"],
      },
    ]);
  });
  it("requires all requested published versions to match", () => {
    expect(versionsMatch({ a: "1" }, { a: "1" }, ["a"])).toBe(true);
    expect(versionsMatch({ a: "2" }, { a: "1" }, ["a"])).toBe(false);
    expect(versionsMatch({ a: "1" }, undefined, ["a"])).toBe(false);
    expect(versionsMatch({}, {}, ["a"])).toBe(false);
  });
  it("keeps checkout closed until all mandatory documents are published", async () =>
    expect((await legalState()).ready).toBe(false));
});
const product = {
  kind: "PRODUCT",
  serviceId: null,
  title: "Подписка другого проекта",
  description: "Подробное описание продукта",
  mode: "ONE_TIME",
  settlementMode: "PREPAYMENT",
  externalProductId: "trioz-demo",
  amountRub: "123.45",
  currency: "RUB",
  periodUnit: null,
  periodCount: null,
  renewalTerms: "",
  cancellationTerms: "Отмена и возврат по согласованным условиям",
  internalNotes: "private",
  isPublished: true,
  isArchived: false,
  productType: "DIGITAL",
  projectKey: "trioz",
  projectUrl: "https://trioz.ru",
  fulfillmentTerms: "Выдача после проверки оплаты в принимающем проекте",
};
describe("cross-project catalog cards", () => {
  it("supports a priced product without a local Business service", () =>
    expect(planInputSchema.safeParse(product).success).toBe(true));
  it.each([
    "javascript:alert(1)",
    "http://trioz.ru",
    "https://user:pass@trioz.ru",
    "https://trioz.ru:444/",
    "https://trioz.ru/?secret=x",
  ])("rejects unsafe project address %s", (url) =>
    expect(
      planInputSchema.safeParse({ ...product, projectUrl: url }).success,
    ).toBe(false),
  );
  it("requires delivery conditions and product mapping before publication", () => {
    expect(
      planInputSchema.safeParse({ ...product, fulfillmentTerms: "" }).success,
    ).toBe(false);
    expect(
      planInputSchema.safeParse({ ...product, externalProductId: "" }).success,
    ).toBe(false);
  });
  it("rejects external or executable card images", () => {
    for (const url of [
      "https://tracker.test/image.png",
      "/api/uploads/../../secret.png",
      "/api/uploads/" + "a".repeat(40) + ".svg",
    ])
      expect(
        planInputSchema.safeParse({ ...product, cardImageUrl: url }).success,
      ).toBe(false);
  });
  it("does not expose internal notes or create entitlement claims", () => {
    const p = publicPlan({
      ...product,
      id: "test",
      amountMinor: 12345,
      revision: 1,
      cardImageUrl: "",
      features: "Состав",
    });
    expect(p.projectKey).toBe("trioz");
    expect(p).not.toHaveProperty("internalNotes");
    expect(p).not.toHaveProperty("accessActive");
  });
});
