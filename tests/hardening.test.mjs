import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import {
  safeExternalUrl,
  validateDocument,
  checkZip,
  validateOfficeArchive,
} from "../app/input-safety.ts";
import {
  validateWorkspace,
  safeJson,
  WORKSPACE_VERSION,
} from "../app/workspace-validation.ts";
import { inventoryControls } from "../app/inventory-controls.ts";
import { INITIAL_PHASE1 } from "../app/phase1-domain.ts";
import { assertPrototypeBuild, basePath } from "../scripts/build-policy.mjs";

test("external document links allow HTTPS without credentials or control characters", () => {
  assert.equal(
    safeExternalUrl("https://example.test/evidence?q=1"),
    "https://example.test/evidence?q=1",
  );
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "http://example.test",
    "https://me:secret@example.test/x",
    "https://example.test/\nfile",
    "//example.test",
    "https://example.test\\@evil.test",
  ])
    assert.equal(safeExternalUrl(bad), null);
});
test("saved workspace schema accepts current seed records without mutation", () => {
  const metadata = {
    "icebreaker-data-version": WORKSPACE_VERSION,
    "icebreaker-control-definitions": JSON.stringify(inventoryControls),
    "icebreaker-phase1": JSON.stringify(INITIAL_PHASE1),
  };
  const original = JSON.stringify(metadata);
  validateWorkspace(metadata);
  assert.equal(JSON.stringify(metadata), original);
});
test("malformed JSON, bad types, unknown versions and incomplete backups are rejected", () => {
  assert.throws(() => safeJson('{"__proto__":{"polluted":true}}'));
  assert.throws(() => safeJson(JSON.stringify({ constructor: {} })));
  assert.throws(() => safeJson("[".repeat(26) + "0" + "]".repeat(26)));
  assert.throws(() =>
    validateWorkspace({
      "icebreaker-data-version": "future",
      "icebreaker-executions": "{}",
    }),
  );
  assert.throws(() =>
    validateWorkspace({
      "icebreaker-data-version": WORKSPACE_VERSION,
      "icebreaker-executions": "[]",
    }),
  );
  assert.throws(() =>
    validateWorkspace({
      "icebreaker-data-version": WORKSPACE_VERSION,
      "icebreaker-phase1": JSON.stringify({
        ...INITIAL_PHASE1,
        people: [{ name: 4 }],
      }),
    }),
  );
  assert.throws(() =>
    validateWorkspace({ "icebreaker-data-version": WORKSPACE_VERSION }, true),
  );
});
test("duplicate controls and mismatched execution keys cannot be restored", () => {
  const c = inventoryControls[0];
  assert.throws(() =>
    validateWorkspace({
      "icebreaker-data-version": WORKSPACE_VERSION,
      "icebreaker-control-definitions": JSON.stringify([c, c]),
    }),
  );
  assert.throws(() =>
    validateWorkspace({
      "icebreaker-data-version": WORKSPACE_VERSION,
      "icebreaker-executions": JSON.stringify({
        wrong: { ...c, controlId: c.id, period: "P1" },
      }),
    }),
  );
});
test("document validation rejects fake signatures, active types, names and large files", async () => {
  assert.equal(
    await validateDocument(new File(["Synthetic evidence"], "evidence.txt")),
    "text/plain",
  );
  await assert.rejects(validateDocument(new File(["not pdf"], "evidence.pdf")));
  await assert.rejects(
    validateDocument(new File(["<script/>"], "evidence.html")),
  );
  await assert.rejects(validateDocument(new File(["test"], "../evidence.txt")));
  await assert.rejects(
    validateDocument(
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], "evidence.txt"),
    ),
  );
});
test("Office import preflight rejects corrupt, macro-enabled and oversized archives", async () => {
  const normal = zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "xl/workbook.xml": strToU8("<workbook/>"),
  });
  assert.ok(checkZip(normal).has("xl/workbook.xml"));
  assert.ok((await validateOfficeArchive(normal)).has("xl/workbook.xml"));
  assert.throws(() => checkZip(new Uint8Array(32)));
  assert.throws(() =>
    checkZip(
      zipSync({
        "[Content_Types].xml": strToU8("x"),
        "xl/vbaProject.bin": strToU8("x"),
      }),
    ),
  );
  assert.throws(() => checkZip(normal, 1));
  // A forged central-directory size must not evade the actual expansion budget.
  const bomb = zipSync({ "[Content_Types].xml": new Uint8Array(100000) });
  const view = new DataView(bomb.buffer);
  for (let i = 0; i < bomb.length - 46; i++)
    if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 1, true);
  await assert.rejects(validateOfficeArchive(bomb, 5000));
});
test("production configuration fails closed and deployment paths cannot inject markup", () => {
  assertPrototypeBuild({});
  assert.equal(basePath("/ICEbreaker"), "/ICEbreaker/");
  assert.throws(() =>
    assertPrototypeBuild({ ICEBREAKER_DEPLOYMENT_TIER: "production" }),
  );
  assert.throws(() =>
    assertPrototypeBuild({ ICEBREAKER_APP_MODE: "enterprise" }),
  );
  assert.throws(() => assertPrototypeBuild({ VITE_CLIENT_SECRET: "not-real" }));
  for (const path of ["//evil.test", "/a/../b", "/<script>", "/a?b"])
    assert.throws(() => basePath(path));
});
