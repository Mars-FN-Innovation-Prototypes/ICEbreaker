import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pre-renders the scalable ICEbreaker control tower without a server runtime", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>ICEbreaker \| Digitalized Controls Hub<\/title>/i);
  assert.match(html, /See risk sooner\. Act before it grows\./);
  assert.match(html, /Enterprise control health/i);
  assert.match(html, /Review of Completed Questionnaires in Enablon/);
  assert.match(html, /Controls in scope<\/span><strong>\d+/);
  assert.match(html, /Sustainability Controls/);
  assert.match(html, /Detailed workflow status/);
  assert.match(html, /Evidence rules scoped/);
  assert.match(html, /Needs your attention/);
  assert.match(html, /og:image/);
  assert.match(html, /https?:\/\/[^"']+\/og\.png/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/);
  assert.doesNotMatch(
    html,
    /codex-preview|Your site is taking shape|react-loading-skeleton/i,
  );
});

test("keeps the MVP accessible, functional and brand-aligned", async () => {
  const [pageSource, layout, css, packageJson, phase1] = await Promise.all([
    readFile(new URL("../app/icebreaker-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/phase1-workspace.tsx", import.meta.url), "utf8"),
  ]);
  const page = pageSource + phase1;

  assert.match(page, /aria-label="Primary navigation"/);
  assert.match(page, /aria-label="Control detail panel"/);
  assert.match(page, /My controls/);
  assert.match(page, /Control Owner/);
  assert.match(page, /Demo Account/);
  assert.match(page, /test account directory/i);
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
  assert.match(page, /Save draft/);
  assert.match(page, /partial draft/i);
  assert.match(page, /Performed with deviations/);
  assert.match(page, /Your procedure review is confirmed/);
  assert.match(page, /Previous-period evidence/);
  assert.match(page, /No prior-period evidence is available/);
  assert.match(page, /SharePoint or evidence link/);
  assert.match(page, /Evidence is restricted to the assigned owner/);
  assert.match(page, /Guidance is shared; evidence stays restricted/);
  assert.match(page, /Azure handoff/);
  assert.match(page, /Desktop procedure/);
  assert.match(page, /simulated reminder/i);
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
  assert.match(page, /Apply validated changes/);
  assert.match(page, /Cancel import/);
  assert.match(page, /Matching key: Control # \+ Region \+ Country \+ Unit/);
  assert.match(page, /existing controls untouched/);
  assert.match(page, /execution records, DTPs, evidence and audit history are not\s+deleted or replaced/);
  assert.match(page, /Recent ownership activity/);
  assert.match(page, /Request reassignment/);
  assert.match(page, /responsibility handover/);
  assert.match(page, /Gap remediation/);
  assert.match(page, /Controller closure approval/);
  assert.match(page, /Controller correction saved/);
  assert.match(page, /Owner execution, evidence, certification and history retained/);
  assert.match(page, /Procedure steps/);
  assert.match(page, /Control Owner-managed DTP/);
  assert.match(page, /Save procedure draft/);
  assert.match(page, /Confirm procedure current/);
  assert.match(page, /Control Owner tasks/);
  assert.match(page, /Procedure & execution/);
  assert.match(page, /Support & certify/);
  assert.match(page, /Procedure last reviewed/);
  assert.match(page, /Your review confirmation/);
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
  assert.match(page, /Not scoped/);
  assert.match(page, /Control lifecycle/);
  assert.match(page, /Archived/);
  assert.match(page, /Certification readiness/);
  assert.match(page, /Clear all filters/);
  assert.match(page, /All DTP statuses/);
  assert.ok(page.includes("Current / confirmed"));
  assert.ok(page.includes("Submitted / needs review"));
  assert.ok(page.includes("Missing / not added"));
  assert.match(page, /Control list pagination/);
  assert.match(page, /Showing \{start\}-\{end\} of \{total\} controls/);
  assert.match(page, /From: \{m.sender\} via ICEbreaker/);
  assert.doesNotMatch(page, /visibleControls\.slice\(0,\s*8\)/);
  assert.doesNotMatch(page, /controls\.slice\(0,\s*10\)/);
  assert.match(page, /workflow-status-grid/);
  assert.match(page, /brand\/logo-lockup\.png/);
  assert.match(page, /brand\/better-food-text\.png/);
  assert.match(layout, /brand\/globe-badge\.png/);
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
  assert.match(inventory, /evidenceRequirement: "Not scoped"/);
  assert.match(inventory, /lifecycle: "Active"/);
  assert.equal((fullData.match(/["']?controlNumber["']?:/g) || []).length, 133);
  assert.match(fullData, /INV\.PD\.01/);
  assert.match(fullData, /Sustainability Controls/);
  assert.match(fullData, /"country": "Netherlands"/);
  assert.match(fullData, /"country": "UK"/);
});
