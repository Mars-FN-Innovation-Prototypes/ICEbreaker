import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true });
const base = (process.env.ICEBREAKER_TEST_URL || "http://localhost:4178").replace(/\/?$/, "/");
const ready = (page) =>
  page.waitForFunction(
    () =>
      document.querySelector(".app-shell")?.getAttribute("aria-busy") ===
      "false",
  );
try {
  for (const [label, key, value] of [
    ["corrupt JSON", "icebreaker-control-definitions", "{broken"],
    [
      "invalid data types",
      "icebreaker-phase1",
      JSON.stringify({
        people: [{ name: 42 }],
        calendar: [],
        guidance: [],
        rules: [],
        messages: [],
      }),
    ],
    ["future version", "icebreaker-data-version", "unsupported-future-version"],
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base);
    await ready(page);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key,
      value,
    });
    await page.reload();
    await page
      .getByRole("heading", { name: "Your workspace is protected" })
      .waitFor();
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), key),
      value,
    );
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export recovery data" }).click();
    assert.equal(
      (await downloaded).suggestedFilename(),
      "ICEbreaker-recovery.json",
    );
    await context.close();
    console.log(`PASS ${label} is retained and recoverable`);
  }
  const context = await browser.newContext();
  const first = await context.newPage();
  await first.goto(base);
  await ready(first);
  const second = await context.newPage();
  await second.goto(base);
  await ready(second);
  await second.evaluate(() =>
    localStorage.setItem(
      "icebreaker-saved-views",
      JSON.stringify([
        {
          name: "Newer view",
          process: "All processes",
          status: "All statuses",
          evidence: "All evidence rules",
          audience: "Controllers",
        },
      ]),
    ),
  );
  await first
    .getByRole("heading", { name: "Your workspace is protected" })
    .waitFor();
  assert.match(await first.locator("body").innerText(), /another tab/);
  assert.match(
    await second.evaluate(() => localStorage.getItem("icebreaker-saved-views")),
    /Newer view/,
  );
  await context.close();
  console.log(
    "PASS stale tabs stop editing instead of overwriting newer records",
  );
  const secure = await browser.newContext();
  const page = await secure.newPage();
  await page.goto(base);
  await ready(page);
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  assert.match(csp, /script-src 'self';/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.unsafeInlineExecuted = true";
    document.body.append(script);
  });
  assert.equal(
    await page.evaluate(() => window.unsafeInlineExecuted),
    undefined,
  );
  console.log("PASS built-page CSP blocks inline script execution");
  await secure.close();
} finally {
  await browser.close();
}
