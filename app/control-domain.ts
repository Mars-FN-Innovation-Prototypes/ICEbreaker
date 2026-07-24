import type { ControlStatus, InventoryControl } from "./inventory-controls";

export type ControlExecution = {
  controlId: string;
  period: string;
  owner: string;
  status: ControlStatus;
  due: string;
  region: string;
  site: string;
  accepted: boolean;
  understood: boolean;
  acknowledgedAt?: string;
  performed: boolean;
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
    owner: "Unassigned",
    status: "Unassigned",
    due: "Not scheduled",
    region: control.region || "Europe",
    site: "",
    accepted: false,
    understood: false,
    performed: false,
  };
}

export const executionFields = new Set<keyof InventoryControl>([
  "owner",
  "status",
  "due",
  "region",
  "site",
  "accepted",
  "understood",
  "acknowledgedAt",
  "performed",
  "certifiedAt",
]);
