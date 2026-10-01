import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { inventoryControls } from "../app/inventory-controls.ts";
import {
  reminderCandidates,
  DEFAULT_REMINDER_POLICIES,
} from "../app/phase1-domain.ts";
import {
  validateWorkspace,
  WORKSPACE_VERSION,
} from "../app/workspace-validation.ts";
const results = [];
for (const count of [132, 1000, 5000]) {
  const controls = Array.from({ length: count }, (_, i) => ({
    ...inventoryControls[i % inventoryControls.length],
    id: `synthetic-${i}`,
    owner: `Test Owner ${i % 100}`,
    attestationFrequency: "Periodic",
    due: "2026-10-01",
    status: "Not started",
  }));
  const metadata = {
    "icebreaker-data-version": WORKSPACE_VERSION,
    "icebreaker-control-definitions": JSON.stringify(controls),
  };
  for (const [operation, run] of [
    ["validate imported workspace", () => validateWorkspace(metadata)],
    [
      "filter dashboard records",
      () =>
        controls.filter(
          (c) =>
            c.region === "EU" &&
            c.lifecycle === "Active" &&
            c.owner.includes("1"),
        ),
    ],
    [
      "generate recipient digests",
      () =>
        reminderCandidates(
          controls,
          "Synthetic P",
          "2026-09-24",
          DEFAULT_REMINDER_POLICIES,
          "Controller",
        ),
    ],
  ]) {
    run();
    run();
    const samples = [];
    for (let i = 0; i < 7; i++) {
      const start = performance.now();
      run();
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    results.push({
      count,
      operation,
      medianMs: +samples[3].toFixed(2),
      maxMs: +samples[6].toFixed(2),
    });
  }
}
const report = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  scope:
    "Single-process synthetic domain operations; not browser rendering, concurrent users, API, SQL, file scanning or email performance.",
  results,
};
await mkdir("work/qa", { recursive: true });
await writeFile(
  "work/qa/performance-baseline.json",
  JSON.stringify(report, null, 2),
);
console.table(results);
