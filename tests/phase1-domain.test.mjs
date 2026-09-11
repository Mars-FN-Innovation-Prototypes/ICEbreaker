import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../app/phase1-domain.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const domain = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const {
  dueInPeriod,
  scheduledDue,
  validateCalendar,
  INITIAL_CALENDAR,
  reminderCandidates,
  REMINDER_RULES,
  assignmentReset,
  isDate,
  csvCell,
  fileLabel,
} = domain;
test("calendar periods validate dates, duplicate names and closing flags", () => {
  assert.deepEqual(validateCalendar(INITIAL_CALENDAR), []);
  assert.equal(isDate("2026-02-30"), false);
  assert.equal(isDate("2028-02-29"), true);
  assert.ok(
    validateCalendar([INITIAL_CALENDAR[0], INITIAL_CALENDAR[0]]).length,
  );
  assert.ok(
    validateCalendar([{ ...INITIAL_CALENDAR[0], yearEnd: true }]).length,
  );
  assert.ok(validateCalendar([]).length);
});
test("attestation frequency selects appropriate periods without inventing calendar dates", () => {
  assert.equal(
    dueInPeriod({ attestationFrequency: "Quarterly" }, INITIAL_CALENDAR[0]),
    false,
  );
  assert.equal(
    dueInPeriod({ attestationFrequency: "Quarterly" }, INITIAL_CALENDAR[1]),
    true,
  );
  assert.equal(
    dueInPeriod({ attestationFrequency: "Annual" }, INITIAL_CALENDAR[1]),
    false,
  );
  assert.equal(
    dueInPeriod({ attestationFrequency: "Annual" }, INITIAL_CALENDAR[2]),
    true,
  );
  assert.equal(
    dueInPeriod({ attestationFrequency: "Semi-annual" }, INITIAL_CALENDAR[2]),
    true,
  );
  assert.equal(
    dueInPeriod({ attestationFrequency: "Periodic" }, INITIAL_CALENDAR[0]),
    true,
  );
  assert.equal(
    dueInPeriod({ attestationFrequency: "Event based" }, INITIAL_CALENDAR[0]),
    false,
  );
  assert.equal(
    scheduledDue({ dueWeek: 2, dueDay: 5 }, INITIAL_CALENDAR[0]),
    "2026-07-12",
  );
  assert.equal(scheduledDue({}, INITIAL_CALENDAR[1]), "2026-09-30");
});
const control = {
  id: "test-1",
  controlNumber: "TEST.01",
  name: "Test control",
  unit: "Test site",
  lifecycle: "Active",
  status: "Acknowledgement pending",
  owner: "Demo Account",
  due: "2026-09-30",
  evidenceRequired: true,
};
test("reminder cadence includes 14/7/due/daily overdue and skips certified, unassigned, inactive", () => {
  for (const [date, rule] of [
    ["2026-09-16", "14 days before"],
    ["2026-09-23", "7 days before"],
    ["2026-09-30", "On deadline"],
    ["2026-10-01", "Daily overdue"],
    ["2026-10-02", "Daily overdue"],
  ]) {
    const rows = reminderCandidates(
      [control],
      "Q3 2026",
      date,
      REMINDER_RULES,
      "Demo Account",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rule, rule);
    assert.equal(
      rows[0].key,
      reminderCandidates(
        [control],
        "Q3 2026",
        date,
        REMINDER_RULES,
        "Demo Account",
      )[0].key,
    );
  }
  assert.equal(
    reminderCandidates([control], "Q3", "2026-09-17", REMINDER_RULES, "Demo")
      .length,
    0,
  );
  assert.equal(
    reminderCandidates([control], "Q3", "2026-09-16", [], "Demo").length,
    0,
  );
  for (const change of [
    { status: "Certified" },
    { owner: "Unassigned" },
    { lifecycle: "Archived" },
    { due: "Not scheduled" },
  ])
    assert.equal(
      reminderCandidates(
        [{ ...control, ...change }],
        "Q3",
        "2026-10-01",
        REMINDER_RULES,
        "Demo",
      ).length,
      0,
    );
});
test("reassignment resets acknowledgement but does not overwrite execution/evidence", () => {
  const reset = assignmentReset(control, "Demo Owner Two");
  assert.equal(reset.owner, "Demo Owner Two");
  assert.equal(reset.accepted, false);
  assert.equal(reset.acknowledgedAt, undefined);
  assert.equal("performed" in reset, false);
  assert.throws(() =>
    assignmentReset({ ...control, status: "Certified" }, "Next"),
  );
});
test("filenames are readable and CSV exports guard formula injection", () => {
  assert.equal(fileLabel("ice-file:id:my%20file.pdf"), "my file.pdf");
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
