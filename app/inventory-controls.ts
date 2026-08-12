import { fullControlRows } from "./full-controls-data";

export type ControlPillar =
  | "ICE Controls"
  | "Sustainability Controls"
  | "Operating Controls";

export type ControlStatus =
  | "Certified"
  | "Ready to certify"
  | "Performed with deviations"
  | "Due soon"
  | "Evidence needed"
  | "In progress"
  | "Acknowledged"
  | "Acknowledgement pending"
  | "Overdue"
  | "Unassigned"
  | "Not started";

export type DtpHistoryEntry = {
  document: string;
  version: string;
  owner: string;
  reviewedAt: string;
};

export type ExecutionOutcome =
  | "Not recorded"
  | "Performed as documented"
  | "Performed with deviations"
  | "Not performed";

export type EvidenceRequirement =
  | "Required"
  | "Not required"
  | "Not scoped";

export type ControlLifecycle = "Active" | "Not applicable" | "Archived";

export type InventoryControl = {
  /** Stable internal key for a control number in a specific organization scope. */
  id: string;
  controlNumber: string;
  pillar: ControlPillar;
  name: string;
  businessProcess: string;
  process: string;
  objective: string;
  riskDescription: string;
  description: string;
  frequency: string;
  attestationFrequency: string;
  keyControl: boolean;
  fraudControl: boolean;
  nature: "Preventive" | "Detective";
  type: string;
  evidenceRequirement: EvidenceRequirement;
  evidenceRequired: boolean;
  owner: string;
  status: ControlStatus;
  due: string;
  dtpStatus: "Current" | "Needs review" | "Not added";
  region: string;
  country: string;
  site: string;
  unit: string;
  instructions: string;
  applicable: boolean;
  lifecycle: ControlLifecycle;
  dtpSummary: string;
  dtpOwner: string;
  dtpVersion: string;
  dtpLastReviewed: string;
  dtpNextReview: string;
  dtpDocument: string;
  dtpHistory: DtpHistoryEntry[];
  accepted?: boolean;
  understood?: boolean;
  acknowledgedAt?: string;
  performed?: boolean;
  executionOutcome?: ExecutionOutcome;
  deviationNotes?: string;
  draftSavedAt?: string;
  documentationReviewed?: boolean;
  documentationReviewedAt?: string;
  reassignmentRequested?: boolean;
  certifiedAt?: string;
};

const demoAssignments = new Set([
  "OBL::SUS.EN.01",
  "OBL::SUS.PK.02",
  "OBL::INV.MF.01",
  "OBL::INV.PE.01",
  "KLN::SUS.EN.01",
  "KLN::SUS.PK.02",
  "KLN::INV.MF.01",
  "KLN::INV.PE.01",
]);

const dueForAttestation = (frequency: string) => {
  const normalized = frequency.toLowerCase();
  if (normalized.includes("annual") && !normalized.includes("semi"))
    return "2026-12-31";
  if (normalized.includes("semi")) return "2026-06-30";
  return "2026-07-31";
};

const instanceId = (controlNumber: string, country: string, unit: string) =>
  `${controlNumber}--EU--${country}--${unit}`
    .toUpperCase()
    .replace(/[^A-Z0-9.-]+/g, "-");

export const inventoryControls: InventoryControl[] = fullControlRows.map(
  (row) => {
    const assignedToDemo = demoAssignments.has(
      `${row.unit}::${row.controlNumber}`,
    );
    return {
      id: instanceId(row.controlNumber, row.country, row.unit),
      controlNumber: row.controlNumber,
      pillar: row.pillar,
      name: row.controlName,
      businessProcess: row.businessProcess,
      process: row.subProcess,
      objective: row.controlObjective,
      riskDescription: row.riskDescription,
      description: row.controlDescription,
      frequency: row.controlFrequency,
      attestationFrequency: row.attestationFrequency,
      keyControl: row.keyControl,
      fraudControl: row.fraudControl,
      nature: row.nature,
      type: row.controlType,
      evidenceRequirement: "Not scoped",
      evidenceRequired: false,
      owner: assignedToDemo ? "Demo Account" : "Unassigned",
      status: assignedToDemo ? "Acknowledgement pending" : "Unassigned",
      due: dueForAttestation(row.attestationFrequency),
      dtpStatus: "Not added",
      region: row.region,
      country: row.country,
      site: row.unit,
      unit: row.unit,
      instructions: row.controlDescription,
      applicable: true,
      lifecycle: "Active",
      dtpSummary: "",
      dtpOwner: assignedToDemo ? "Demo Account" : "Unassigned",
      dtpVersion: "",
      dtpLastReviewed: "",
      dtpNextReview: "",
      dtpDocument: "",
      dtpHistory: [],
      accepted: false,
      understood: false,
      performed: false,
      executionOutcome: "Not recorded",
      deviationNotes: "",
      documentationReviewed: false,
    };
  },
);

export const processCounts = Array.from(
  new Set(inventoryControls.map((control) => control.process)),
)
  .map((process) => ({
    process,
    count: inventoryControls.filter((control) => control.process === process)
      .length,
  }))
  .sort((a, b) => b.count - a.count);
