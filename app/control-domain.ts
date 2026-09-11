import type {
  ControlStatus,
  ExecutionOutcome,
  InventoryControl,
} from "./inventory-controls";

export type ControlExecution = {
  controlId: string;
  period: string;
  owner: string;
  status: ControlStatus;
  due: string;
  region: string;
  country: string;
  site: string;
  accepted: boolean;
  understood: boolean;
  acknowledgedAt?: string;
  performed: boolean;
  executionOutcome: ExecutionOutcome;
  deviationNotes: string;
  draftSavedAt?: string;
  documentationReviewed: boolean;
  documentationReviewedAt?: string;
  reassignmentRequested: boolean;
  certifiedAt?: string;
};

export type OwnershipChange = {
  id: string;
  controlId: string;
  period: string;
  fromOwner: string;
  toOwner: string;
  requestedBy: string;
  changedAt: string;
  handoverConfirmed: boolean;
  trainingConfirmed: boolean;
  status?: "Requested" | "Completed" | "Resolved";
  reviewedBy?: string;
  reviewedAt?: string;
  decisionNote?: string;
};

export type GapSeverity = "Low" | "Medium" | "High" | "Critical";
export type GapStatus = "Open" | "In progress" | "Ready for closure" | "Closed";

export type RemediationGap = {
  id: string;
  controlId: string;
  period: string;
  title: string;
  description: string;
  severity: GapSeverity;
  owner: string;
  due: string;
  status: GapStatus;
  closureEvidence: string;
  controllerApproved: boolean;
  createdAt: string;
  serviceNowReference?: string;
};

export type AuditEvent = {
  id: string;
  controlId: string;
  period: string;
  action: string;
  actor: string;
  timestamp: string;
  detail: string;
};

export const executionKey = (period: string, controlId: string) =>
  `${period}::${controlId}`;

export function defaultExecution(
  control: InventoryControl,
  period: string,
): ControlExecution {
  return {
    controlId: control.id,
    period,
    owner: control.owner || "Unassigned",
    status:
      control.owner === "Unassigned" ? "Unassigned" : "Acknowledgement pending",
    due: control.due,
    region: control.region || "Europe",
    country: control.country || "",
    site: control.site || control.unit || "",
    accepted: false,
    understood: false,
    performed: false,
    executionOutcome: "Not recorded",
    deviationNotes: "",
    documentationReviewed: false,
    reassignmentRequested: false,
  };
}

export const executionFields = new Set<keyof InventoryControl>([
  "owner",
  "status",
  "due",
  "region",
  "country",
  "site",
  "accepted",
  "understood",
  "acknowledgedAt",
  "performed",
  "executionOutcome",
  "deviationNotes",
  "draftSavedAt",
  "documentationReviewed",
  "documentationReviewedAt",
  "reassignmentRequested",
  "certifiedAt",
]);
