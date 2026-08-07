import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://icebreaker.example/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
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
  assert.match(html, /Review of Completed Questionnaires in Enablon/);
  assert.match(html, /Controls in scope<\/span><strong>132/);
  assert.match(html, /Sustainability Controls/);
  assert.match(html, /Needs your attention/);
  assert.match(html, /og:image/);
  assert.match(html, /https?:\/\/[^\"']+\/og\.png/);
  assert.doesNotMatch(
    html,
    /codex-preview|Your site is taking shape|react-loading-skeleton/i,
  );
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
  assert.match(page, /only\s+assignable user until enterprise identity is connected/);
  assert.match(page, /Active review & reporting cycle/);
  assert.match(page, /icebreaker-scope/);
  assert.match(page, /Countries/);
  assert.match(page, /Units & sites/);
  assert.match(page, /Unit \/ site/);
  assert.match(page, /site-readiness-table/);
  assert.doesNotMatch(page, /Change application role/);
  assert.doesNotMatch(page, /Erica Schmidt/);
  assert.match(page, /Admin setup/);
  assert.match(page, /Download CSV/);
  assert.match(page, /I confirm and accept ownership/);
  assert.match(page, /Acknowledge & save/);
  assert.match(page, /return later to perform and\s+certify/);
  assert.match(page, /Ownership acknowledged/);
  assert.match(page, /Save execution progress/);
  assert.match(page, /Performed with deviations/);
  assert.match(page, /I reviewed the current desktop procedure/);
  assert.match(page, /Previous-period evidence/);
  assert.match(page, /Desktop procedure/);
  assert.match(page, /Simulated reminder/);
  assert.match(page, /MVP behavior: no email is sent/);
  assert.match(page, /Help center & 101/);
  assert.match(page, /Leadership.*Site owners.*Controllers/s);
  assert.match(page, /ICEbreaker-101\.docx/);
  assert.doesNotMatch(page, /Petcare|Snacking|\bCertifier\b/);
  assert.match(page, /localStorage/);
  assert.match(page, /importWorkbook/);
  assert.match(page, /Evidence Needed \(Y\/N\)/);
  assert.match(page, /Attestation Frequency/);
  assert.match(page, /Control Pillar/);
  assert.match(page, /Apply validated import/);
  assert.match(page, /Recent ownership changes/);
  assert.match(page, /Handover of responsibilities is complete/);
  assert.match(page, /Gap remediation/);
  assert.match(page, /Controller closure approval/);
  assert.match(page, /Procedure steps/);
  assert.match(page, /Save DTP guidance/);
  assert.match(page, /Save DTP update/);
  assert.match(page, /Version history/);
  assert.match(page, /What happens after submission/);
  assert.match(page, /Submit gap/);
  assert.match(page, /Submit request/);
  assert.match(page, /ICEbreaker-Stakeholder-Review-Guide\.docx/);
  assert.match(page, /executionKey\(period/);
  assert.match(page, /Array\.isArray\(parsed\)/);
  assert.match(page, /ControlDrawerBoundary/);
  assert.match(page, /Your workspace is still available/);
  assert.match(page, /updateControl/);
  assert.match(page, /\/brand\/logo-lockup\.png/);
  assert.match(page, /\/brand\/better-food-text\.png/);
  assert.match(layout, /requestHeaders\.get\("x-forwarded-host"\)/);
  assert.match(layout, /\/brand\/globe-badge\.png/);
  assert.match(css, /--pea:\s*#62bb46/);
  assert.match(css, /--mars-blue:\s*#0000a0/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  const [inventory, fullData] = await Promise.all([
    readFile(new URL("../app/inventory-controls.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/full-controls-data.ts", import.meta.url), "utf8"),
  ]);
  assert.match(inventory, /fullControlRows\.map/);
  assert.match(inventory, /instanceId/);
  assert.match(inventory, /Demo Account/);
  assert.equal((fullData.match(/["']?controlNumber["']?:/g) || []).length, 133);
  assert.match(fullData, /INV\.PD\.01/);
  assert.match(fullData, /Sustainability Controls/);
  assert.match(fullData, /"country": "Netherlands"/);
  assert.match(fullData, /"country": "UK"/);
});
