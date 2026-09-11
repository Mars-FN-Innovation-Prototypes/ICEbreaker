import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import writeXlsxFile from "write-excel-file/node";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const base = process.env.ICEBREAKER_TEST_URL || "http://localhost:5173";
await mkdir("work/qa", { recursive: true });
const store = (key) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), key);
const close = async () =>
  page.locator(".control-drawer .drawer-header button").click();
const profile = async (role, user) => {
  await page
    .getByRole("button", { name: "Open Demo Account profile and change role" })
    .click();
  if (user) {
    await page
      .getByRole("combobox", { name: "Active test account", exact: true })
      .selectOption(user);
    await page
      .getByRole("button", {
        name: "Open Demo Account profile and change role",
      })
      .click();
  }
  await page.getByRole("button", { name: new RegExp(`^${role}`) }).click();
};
const nav = (name) =>
  page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name, exact: false })
    .click();
try {
  await page.goto(base);
  await page.waitForFunction(
    () =>
      document.querySelector(".app-shell")?.getAttribute("aria-busy") ===
      "false",
  );
  await page
    .getByRole("combobox", { name: "Certification period" })
    .selectOption("Q3 2026");
  await page.waitForTimeout(500);
  await profile("Control Owner");
  await page
    .getByRole("button", {
      name: /Review of Completed Questionnaires in Enablon/,
    })
    .first()
    .click();
  let drawer = page.getByLabel("Control detail panel");
  await drawer
    .getByRole("checkbox", { name: /I confirm and accept ownership/ })
    .check();
  await drawer
    .getByRole("checkbox", { name: /I understand the requirement/ })
    .check();
  await drawer
    .getByRole("button", { name: "Acknowledge & save", exact: true })
    .click();
  const executions = await store("icebreaker-executions");
  const key = Object.keys(executions).find((k) => executions[k].acknowledgedAt);
  assert.ok(key);
  const id = executions[key].controlId;
  assert.equal(executions[key].performed, false);
  await close();
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector(".app-shell")?.getAttribute("aria-busy") ===
      "false",
  );
  await page
    .getByRole("combobox", { name: "Certification period" })
    .selectOption("Q3 2026");
  await profile("Control Owner");
  await page
    .getByRole("button", {
      name: /Review of Completed Questionnaires in Enablon/,
    })
    .first()
    .click();
  drawer = page.getByLabel("Control detail panel");
  assert.ok(
    await drawer
      .getByRole("button", { name: "Acknowledgement saved" })
      .isVisible(),
  );
  console.log("PASS separate acknowledgement persists without execution");
  await drawer.getByRole("button", { name: /Procedure & execution/ }).click();
  await drawer
    .getByLabel("Procedure steps", { exact: true })
    .fill(
      "1. Review the test report.\n2. Check source records.\n3. Record exceptions.",
    );
  await drawer
    .locator('.dtp-upload input[type="file"]')
    .setInputFiles({
      name: "test-procedure.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Synthetic procedure version 1"),
    });
  await drawer
    .getByRole("button", { name: "Confirm procedure current", exact: true })
    .click();
  await drawer
    .locator('input[type="file"]')
    .last()
    .setInputFiles({
      name: "test-evidence.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Synthetic evidence"),
    });
  await page.waitForTimeout(200);
  await drawer
    .getByRole("combobox", { name: /Execution outcome/ })
    .selectOption("Performed as documented");
  await drawer
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  assert.equal((await store("icebreaker-executions"))[key].performed, true);
  let files = await store("icebreaker-attachments");
  assert.ok(files[key][0].startsWith("ice-file:"));
  const downloadWait = page.waitForEvent("download");
  await drawer
    .getByRole("button", { name: "⇩ test-evidence.txt", exact: true })
    .click();
  const download = await downloadWait;
  assert.equal(
    await readFile(await download.path(), "utf8"),
    "Synthetic evidence",
  );
  await drawer
    .getByLabel("Procedure steps", { exact: true })
    .fill("Synthetic procedure version 2");
  await drawer
    .locator('.dtp-upload input[type="file"]')
    .setInputFiles({
      name: "test-procedure-v2.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Synthetic procedure version 2"),
    });
  await drawer
    .getByRole("button", { name: "Confirm procedure current", exact: true })
    .click();
  const definition = (await store("icebreaker-control-definitions")).find(
    (c) => c.id === id,
  );
  assert.equal(definition.dtpHistory.length, 1);
  assert.ok(definition.dtpHistory[0].document.includes("test-procedure.txt"));
  const priorDownload = page.waitForEvent("download");
  await drawer
    .getByRole("button", { name: "⇩ test-procedure.txt", exact: true })
    .click();
  assert.equal(
    await readFile(await (await priorDownload).path(), "utf8"),
    "Synthetic procedure version 1",
  );
  await page.screenshot({
    path: "work/qa/owner-procedure.png",
    fullPage: true,
  });
  console.log("PASS local evidence download and retained DTP version content");
  await drawer.getByRole("button", { name: /^1\s*Ownership/ }).click();
  await drawer
    .getByRole("button", { name: "Request reassignment", exact: true })
    .click();
  await drawer
    .getByRole("combobox", { name: "New Control Owner", exact: true })
    .selectOption("Demo Owner Two");
  await drawer
    .getByRole("checkbox", {
      name: /I have completed the responsibility handover/,
    })
    .check();
  await drawer
    .getByRole("checkbox", { name: /I have completed training/ })
    .check();
  await drawer
    .getByRole("button", { name: "Submit reassignment request", exact: true })
    .click();
  assert.equal(
    (await store("icebreaker-executions"))[key].owner,
    "Demo Account",
  );
  await close();
  await profile("Controller Admin");
  await nav("Controls library");
  await page
    .getByText("Review of Completed Questionnaires in Enablon", { exact: true })
    .first()
    .click();
  drawer = page.getByLabel("Control detail panel");
  await drawer
    .getByRole("button", { name: "Approve reassignment", exact: true })
    .click();
  const reassigned = (await store("icebreaker-executions"))[key];
  assert.equal(reassigned.owner, "Demo Owner Two");
  assert.equal(reassigned.accepted, false);
  assert.equal(reassigned.performed, true);
  assert.equal(
    (await store("icebreaker-ownership-changes"))[0].status,
    "Completed",
  );
  await close();
  await profile("Control Owner", "Demo Owner Two");
  await page
    .getByRole("button", {
      name: /Review of Completed Questionnaires in Enablon/,
    })
    .first()
    .click();
  assert.equal(
    await page
      .getByLabel("Control detail panel")
      .getByRole("checkbox", { name: /I confirm and accept ownership/ })
      .isChecked(),
    false,
  );
  console.log(
    "PASS approved reassignment keeps history and resets new-owner acknowledgement",
  );
  await page
    .getByLabel("Control detail panel")
    .getByRole("button", { name: "Ask for guidance", exact: true })
    .last()
    .click();
  await page
    .getByRole("textbox", { name: /What guidance do you need/ })
    .fill("How should I validate the synthetic evidence?");
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await close();
  await nav("Guidance requests");
  assert.ok(
    await page
      .getByText("How should I validate the synthetic evidence?", {
        exact: true,
      })
      .isVisible(),
  );
  await profile("Controller Admin");
  await nav("Guidance requests");
  await page
    .getByRole("textbox", { name: "Reply", exact: true })
    .fill("Compare the test source records and record differences.");
  await page.getByRole("button", { name: "Save reply", exact: true }).click();
  await profile("Control Owner");
  await nav("Guidance requests");
  assert.ok(
    await page
      .getByText("Compare the test source records and record differences.", {
        exact: true,
      })
      .isVisible(),
  );
  await page.getByRole("button", { name: "Mark resolved" }).click();
  assert.equal(
    (await store("icebreaker-phase1")).guidance[0].status,
    "Resolved",
  );
  console.log("PASS guidance request, Controller reply and Owner resolution");
  await profile("Controller Admin");
  await nav("Admin setup");
  await page.getByRole("button", { name: "Reminders", exact: true }).click();
  await page.getByLabel("Simulation date", { exact: true }).fill("2026-09-16");
  await page
    .getByRole("button", { name: "Generate simulated reminders" })
    .click();
  const logCount = (await store("icebreaker-phase1")).messages.length;
  assert.ok(logCount > 0);
  await page
    .getByRole("button", { name: "Generate simulated reminders" })
    .click();
  assert.equal((await store("icebreaker-phase1")).messages.length, logCount);
  console.log("PASS reminder cadence and duplicate suppression");
  await page.getByRole("button", { name: "Test data", exact: true }).click();
  const backupDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export test workspace with documents" })
    .click();
  const backupPath = await (await backupDownload).path();
  const backup = JSON.parse(await readFile(backupPath, "utf8"));
  assert.ok(backup.files.length >= 3);
  await page.getByLabel("Choose backup").setInputFiles(backupPath);
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await page.waitForTimeout(600);
  assert.equal(
    (await store("icebreaker-executions"))[key].owner,
    "Demo Owner Two",
  );
  console.log("PASS complete backup and restore round trip");
  await nav("Reports");
  await page
    .getByRole("button", {
      name: "Delete saved view Leadership control health",
      exact: true,
    })
    .click();
  assert.equal((await store("icebreaker-saved-views")).length, 2);
  await page.screenshot({
    path: "work/qa/controller-report.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log("PASS saved-view deletion and no uncaught browser errors");
  await nav("Controls library");
  await page
    .getByText("Review of Completed Questionnaires in Enablon", { exact: true })
    .first()
    .click();
  drawer = page.getByLabel("Control detail panel");
  await drawer
    .getByText("Global framework reference (read only)", { exact: true })
    .click();
  assert.equal(
    await drawer
      .locator(".admin-detail-fields textarea")
      .last()
      .getAttribute("readonly"),
    "",
  );
  await drawer
    .getByRole("combobox", { name: /Evidence requirement/ })
    .selectOption("Required");
  await drawer
    .getByRole("button", { name: "Save control requirements", exact: true })
    .click();
  assert.equal((await store("icebreaker-executions"))[key].performed, true);
  await close();
  await profile("Control Owner", "Demo Owner Two");
  await page
    .getByRole("button", {
      name: /Review of Completed Questionnaires in Enablon/,
    })
    .first()
    .click();
  drawer = page.getByLabel("Control detail panel");
  await drawer
    .getByRole("checkbox", { name: /I confirm and accept ownership/ })
    .check();
  await drawer
    .getByRole("checkbox", { name: /I understand the requirement/ })
    .check();
  await drawer
    .getByRole("button", { name: "Acknowledge & save", exact: true })
    .click();
  await drawer.getByRole("button", { name: /Procedure & execution/ }).click();
  await drawer
    .getByRole("checkbox", { name: /I reviewed the current desktop procedure/ })
    .check();
  await drawer
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  await drawer
    .getByRole("button", { name: "Certify control", exact: true })
    .click();
  assert.equal((await store("icebreaker-executions"))[key].status, "Certified");
  assert.equal((await store("icebreaker-executions"))[key].due, "2026-09-30");
  await page
    .getByRole("combobox", { name: "Certification period" })
    .selectOption("FY 2026");
  await page
    .getByRole("button", {
      name: /Review of Completed Questionnaires in Enablon/,
    })
    .first()
    .click();
  assert.equal(
    await page
      .getByLabel("Control detail panel")
      .getByRole("checkbox", { name: /I confirm and accept ownership/ })
      .isChecked(),
    false,
  );
  await close();
  console.log(
    "PASS certification, safe admin correction and fresh period confirmations",
  );
  await profile("Controller Admin");
  await nav("Admin setup");
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  const calendarRows = [
    [
      "Period",
      "Start",
      "End",
      "Quarter End (Y/N)",
      "Half Year End (Y/N)",
      "Year End (Y/N)",
    ],
    ["Test P01", "2027-01-01", "2027-01-28", "N", "N", "N"],
    ["Test P03", "2027-02-26", "2027-03-25", "Y", "N", "N"],
  ];
  const calendarFile = await writeXlsxFile(
    calendarRows.map((row) => row.map((value) => ({ value }))),
    { buffer: true },
  );
  await page
    .getByLabel("Import calendar")
    .setInputFiles({
      name: "calendar.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: calendarFile,
    });
  await page
    .getByRole("button", { name: "Apply calendar", exact: true })
    .click();
  assert.equal((await store("icebreaker-phase1")).calendar.length, 5);
  await page
    .getByRole("combobox", { name: "Certification period" })
    .selectOption("Test P01");
  await profile("Control Owner", "Demo Account");
  assert.equal(
    await page
      .getByRole("button", {
        name: /Review of Completed Questionnaires in Enablon/,
      })
      .count(),
    0,
  );
  await page
    .getByRole("combobox", { name: "Certification period" })
    .selectOption("Test P03");
  assert.ok(
    await page
      .getByRole("button", {
        name: /Review of Completed Questionnaires in Enablon/,
      })
      .count(),
  );
  console.log(
    "PASS calendar workbook import and period-based owner visibility",
  );
  await profile("Controller Admin");
  await nav("Admin setup");
  await page.getByRole("button", { name: "Ownership", exact: true }).click();
  await page.getByLabel("Find controls", { exact: true }).fill("SUS.PK.02");
  await page.getByRole("button", { name: "Select 2 matching" }).click();
  await page
    .getByRole("combobox", { name: "Control Owner", exact: true })
    .selectOption("Demo Owner Two");
  await page
    .getByRole("button", { name: "Apply assignment to selected" })
    .click();
  assert.ok(
    (await store("icebreaker-control-definitions"))
      .filter((c) => c.controlNumber === "SUS.PK.02")
      .every((c) => c.owner === "Demo Owner Two"),
  );
  await page.getByRole("combobox", { name: /Reuse DTP from/ }).selectOption(id);
  await page
    .getByRole("button", { name: "Reuse guidance for selected" })
    .click();
  assert.ok(
    (await store("icebreaker-control-definitions"))
      .filter((c) => c.controlNumber === "SUS.PK.02")
      .every(
        (c) =>
          c.dtpDocument.includes("test-procedure-v2") &&
          c.dtpStatus === "Needs review",
      ),
  );
  console.log(
    "PASS bulk assignment and shared DTP reference without shared certification",
  );
  await page
    .getByRole("button", { name: "Scope & structure", exact: true })
    .click();
  const importHeaders = [
    "Control Pillar",
    "Region",
    "Country",
    "Unit",
    "Control #",
    "Control Name",
    "Business Process",
    "Sub-Process",
    "Control Frequency",
    "Attestation Frequency",
    "Control Owner",
    "Evidence Needed (Y/N)",
  ];
  const importValues = [
    "ICE Controls",
    "EU",
    "Netherlands",
    "OBL",
    "TEST.IMPORT.01",
    "Synthetic import control",
    "Inventory",
    "Testing",
    "Periodic",
    "Quarterly",
    "Demo Account",
    "Y",
  ];
  const buildImport = (values) =>
    writeXlsxFile(
      [importHeaders, values].map((row) => row.map((value) => ({ value }))),
      { buffer: true },
    );
  const upload = async (values) =>
    page
      .locator('.upload-zone input[type="file"]')
      .setInputFiles({
        name: "controls.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: await buildImport(values),
      });
  await upload([...importValues.slice(0, -1), "M"]);
  assert.equal(
    await page
      .getByRole("button", { name: "Apply validated changes", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  await upload(importValues);
  await page
    .getByRole("button", { name: "Apply validated changes", exact: true })
    .click();
  assert.equal((await store("icebreaker-control-definitions")).length, 133);
  assert.equal((await store("icebreaker-executions"))[key].status, "Certified");
  console.log(
    "PASS guarded control import, invalid flag rejection and history preservation",
  );
  await page.getByRole("button", { name: "Test data", exact: true }).click();
  await page
    .getByRole("button", { name: "Add 120 search-test accounts" })
    .click();
  assert.equal((await store("icebreaker-phase1")).people.length, 123);
  await page.getByRole("button", { name: "Ownership", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search Control Owner", exact: true })
    .fill("test120@example.test");
  assert.ok(
    await page
      .getByRole("combobox", { name: "Control Owner", exact: true })
      .getByRole("option", { name: /Demo Test 120/ })
      .count(),
  );
  assert.deepEqual(errors, []);
  console.log("PASS searchable 100+ owner directory");
  await nav("Gap remediation");
  const gapForm = page.locator('.gap-create');
  await gapForm.getByRole('textbox', {name:'Gap title', exact:true}).fill('Synthetic gap validation');
  await gapForm.getByLabel('Target date', {exact:true}).fill('2027-04-01');
  await gapForm.getByRole('textbox', {name:'Remediation action',exact:true}).fill('Review and correct the synthetic source data.');
  await gapForm.getByRole('button', {name:'Create remediation'}).click();
  const gapCard = page.locator('.gap-list article').first();
  const gapId = (await store('icebreaker-gaps'))[0].id;
  await gapCard.getByRole('textbox', {name:/ServiceNow reference/}).fill('SNOW-TEST-001');
  await gapCard.getByRole('combobox', {name:/^Status/}).selectOption('Closed');
  assert.equal((await store('icebreaker-gaps'))[0].status,'Open');
  await gapCard.getByRole('textbox', {name:'Closure evidence reference',exact:true}).fill('https://example.test/closure');
  await gapCard.getByRole('checkbox', {name:'Controller closure approval'}).check();
  await gapCard.getByRole('combobox', {name:/^Status/}).selectOption('Closed');
  assert.equal((await store('icebreaker-gaps'))[0].status,'Closed');
  assert.equal((await store('icebreaker-gaps'))[0].id,gapId);
  assert.equal((await store('icebreaker-gaps'))[0].serviceNowReference,'SNOW-TEST-001');
  console.log('PASS gap lifecycle, closure safeguards and independent ServiceNow reference');
  await page.goto(`${base}/ICEbreaker-Phase-1-Review.html`);
  await page.screenshot({path:'work/qa/review-guide.png',fullPage:true});
  assert.ok(await page.getByRole('heading',{name:'Before you begin'}).isVisible());
  assert.deepEqual(errors,[]);
} catch (error) {
  await page.screenshot({ path: "work/qa/failure.png", fullPage: true });
  console.error(await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
}
