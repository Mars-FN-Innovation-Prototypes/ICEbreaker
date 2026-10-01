import { z } from "zod";
import { validateCalendar } from "./phase1-domain";
export const WORKSPACE_VERSION = "stakeholder-feedback-v2";
export const WORKSPACE_KEYS = [
  "icebreaker-data-version",
  "icebreaker-controls",
  "icebreaker-control-definitions",
  "icebreaker-executions",
  "icebreaker-ownership-changes",
  "icebreaker-gaps",
  "icebreaker-audit-events",
  "icebreaker-saved-views",
  "icebreaker-attachments",
  "icebreaker-scope",
  "icebreaker-phase1",
] as const;
const text = z.string().max(50000);
const short = z.string().max(500);
const id = short.min(1);
const date = z.string().max(64);
const strings = z.array(text).max(5000);
const status = z.enum([
  "Not due this period",
  "Certified",
  "Ready to certify",
  "Performed with deviations",
  "Due soon",
  "Evidence needed",
  "In progress",
  "Acknowledged",
  "Acknowledgement pending",
  "Overdue",
  "Unassigned",
  "Not started",
]);
const outcome = z.enum([
  "Not recorded",
  "Performed as documented",
  "Performed with deviations",
  "Not performed",
]);
const executionFields = {
  owner: short,
  status,
  due: date,
  region: short,
  country: short.optional(),
  site: short,
  accepted: z.boolean().optional(),
  understood: z.boolean().optional(),
  performed: z.boolean().optional(),
  documentationReviewed: z.boolean().optional(),
  reassignmentRequested: z.boolean().optional(),
  acknowledgedAt: date.optional(),
  certifiedAt: date.optional(),
  draftSavedAt: date.optional(),
  documentationReviewedAt: date.optional(),
  executionOutcome: outcome.optional(),
  deviationNotes: text.optional(),
};
const control = z.looseObject({
  id,
  name: id,
  controlNumber: short.optional(),
  frequency: short,
  attestationFrequency: short.optional(),
  ...executionFields,
  process: short,
  businessProcess: short.optional(),
  unit: short,
  pillar: short.optional(),
  objective: text.optional(),
  riskDescription: text.optional(),
  description: text.optional(),
  instructions: text.optional(),
  regionalInstructions: text.optional(),
  type: short,
  evidenceRequirement: z
    .enum(["Required", "Not required", "Not scoped"])
    .optional(),
  evidenceRequired: z.boolean(),
  keyControl: z.boolean(),
  fraudControl: z.boolean().optional(),
  applicable: z.boolean().optional(),
  lifecycle: z.enum(["Active", "Not applicable", "Archived"]).optional(),
  dtpStatus: z.enum(["Current", "Needs review", "Not added"]),
  dtpSummary: text.optional(),
  dtpOwner: short.optional(),
  dtpVersion: short.optional(),
  dtpDocument: text.optional(),
  dtpLastReviewed: date.optional(),
  dtpNextReview: date.optional(),
  dtpHistory: z
    .array(
      z.looseObject({
        document: text,
        version: short,
        owner: short,
        reviewedAt: date,
        summary: text.optional(),
      }),
    )
    .max(1000)
    .optional(),
  attestationChanges: z
    .array(z.object({ period: id, start: date, frequency: short }))
    .max(1000)
    .optional(),
  activatedPeriods: strings.optional(),
  dueWeek: z.number().int().min(1).max(53).optional(),
  dueDay: z.number().int().min(1).max(7).optional(),
});
const array = <T extends z.ZodType>(schema: T) => z.array(schema).max(50000);
const period = z.object({
  id,
  start: date,
  end: date,
  quarterEnd: z.boolean(),
  halfEnd: z.boolean(),
  yearEnd: z.boolean(),
});
const messageItem = z.object({
  controlId: id,
  period: id,
  rule: short,
  body: text,
});
export const phaseSchema = z.looseObject({
  people: z.array(z.object({ name: id, email: short, unit: short })).max(5000),
  calendar: z
    .array(period)
    .min(1)
    .max(1000)
    .refine((rows) => !validateCalendar(rows).length),
  guidance: array(
    z.looseObject({
      id,
      controlId: id,
      period: id,
      owner: short,
      topic: short,
      urgency: short,
      question: text,
      createdAt: date,
      status: z.enum(["Open", "Answered", "Resolved"]),
      messages: array(z.object({ author: short, role: short, text, at: date })),
    }),
  ),
  rules: z.array(short).max(100),
  messages: array(
    z.looseObject({
      id,
      key: id,
      controlId: id,
      period: id,
      recipient: short,
      sender: short,
      date,
      rule: short,
      subject: text,
      body: text,
      audience: z.enum(["Owner", "Controller"]).optional(),
      items: array(messageItem).optional(),
    }),
  ),
  reminderPolicies: z
    .record(short, z.array(z.number().int().min(0).max(365)).max(366))
    .optional(),
});
const schemas: Record<string, z.ZodType> = {
  "icebreaker-controls": z.array(control).max(5000),
  "icebreaker-control-definitions": z.array(control).max(5000),
  "icebreaker-executions": z.record(
    id,
    z.looseObject({
      controlId: id,
      period: id,
      ...executionFields,
      attestationFrequency: short.optional(),
    }),
  ),
  "icebreaker-ownership-changes": array(
    z.looseObject({
      id,
      controlId: id,
      period: id,
      fromOwner: short,
      toOwner: short,
      requestedBy: short,
      changedAt: date,
      handoverConfirmed: z.boolean(),
      trainingConfirmed: z.boolean(),
      status: z.enum(["Requested", "Completed", "Resolved"]).optional(),
    }),
  ),
  "icebreaker-gaps": array(
    z.looseObject({
      id,
      controlId: id,
      period: id,
      title: text,
      description: text,
      severity: z.enum(["Low", "Medium", "High", "Critical"]),
      owner: short,
      due: date,
      status: z.enum(["Open", "In progress", "Ready for closure", "Closed"]),
      closureEvidence: text,
      controllerApproved: z.boolean(),
      createdAt: date,
      serviceNowReference: short.optional(),
    }),
  ),
  "icebreaker-audit-events": array(
    z.object({
      id,
      controlId: id,
      period: id,
      action: text,
      actor: short,
      timestamp: date,
      detail: text,
    }),
  ),
  "icebreaker-saved-views": z
    .array(
      z.looseObject({
        name: id,
        process: short,
        status: short,
        evidence: short,
        audience: z.enum(["Leadership", "Site owners", "Controllers"]),
      }),
    )
    .max(1000),
  "icebreaker-attachments": z.record(id, strings),
  "icebreaker-scope": z.object({
    regions: strings,
    countries: strings.optional(),
    sites: strings,
  }),
  "icebreaker-phase1": phaseSchema,
};
export function safeJson(raw: string): unknown {
  if (raw.length > 20 * 1024 * 1024)
    throw new Error("Workspace metadata is too large.");
  const value: unknown = JSON.parse(raw);
  let nodes = 0;
  const check = (v: unknown, depth: number) => {
    if (++nodes > 1000000 || depth > 24)
      throw new Error("Workspace structure exceeds safe limits.");
    if (v && typeof v === "object")
      for (const [key, child] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new Error("Unsafe metadata field.");
        check(child, depth + 1);
      }
  };
  check(value, 0);
  return value;
}
export function validateWorkspace(
  metadata: Record<string, string>,
  requireComplete = false,
) {
  const hasData = WORKSPACE_KEYS.some(
    (key) => key !== "icebreaker-data-version" && metadata[key],
  );
  if (hasData && metadata["icebreaker-data-version"] !== WORKSPACE_VERSION)
    throw new Error(
      "This workspace needs a supported migration. Your saved data has not been replaced.",
    );
  if (
    requireComplete &&
    WORKSPACE_KEYS.filter((k) => k !== "icebreaker-controls").some(
      (k) => !(k in metadata),
    )
  )
    throw new Error(
      "Backup is incomplete. Export a complete backup before restoring.",
    );
  const parsed: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(metadata)) {
    if (
      !(WORKSPACE_KEYS as readonly string[]).includes(key) ||
      typeof raw !== "string"
    )
      throw new Error("Unsupported workspace metadata.");
    if (key === "icebreaker-data-version") continue;
    const value = safeJson(raw);
    if (!schemas[key]?.safeParse(value).success)
      throw new Error(
        `Invalid saved data in ${key}. Export recovery data before continuing.`,
      );
    parsed[key] = value;
  }
  const controls = (parsed["icebreaker-control-definitions"] ||
    parsed["icebreaker-controls"]) as { id: string }[] | undefined;
  if (controls && new Set(controls.map((c) => c.id)).size !== controls.length)
    throw new Error("Duplicate control identifiers in workspace.");
  for (const [key, execution] of Object.entries(
    (parsed["icebreaker-executions"] || {}) as Record<
      string,
      { controlId: string; period: string }
    >,
  )) {
    if (
      key !== `${execution.period}::${execution.controlId}` ||
      (controls && !controls.some((c) => c.id === execution.controlId))
    )
      throw new Error(
        "Execution references do not match the control registry.",
      );
  }
  return parsed;
}
