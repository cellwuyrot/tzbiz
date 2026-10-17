/** Optional QA tool: requires Playwright separately. Never run on production. */
const { chromium } = require("playwright"),
  fs = require("fs");
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3300",
  dir = process.env.INTEGRATION_ARTIFACT_DIR || "data/integration-artifacts";
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) ||
  !/^file:.*integration/.test(process.env.DATABASE_URL || "")
)
  throw Error("Only disposable local integration SQLite databases allowed.");
(async () => {
  const b = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const f = JSON.parse(fs.readFileSync(dir + "/qa-fixture.json")),
      c = await b.newContext({ viewport: { width: 390, height: 900 } });
    await c.addCookies([
      ...f.adminCookie.split("; ").map((s) => {
        let i = s.indexOf("=");
        return { name: s.slice(0, i), value: s.slice(i + 1), url: base };
      }),
      { name: "trioz_cookie_choice", value: "1:no", url: base },
    ]);
    const p = await c.newPage(),
      results = [];
    await p.goto(base + "/admin");
    for (const status of [401, 403, 503]) {
      await p.route("**/api/admin/integrations", (r) =>
        r.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({
            error: "База данных недоступна.",
            requestId: "QA-SAFE-ID",
          }),
        }),
      );
      await p.getByRole("button", { name: "Интеграции", exact: true }).click();
      await p.locator("p[role=alert]").waitFor();
      results.push({
        status,
        message: await p.locator("p[role=alert]").innerText(),
      });
      if (await p.getByText("Загрузка состояния…", { exact: true }).isVisible())
        throw Error("Stuck loading");
      await p.screenshot({
        path: `${dir}/error-${status}-390.png`,
        fullPage: true,
      });
      await p.getByRole("button", { name: "Клиенты", exact: true }).click();
      await p.unroute("**/api/admin/integrations");
    }
    await p.getByRole("button", { name: "Интеграции", exact: true }).click();
    await p
      .getByRole("heading", { name: "Почта / SMTP", exact: true })
      .waitFor();
    results.push({ state: "integration-recovery", ok: true });
    await p.getByRole("button", { name: "Счета", exact: true }).click();
    for (const method of ["BANK_TRANSFER", "ACQUIRING", "RECURRING"]) {
      await p.getByLabel(/Способ оплаты/).selectOption(method);
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Invoice overflow " + method);
      await p.screenshot({
        path: `${dir}/invoice-form-${method}-390.png`,
        fullPage: true,
      });
      results.push({ method, noOverflow: true });
    }
    for (const width of [1440, 390]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(base + "/invoices/" + f.invoiceIds[0]);
      await p.screenshot({
        path: `${dir}/invoice-view-${width}.png`,
        fullPage: true,
      });
      await p.emulateMedia({ media: "print" });
      if (
        await p
          .locator(".privacy-controls")
          .evaluate((el) => getComputedStyle(el).display !== "none")
      )
        throw Error("Cookie control visible in print");
      await p.pdf({
        path: `${dir}/invoice-${width}.pdf`,
        format: "A4",
        printBackground: true,
      });
      await p.emulateMedia({ media: "screen" });
      results.push({ printWidth: width, cookieControlsHidden: true });
    }
    fs.writeFileSync(
      dir + "/print-errors-results.json",
      JSON.stringify({ ok: true, results }, null, 2),
    );
    console.log(JSON.stringify({ ok: true, states: results.length }));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
