/** Optional QA tool: requires Playwright separately. Never run on production. */
const { chromium } = require("playwright"),
  fs = require("fs");
const dir =
    process.env.INTEGRATION_ARTIFACT_DIR || "data/integration-artifacts",
  base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3300";
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) ||
  !/^file:.*integration/.test(process.env.DATABASE_URL || "")
)
  throw Error("Only disposable local integration SQLite databases allowed.");
(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const f = JSON.parse(fs.readFileSync(dir + "/qa-fixture.json", "utf8")),
      context = await browser.newContext();
    await context.addCookies([
      ...f.adminCookie.split("; ").map((x) => {
        const i = x.indexOf("=");
        return { name: x.slice(0, i), value: x.slice(i + 1), url: base };
      }),
      { name: "trioz_cookie_choice", value: "1:no", url: base },
    ]);
    const page = await context.newPage(),
      errors = [],
      results = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/admin");
    const tabs = [
      ["Услуги", "services"],
      ["Проекты", "projects"],
      ["Заявки", "leads"],
      ["Клиенты", "clients"],
      ["Настройки сайта", "settings"],
      ["Интеграции", "integrations"],
      ["Товары и подписки", "catalog"],
      ["Счета", "invoices"],
      ["Продажи и условия", "commerce"],
      ["Документы", "documents"],
      ["Аналитика", "analytics"],
    ];
    async function shot(name, width, full = true) {
      await page.waitForTimeout(250);
      const w = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      results.push({ name, ...w });
      await page.screenshot({
        path: `${dir}/${name}-${width}.png`,
        fullPage: full,
      });
      if (w.scroll > w.width + 1)
        throw Error(`Overflow ${name}: ${w.scroll}>${w.width}`);
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [label, key] of tabs) {
        await page.getByRole("button", { name: label, exact: true }).click();
        await page.waitForTimeout(400);
        await shot("admin-" + key, width);
      }
    }
    // Browser edits a draft; public publication must remain intact.
    await page.getByRole("button", { name: "Документы", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Политика обработки персональных данных",
        exact: true,
      })
      .click();
    const legalArea = page.getByLabel(
      "Текст документа · заголовки начинаются с #",
    );
    await legalArea.fill(
      (await legalArea.inputValue()) +
        "\n\n# UI-проверка черновика\nСохранено через интерфейс, без публикации.",
    );
    await page
      .getByRole("button", { name: "Сохранить черновик", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Черновик сохранён" })
      .waitFor();
    results.push({ name: "legal-draft-ui-save", ok: true });
    for (const route of [
      "/plans",
      "/plans/" + f.productId,
      "/documents",
      "/privacy",
      "/documents/offer",
      "/documents/cookies",
      "/documents/consent",
      "/account",
    ]) {
      await page.goto(base + route);
      await shot("public-" + route.replaceAll("/", "-"), 390);
    }
    // Client submits actual current versions with three independent acknowledgements.
    await context.clearCookies();
    await context.addCookies([
      ...f.clientCookie.split("; ").map((x) => {
        const i = x.indexOf("=");
        return { name: x.slice(0, i), value: x.slice(i + 1), url: base };
      }),
      { name: "trioz_cookie_choice", value: "1:no", url: base },
    ]);
    await page.goto(base + "/plans/" + f.productId);
    await page
      .getByLabel("Опишите задачу")
      .fill("UI проверка заявки на продукт TrioZ без фиктивной активации.");
    for (const checkbox of await page
      .locator("form input[type=checkbox]")
      .all())
      await checkbox.check();
    const submitResponse = page.waitForResponse(
      (r) =>
        r.url() === base + "/api/orders" && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Отправить заявку", exact: true })
      .click();
    const submitted = await submitResponse;
    if (submitted.status() !== 201)
      throw Error(
        "Order UI status " +
          submitted.status() +
          ": " +
          (await submitted.text()),
      );
    await page
      .getByRole("heading", { name: "Заявка сохранена", exact: true })
      .waitFor();
    results.push({ name: "client-product-order-ui", ok: true });
    await shot("client-order-success", 390);
    // New anonymous context: consent is not silently granted.
    const anonymous = await browser.newContext({
        viewport: { width: 390, height: 900 },
      }),
      p = await anonymous.newPage(),
      views = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      if (r.url().endsWith("/api/analytics/view")) views.push(r.postData());
    });
    await p.goto(base + "/plans");
    await p
      .getByRole("heading", { name: "Cookie и аналитика", exact: true })
      .waitFor();
    await p.waitForTimeout(400);
    if (views.length) throw Error("Analytics before consent");
    await p.screenshot({
      path: dir + "/cookie-initial-390.png",
      fullPage: false,
    });
    await p
      .getByRole("button", { name: "Разрешить аналитику", exact: true })
      .click();
    await p.getByRole("button", { name: "Cookie", exact: true }).waitFor();
    await p.waitForTimeout(400);
    if (views.length !== 1)
      throw Error("Consent did not enable a single page view");
    await p.goto(base + "/payment");
    await p.waitForTimeout(500);
    if (views.length !== 2)
      throw Error("Consented public navigation not counted");
    await p.getByRole("button", { name: "Cookie", exact: true }).click();
    await p
      .getByRole("button", { name: "Только необходимые", exact: true })
      .click();
    await p.getByRole("button", { name: "Cookie", exact: true }).waitFor();
    const previous = views.length;
    await p.goto(base + "/plans");
    await p.waitForTimeout(500);
    if (views.length !== previous)
      throw Error("Analytics continued after withdrawal");
    await p.getByRole("button", { name: "Cookie", exact: true }).click();
    await p.getByText("Аналитика: отключена", { exact: true }).waitFor();
    await p.screenshot({
      path: dir + "/cookie-withdrawn-390.png",
      fullPage: false,
    });
    results.push({
      name: "cookie-ui-opt-in-withdrawal",
      requests: views.length,
      ok: true,
    });
    await anonymous.close();
    if (errors.length) throw Error(errors.join(";"));
    fs.writeFileSync(
      dir + "/ui-v12-results.json",
      JSON.stringify({ ok: true, results, browserErrors: errors }, null, 2),
    );
    console.log(
      JSON.stringify(
        { ok: true, states: results.length, browserErrors: errors },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
