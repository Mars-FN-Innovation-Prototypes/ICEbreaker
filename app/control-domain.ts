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
    status: control.status,
    due: control.due,
    region: control.region || "Europe",
    country: control.country || "",
    site: control.site || control.unit || "",
    accepted: control.accepted || false,
    understood: control.understood || false,
    acknowledgedAt: control.acknowledgedAt,
    performed: control.performed || false,
    executionOutcome: control.executionOutcome || "Not recorded",
    deviationNotes: control.deviationNotes || "",
    draftSavedAt: control.draftSavedAt,
    documentationReviewed: control.documentationReviewed || false,
    documentationReviewedAt: control.documentationReviewedAt,
    certifiedAt: control.certifiedAt,
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
  "certifiedAt",
]);
