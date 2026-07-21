import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://icebreaker.example/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the scalable ICEbreaker control tower", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ICEbreaker \| Digitalized Controls Hub<\/title>/i);
  assert.match(html, /See risk sooner\. Act before it grows\./);
  assert.match(html, /Enterprise control health/i);
  assert.match(html, /Creation and Changes to Bill of Materials/);
  assert.match(html, /Needs your attention/);
  assert.match(html, /og:image/);
  assert.match(html, /https?:\/\/[^\"']+\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the MVP accessible, functional and brand-aligned", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/icebreaker-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /aria-label="Primary navigation"/);
  assert.match(page, /aria-label="Control detail panel"/);
  assert.match(page, /My controls/);
  assert.match(page, /Control Owner/);
  assert.match(page, /Demo Account/);
  assert.match(page, /only assignable user in this MVP/);
  assert.match(page, /Active review & reporting cycle/);
  assert.doesNotMatch(page, /Change application role/);
  assert.doesNotMatch(page, /Erica Schmidt/);
  assert.match(page, /Admin setup/);
  assert.match(page, /Download CSV/);
  assert.match(page, /I confirm and accept ownership/);
  assert.match(page, /Desktop procedure/);
  assert.match(page, /Simulated reminder/);
  assert.match(page, /Help center & 101/);
  assert.match(page, /Leadership.*Site owners.*Controllers/s);
  assert.match(page, /ICEbreaker-101\.docx/);
  assert.doesNotMatch(page, /Petcare|Snacking|\bCertifier\b/);
  assert.match(page, /localStorage/);
  assert.match(page, /importCsv/);
  assert.match(page, /updateControl/);
  assert.match(page, /\/brand\/logo-lockup\.png/);
  assert.match(page, /\/brand\/better-food-text\.png/);
  assert.match(layout, /requestHeaders\.get\("x-forwarded-host"\)/);
  assert.match(css, /--pea:\s*#62bb46/);
  assert.match(css, /--mars-blue:\s*#0000a0/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  const inventory = await readFile(new URL("../app/inventory-controls.ts", import.meta.url), "utf8");
  assert.match(inventory, /INV\.PD\.01/);
  assert.doesNotMatch(inventory, /INV\.CT\.06|INV\.CT\.09/);
});
