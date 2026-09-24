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
  DEFAULT_REMINDER_POLICIES,
  mergeReminderMessages,
  guidanceReminders,
  matchingPeople,
  frequencyAt,
  needsGuidanceResponse,
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
  attestationFrequency: "Quarterly",
};
test("frequency policy uses calendar days, weekly overdue and Controller escalation", () => {
  for (const [date, rule] of [
    ["2026-09-16", "14 days before"],
    ["2026-09-23", "7 days before"],
    ["2026-09-28", "2 days before"],
    ["2026-09-30", "On deadline"],
    ["2026-10-01", "Overdue follow-up"],
    ["2026-10-07", "Controller escalation"],
    ["2026-10-08", "Overdue follow-up"],
  ]) {
    const rows = reminderCandidates(
      [control],
      "Q3 2026",
      date,
      DEFAULT_REMINDER_POLICIES,
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
        DEFAULT_REMINDER_POLICIES,
        "Demo Account",
      )[0].key,
    );
  }
  assert.equal(
    reminderCandidates([control], "Q3", "2026-09-17", DEFAULT_REMINDER_POLICIES, "Demo")
      .length,
    0,
  );
  assert.equal(
    reminderCandidates([control], "Q3", "2026-09-16", {}, "Demo").length,
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
        DEFAULT_REMINDER_POLICIES,
        "Demo",
      ).length,
      0,
    );
});
test("reminder digests aggregate controls and periods without duplicates", () => {
  const run = (frequency, date, extra = {}) => reminderCandidates([{...control, attestationFrequency: frequency, ...extra}], 'P13', date, DEFAULT_REMINDER_POLICIES, 'Controller');
  assert.equal(run('Periodic', '2026-09-16').length, 0);
  assert.equal(run('Periodic', '2026-09-23').length, 1);
  assert.equal(run('Annual', '2026-09-02').length, 1);
  assert.equal(run('Annually', '2026-09-02').length, 1);
  assert.equal(run('Semi-annual', '2026-09-23').length, 0);
  assert.equal(run('Quarterly', '2026-10-02').length, 0);
  assert.equal(run('Quarterly', '2026-10-07')[0].audience, 'Controller');
  assert.equal(run('Periodic', '2026-09-28', {accepted: true, understood: true, status: 'Acknowledged'}).length, 1);
  const one = run('Periodic', '2026-09-23');
  const two = run('Periodic', '2026-09-23', {id: 'test-2'});
  const merged = mergeReminderMessages(one, [...one, ...two]);
  assert.equal(merged.length, 1); assert.equal(merged[0].items.length, 2);
  const anotherPeriod = reminderCandidates([control], 'Q4', '2026-09-23', DEFAULT_REMINDER_POLICIES, 'Controller');
  assert.equal(mergeReminderMessages(merged, anotherPeriod)[0].items.length, 3);
});
test("five-week Mars periods and effective frequency preserve earlier schedules", () => {
  const p13 = {id:'Test P13', start:'2026-11-30', end:'2027-01-03', quarterEnd:true, halfEnd:true, yearEnd:true};
  assert.deepEqual(validateCalendar([p13]), []);
  assert.equal(scheduledDue({...control, dueWeek:5, dueDay:7}, p13), p13.end);
  const versioned = {...control, attestationFrequency:'Periodic', attestationChanges:[{period:'Test P13', start:p13.start, frequency:'Annual'}]};
  assert.equal(frequencyAt(versioned, {start:'2026-11-02'}), 'Periodic');
  assert.equal(frequencyAt(versioned, p13), 'Annual');
});
test("owner search handles whitespace, case and multiple words", () => {
  const people = [{name:'Demo Owner Two', email:'owner.two@example.test', unit:'OBL'}, {name:'Demo Account',email:'demo@example.test',unit:'All units'}];
  assert.equal(matchingPeople(people, '  OWNER   TWO ').length, 1);
  assert.equal(matchingPeople(people, 'demo@example.test')[0].name, 'Demo Account');
  assert.equal(matchingPeople(people, 'missing').length, 0);
});
test("guidance notifications and attention badges are separate from certification", () => {
  const request = {id:'r1',controlId:'test-1',period:'P13',owner:'Demo Account',question:'Test?',createdAt:'2026-09-01T12:00:00Z',status:'Open',messages:[]};
  assert.equal(guidanceReminders([request], '2026-09-01', 'Demo').length, 1);
  assert.equal(guidanceReminders([request], '2026-09-08', 'Demo').length, 1);
  assert.equal(guidanceReminders([request], '2026-09-09', 'Demo').length, 0);
  const notices = guidanceReminders([request], '2026-09-08', 'Demo');
  const repeated = mergeReminderMessages(notices, notices);
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].items, undefined);
  assert.equal(guidanceReminders([{...request,status:'Answered'}], '2026-09-08', 'Demo').length, 0);
  assert.equal(needsGuidanceResponse(request,'Controller Admin','Demo'), true);
  assert.equal(needsGuidanceResponse({...request,status:'Answered'},'Control Owner','Demo Account'), true);
  assert.equal(needsGuidanceResponse({...request,status:'Answered'},'Control Owner','Other'), false);
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
