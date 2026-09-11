import type { InventoryControl } from "./inventory-controls";

export type TestPerson = { name: string; email: string; unit: string };
export type CalendarPeriod = {
  id: string;
  start: string;
  end: string;
  quarterEnd: boolean;
  halfEnd: boolean;
  yearEnd: boolean;
};
export type GuidanceRequest = {
  id: string;
  controlId: string;
  period: string;
  owner: string;
  topic: string;
  urgency: string;
  question: string;
  createdAt: string;
  status: "Open" | "Answered" | "Resolved";
  messages: { author: string; role: string; text: string; at: string }[];
};
export type ReminderRule =
  | "14 days before"
  | "7 days before"
  | "On deadline"
  | "Daily overdue";
export type ReminderMessage = {
  id: string;
  key: string;
  controlId: string;
  period: string;
  recipient: string;
  sender: string;
  date: string;
  rule: string;
  subject: string;
  body: string;
};
export type Phase1State = {
  people: TestPerson[];
  calendar: CalendarPeriod[];
  guidance: GuidanceRequest[];
  rules: ReminderRule[];
  messages: ReminderMessage[];
};
export const REMINDER_RULES: ReminderRule[] = [
  "14 days before",
  "7 days before",
  "On deadline",
  "Daily overdue",
];
export const TEST_PEOPLE: TestPerson[] = [
  { name: "Demo Account", email: "demo@example.test", unit: "All units" },
  { name: "Demo Owner Two", email: "owner.two@example.test", unit: "OBL" },
  { name: "Demo Owner Three", email: "owner.three@example.test", unit: "KLN" },
];
// Compatibility periods retain existing execution keys. No invented Mars dates.
export const INITIAL_CALENDAR: CalendarPeriod[] = [
  {
    id: "July 2026",
    start: "2026-07-01",
    end: "2026-07-31",
    quarterEnd: false,
    halfEnd: false,
    yearEnd: false,
  },
  {
    id: "Q3 2026",
    start: "2026-07-01",
    end: "2026-09-30",
    quarterEnd: true,
    halfEnd: false,
    yearEnd: false,
  },
  {
    id: "FY 2026",
    start: "2026-01-01",
    end: "2026-12-31",
    quarterEnd: true,
    halfEnd: true,
    yearEnd: true,
  },
];
export const INITIAL_PHASE1: Phase1State = {
  people: TEST_PEOPLE,
  calendar: INITIAL_CALENDAR,
  guidance: [],
  rules: REMINDER_RULES,
  messages: [],
};
export function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
export function validateCalendar(rows: CalendarPeriod[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (!rows.length) errors.push("Add at least one calendar period.");
  rows.forEach((row, index) => {
    const label = `Row ${index + 2}`;
    if (!row.id.trim() || row.id.includes("::"))
      errors.push(`${label}: period name is required and cannot contain ::.`);
    if (ids.has(row.id.toLowerCase()))
      errors.push(`${label}: duplicate period ${row.id}.`);
    ids.add(row.id.toLowerCase());
    if (!isDate(row.start) || !isDate(row.end) || row.end < row.start)
      errors.push(`${label}: use valid start/end dates in YYYY-MM-DD order.`);
    if (row.yearEnd && (!row.halfEnd || !row.quarterEnd))
      errors.push(`${label}: year-end must also be half-year and quarter-end.`);
    if (row.halfEnd && !row.quarterEnd)
      errors.push(`${label}: half-year end must also be quarter-end.`);
  });
  return errors;
}
export function dueInPeriod(
  control: Pick<InventoryControl, "attestationFrequency">,
  period?: CalendarPeriod,
): boolean {
  if (!period) return true;
  const frequency = control.attestationFrequency.toLowerCase();
  if (frequency.includes("semi") || frequency.includes("half"))
    return period.halfEnd;
  if (frequency.includes("quarter")) return period.quarterEnd;
  if (frequency.includes("annual") || frequency.includes("year"))
    return period.yearEnd;
  if (frequency.includes("event")) return false; // Explicit activation required for event-driven work.
  return true;
}
export function scheduledDue(
  control: InventoryControl,
  period?: CalendarPeriod,
): string {
  if (!period) return control.due;
  if (control.dueWeek && control.dueWeek >= 1)
    return addDays(
      period.start,
      (control.dueWeek - 1) * 7 + (control.dueDay || 5) - 1,
    );
  return period.end;
}
export function reminderCandidates(
  controls: InventoryControl[],
  period: string,
  date: string,
  rules: ReminderRule[],
  sender: string,
): ReminderMessage[] {
  if (!isDate(date)) return [];
  return controls.flatMap((control) => {
    if (
      control.lifecycle !== "Active" ||
      control.status === "Certified" ||
      control.owner === "Unassigned" ||
      !isDate(control.due)
    )
      return [];
    const days = Math.round(
      (Date.parse(control.due) - Date.parse(date)) / 86400000,
    );
    const rule: ReminderRule | undefined =
      days === 14
        ? "14 days before"
        : days === 7
          ? "7 days before"
          : days === 0
            ? "On deadline"
            : days < 0
              ? "Daily overdue"
              : undefined;
    if (!rule || !rules.includes(rule)) return [];
    const key = `${period}::${control.id}::${date}::${rule}`;
    return [
      {
        id: key,
        key,
        controlId: control.id,
        period,
        recipient: control.owner,
        sender,
        date,
        rule,
        subject: `ICEbreaker · ${control.controlNumber} · ${rule}`,
        body: `${control.name} (${control.unit}) is due ${control.due}. Current status: ${control.status}. ${control.evidenceRequired ? "Evidence is required. " : ""}Please review ownership, the desktop procedure and your execution before certifying.`,
      },
    ];
  });
}
export function assignmentReset(
  control: InventoryControl,
  owner: string,
): Partial<InventoryControl> {
  if (control.status === "Certified")
    throw new Error(
      "Certified executions retain their owner. Choose a new period for reassignment.",
    );
  return {
    owner,
    accepted: false,
    understood: false,
    acknowledgedAt: undefined,
    documentationReviewed: false,
    documentationReviewedAt: undefined,
    reassignmentRequested: false,
  };
}
export const fileLabel = (ref: string) => {
  if (!ref.startsWith("ice-file:")) return ref;
  try {
    return decodeURIComponent(ref.split(":").slice(2).join(":"));
  } catch {
    return "Local attachment";
  }
};
export const fileId = (ref: string) =>
  ref.startsWith("ice-file:") ? ref.split(":")[1] : "";
export const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
};
