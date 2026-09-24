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
  audience?: "Owner" | "Controller";
  items?: { controlId: string; period: string; rule: string; body: string }[];
};
export const ATTESTATION_FREQUENCIES = ["Periodic", "Quarterly", "Semi-annual", "Annual", "Event based"];
export const CONTROL_FREQUENCIES = ["Daily", "Weekly", "Periodic", "Quarterly", "Semi-annual", "Annual", "Event based"];
export function canonicalAttestation(value: string): string {
  const key = value.trim().toLowerCase().replace(/[\s_-]/g, "");
  return ({periodic:"Periodic", quarterly:"Quarterly", annual:"Annual", annually:"Annual", yearly:"Annual", semiannual:"Semi-annual", semiannually:"Semi-annual", halfyearly:"Semi-annual", eventbased:"Event based"} as Record<string, string>)[key] || value.trim();
}
export type ReminderPolicies = Record<string, number[]>;
export const DEFAULT_REMINDER_POLICIES: ReminderPolicies = {
  Periodic: [7, 2, 0], Quarterly: [14, 7, 2, 0], Annual: [28, 14, 7, 2, 0],
  "Semi-annual": [], "Event based": [],
};
export function frequencyAt(control: InventoryControl, period?: CalendarPeriod): string {
  if (!period) return control.attestationFrequency;
  return [...(control.attestationChanges || [])]
    .filter((change) => change.start <= period.start)
    .sort((a, b) => b.start.localeCompare(a.start))[0]?.frequency || control.attestationFrequency;
}
export function matchingPeople(people: TestPerson[], search: string): TestPerson[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return people.filter((p) => words.every((word) => `${p.name} ${p.email} ${p.unit}`.toLowerCase().includes(word)));
}
export function needsGuidanceResponse(request: GuidanceRequest, role: string, user: string) {
  return role === "Controller Admin" ? request.status === "Open" : request.owner === user && request.status === "Answered";
}
export type Phase1State = {
  people: TestPerson[];
  calendar: CalendarPeriod[];
  guidance: GuidanceRequest[];
  rules: ReminderRule[];
  messages: ReminderMessage[];
  reminderPolicies?: ReminderPolicies;
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
  reminderPolicies: DEFAULT_REMINDER_POLICIES,
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
  policies: ReminderPolicies,
  sender: string,
): ReminderMessage[] {
  if (!isDate(date)) return [];
  const candidates: ReminderMessage[] = controls.flatMap((control) => {
    if (
      control.lifecycle !== "Active" ||
      control.status === "Certified" ||
      control.status === "Not due this period" ||
      !control.owner ||
      control.owner === "Unassigned" ||
      !isDate(control.due)
    )
      return [];
    const days = Math.round(
      (Date.parse(control.due) - Date.parse(date)) / 86400000,
    );
    const schedule = policies[canonicalAttestation(control.attestationFrequency)];
    if (!schedule?.length) return [];
    const escalation = days === -7;
    const rule = days >= 0 && schedule.includes(days)
      ? days === 0 ? "On deadline" : `${days} days before`
      : days === -1 || (days < -1 && (-days - 1) % 7 === 0)
        ? "Overdue follow-up" : escalation ? "Controller escalation" : undefined;
    if (!rule) return [];
    const audience = escalation ? "Controller" as const : "Owner" as const;
    const recipient = escalation ? "Controller team" : control.owner;
    const key = `${date}::${audience}::${recipient}`;
    const body = `${control.controlNumber} — ${control.name} (${control.unit}) is due ${control.due}. Owner: ${control.owner}. Status: ${control.status}. ${control.evidenceRequired ? "Evidence is required. " : ""}Ownership acknowledgement alone does not complete certification.`;
    return [
      {
        id: key,
        key,
        controlId: control.id,
        period,
        recipient,
        audience,
        sender,
        date,
        rule,
        subject: `ICEbreaker · ${audience} daily digest · ${date}`,
        body,
        items: [{controlId: control.id, period, rule, body}],
      },
    ];
  });
  return mergeReminderMessages([], candidates);
}
/** One simulated digest per recipient/day; repeat runs and periods merge without duplicate items. */
export function mergeReminderMessages(existing: ReminderMessage[], incoming: ReminderMessage[]) {
  const result = [...existing];
  for (const message of incoming) {
    const index = result.findIndex((old) => old.key === message.key);
    if (index < 0) { result.unshift(message); continue; }
    const old = result[index];
    // Guidance notices are individual messages, not control digests.
    if (!old.items && !message.items) continue;
    const items = [...(old.items || [])];
    for (const item of message.items || [])
      if (!items.some((i) => i.controlId === item.controlId && i.period === item.period && i.rule === item.rule)) items.push(item);
    result[index] = {...old, items};
  }
  return result;
}
export function guidanceReminders(requests: GuidanceRequest[], date: string, sender: string): ReminderMessage[] {
  if (!isDate(date)) return [];
  return requests.filter((r) => r.status === "Open").flatMap((r) => {
    const days = (Date.parse(date) - Date.parse(r.createdAt.slice(0, 10))) / 86400000;
    if (days < 0 || days % 7 !== 0) return [];
    const key = `guidance::${date}::${r.id}`;
    return [{ id: key, key, controlId: r.controlId, period: r.period,
      recipient: "Controller team", sender, date, audience: "Controller" as const,
      rule: "Guidance follow-up", subject: "ICEbreaker · guidance awaiting response",
      body: `${r.owner}: ${r.question}. Open the Controller inbox to respond. This is separate from control certification reminders.` }];
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
