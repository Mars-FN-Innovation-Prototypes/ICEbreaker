"use client";
/* Static brand assets are intentionally served directly on GitHub Pages. */
/* eslint-disable @next/next/no-img-element */

import {
  Component,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  inventoryControls,
  processCounts,
  type ControlStatus,
  type ExecutionOutcome,
  type InventoryControl,
} from "./inventory-controls";
import {
  defaultExecution,
  executionFields,
  executionKey,
  type AuditEvent,
  type ControlExecution,
  type OwnershipChange,
  type RemediationGap,
} from "./control-domain";
import readXlsxFile from "read-excel-file";
import writeXlsxFile from "write-excel-file";

type Role = "Controller Admin" | "Control Owner";
type Nav =
  | "Control tower"
  | "My controls"
  | "Controls library"
  | "Reports"
  | "Gap remediation"
  | "Admin setup";
type Overlay = "help" | "notifications" | "profile" | null;
type Audience = "Leadership" | "Site owners" | "Controllers";
type ScopeConfig = { regions: string[]; countries: string[]; sites: string[] };
type SavedView = {
  name: string;
  businessProcess?: string;
  process: string;
  status: string;
  evidence: string;
  audience: Audience;
  region?: string;
  country?: string;
  pillar?: string;
  site?: string;
  owner?: string;
  controlType?: string;
  applicability?: string;
  keyControl?: string;
  frequency?: string;
  attestationFrequency?: string;
};

const CURRENT_USER = "Demo Account";
const DEMO_INITIALS = "DA";
const DATA_VERSION = "full-control-instances-v1";
const DEMO_OWNERS = [CURRENT_USER];
const DEFAULT_SCOPE: ScopeConfig = {
  regions: ["EU"],
  countries: ["Netherlands", "UK"],
  sites: ["OBL", "KLN"],
};
const normalizeControl = (control: InventoryControl): InventoryControl => ({
  ...control,
  controlNumber: control.controlNumber || control.id,
  pillar: control.pillar || "ICE Controls",
  businessProcess: control.businessProcess || "Inventory",
  objective: control.objective || "",
  riskDescription: control.riskDescription || "",
  description: control.description || control.instructions || "",
  attestationFrequency: control.attestationFrequency || control.frequency,
  fraudControl: control.fraudControl || false,
  country: control.country || "",
  applicable: control.applicable ?? true,
  dtpSummary: control.dtpSummary || "",
  dtpOwner: control.dtpOwner || "Controller Admin",
  dtpVersion: control.dtpVersion || "",
  dtpLastReviewed: control.dtpLastReviewed || "",
  dtpNextReview: control.dtpNextReview || "",
  dtpDocument: control.dtpDocument || "",
  dtpHistory: Array.isArray(control.dtpHistory) ? control.dtpHistory : [],
  executionOutcome: control.executionOutcome || "Not recorded",
  deviationNotes: control.deviationNotes || "",
  documentationReviewed: control.documentationReviewed || false,
});
const DEFAULT_VIEWS: SavedView[] = [
  {
    name: "Leadership control health",
    process: "All processes",
    status: "All statuses",
    evidence: "All evidence rules",
    audience: "Leadership",
  },
  {
    name: "Missing evidence",
    process: "All processes",
    status: "All statuses",
    evidence: "Evidence required",
    audience: "Controllers",
  },
  {
    name: "Ownership gaps",
    process: "All processes",
    status: "Unassigned",
    evidence: "All evidence rules",
    audience: "Controllers",
  },
];

const statusClass: Record<ControlStatus, string> = {
  Certified: "success",
  "Ready to certify": "success",
  "Performed with deviations": "warning",
  "Due soon": "review",
  "Evidence needed": "warning",
  "In progress": "review",
  Acknowledged: "review",
  "Acknowledgement pending": "neutral",
  Overdue: "danger",
  Unassigned: "neutral",
  "Not started": "neutral",
};

const controlCode = (control: InventoryControl) =>
  control.controlNumber || control.id;

const makeInstanceId = (
  controlNumber: string,
  region: string,
  country: string,
  unit: string,
) =>
  `${controlNumber}--${region}--${country}--${unit}`
    .toUpperCase()
    .replace(/[^A-Z0-9.-]+/g, "-");

const dueForFrequency = (frequency: string) => {
  const normalized = frequency.toLowerCase();
  if (normalized.includes("annual") && !normalized.includes("semi"))
    return "2026-12-31";
  if (normalized.includes("semi")) return "2026-06-30";
  return "2026-07-31";
};

const workflowStage = (
  control: InventoryControl,
  evidence: string[] = [],
) => {
  if (control.owner === "Unassigned") return "Unassigned";
  if (control.status === "Certified") return "Certified";
  if (control.executionOutcome === "Performed with deviations")
    return "Performed with deviations";
  if (control.performed && control.evidenceRequired && !evidence.length)
    return "Performed · evidence missing";
  if (control.performed) return "Ready to certify";
  if (control.draftSavedAt) return "In progress";
  if (control.accepted && control.understood) return "Acknowledged";
  return "Acknowledgement pending";
};

const derivedStatus = (
  control: InventoryControl,
  evidence: string[] = [],
): ControlStatus => {
  const stage = workflowStage(control, evidence);
  if (stage === "Unassigned") return "Unassigned";
  if (stage === "Certified") return "Certified";
  const due = /^\d{4}-\d{2}-\d{2}$/.test(control.due)
    ? new Date(`${control.due}T23:59:59`)
    : null;
  if (due && due.getTime() < Date.now()) return "Overdue";
  if (control.executionOutcome === "Performed with deviations")
    return "Performed with deviations";
  if (control.performed && control.evidenceRequired && !evidence.length)
    return "Evidence needed";
  if (control.performed) return "Ready to certify";
  if (control.draftSavedAt) return "In progress";
  if (control.accepted && control.understood) return "Acknowledged";
  if (due && due.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000)
    return "Due soon";
  return "Acknowledgement pending";
};

class ControlDrawerBoundary extends Component<
  { children: ReactNode; close: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <>
          <button
            className="drawer-scrim"
            onClick={this.props.close}
            aria-label="Close control details"
          />
          <aside className="control-drawer drawer-recovery">
            <div className="drawer-header">
              <strong>Control details could not be opened</strong>
              <button onClick={this.props.close}>×</button>
            </div>
            <div className="drawer-body empty-state">
              <strong>Your workspace is still available.</strong>
              <span>
                Close this panel and try again. Older browser-saved prototype
                data will be repaired automatically on reload.
              </span>
              <button className="primary-button" onClick={this.props.close}>
                Return to controls
              </button>
            </div>
          </aside>
        </>
      );
    return this.props.children;
  }
}

const copy: Record<Nav, { eyebrow: string; title: string; body: string }> = {
  "Control tower": {
    eyebrow: "Enterprise control health",
    title: "See risk sooner. Act before it grows.",
    body: "One live view of control ownership, execution and evidence across regions, sites and business processes.",
  },
  "My controls": {
    eyebrow: "Control Owner workspace",
    title: "Understand it. Own it. Certify it.",
    body: "Accept ownership, follow the documented procedure and complete each control with the right evidence.",
  },
  "Controls library": {
    eyebrow: "ICE controls library",
    title: "Find the control. Understand what good looks like.",
    body: "Explore the framework with evidence requirements, guidance and desktop procedures.",
  },
  Reports: {
    eyebrow: "Reporting engine",
    title: "Shape the view around the decision.",
    body: "Filter, visualize, save and download the control insights each audience needs.",
  },
  "Gap remediation": {
    eyebrow: "Exception management",
    title: "Turn every control gap into accountable action.",
    body: "Assign remediation, track target dates and retain closure evidence with Controller approval.",
  },
  "Admin setup": {
    eyebrow: "Controller administration",
    title: "Configure the hub as the organization evolves.",
    body: "Manage scope, applicability, ownership, evidence, instructions and reminders without changing the application.",
  },
};

const adminNav: Array<[Nav, string]> = [
  ["Control tower", "⌁"],
  ["Controls library", "◇"],
  ["Reports", "▤"],
  ["Gap remediation", "!"],
  ["Admin setup", "⚙"],
];
const ownerNav: Array<[Nav, string]> = [
  ["My controls", "✓"],
  ["Controls library", "◇"],
];

function Metric({
  label,
  value,
  note,
  tone = "blue",
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <article>
      <div className={`metric-icon ${tone}`}>
        {tone === "green"
          ? "✓"
          : tone === "orange"
            ? "!"
            : tone === "water"
              ? "⌁"
              : "◇"}
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

export default function IcebreakerApp() {
  const [role, setRole] = useState<Role>("Controller Admin");
  const [activeNav, setActiveNav] = useState<Nav>("Control tower");
  const [definitions, setDefinitions] = useState<InventoryControl[]>(
    inventoryControls.map(normalizeControl),
  );
  const [executions, setExecutions] = useState<Record<string, ControlExecution>>(
    {},
  );
  const [ownershipChanges, setOwnershipChanges] = useState<OwnershipChange[]>(
    [],
  );
  const [gaps, setGaps] = useState<RemediationGap[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<InventoryControl | null>(null);
  const [query, setQuery] = useState("");
  const [processFilter, setProcessFilter] = useState("All processes");
  const [businessProcessFilter, setBusinessProcessFilter] = useState(
    "All business processes",
  );
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [evidenceFilter, setEvidenceFilter] = useState("All evidence rules");
  const [pillarFilter, setPillarFilter] = useState("All control pillars");
  const [regionFilter, setRegionFilter] = useState("All configured regions");
  const [countryFilter, setCountryFilter] = useState("All countries");
  const [siteFilter, setSiteFilter] = useState("All configured sites");
  const [ownerFilter, setOwnerFilter] = useState("All owners");
  const [typeFilter, setTypeFilter] = useState("All control types");
  const [applicabilityFilter, setApplicabilityFilter] =
    useState("All applicability");
  const [keyFilter, setKeyFilter] = useState("All controls");
  const [frequencyFilter, setFrequencyFilter] = useState("All frequencies");
  const [attestationFilter, setAttestationFilter] = useState(
    "All attestation frequencies",
  );
  const [scopeConfig, setScopeConfig] = useState<ScopeConfig>(DEFAULT_SCOPE);
  const [audience, setAudience] = useState<Audience>("Leadership");
  const [savedViews, setSavedViews] = useState<SavedView[]>(DEFAULT_VIEWS);
  const [attachments, setAttachments] = useState<Record<string, string[]>>({});
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState("");
  const [period, setPeriod] = useState("July 2026");
  const [hydrated, setHydrated] = useState(false);

  const controls = useMemo(
    () =>
      definitions.map((definition) => {
        const execution =
          executions[executionKey(period, definition.id)] ||
          defaultExecution(definition, period);
        const merged = { ...definition, ...execution };
        return {
          ...merged,
          status: derivedStatus(
            merged,
            attachments[executionKey(period, definition.id)] || [],
          ),
        };
      }),
    [definitions, executions, period, attachments],
  );

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const storedVersion = window.localStorage.getItem(
          "icebreaker-data-version",
        );
        if (storedVersion !== DATA_VERSION) {
          setDefinitions(inventoryControls.map(normalizeControl));
          setExecutions({});
          setOwnershipChanges([]);
          setGaps([]);
          setAuditEvents([]);
          setSavedViews(DEFAULT_VIEWS);
          setAttachments({});
          setScopeConfig(DEFAULT_SCOPE);
          window.localStorage.setItem("icebreaker-data-version", DATA_VERSION);
          setHydrated(true);
          return;
        }
        const storedControls = window.localStorage.getItem(
          "icebreaker-controls",
        );
        const storedDefinitions = window.localStorage.getItem(
          "icebreaker-control-definitions",
        );
        const storedExecutions = window.localStorage.getItem(
          "icebreaker-executions",
        );
        const storedOwnershipChanges = window.localStorage.getItem(
          "icebreaker-ownership-changes",
        );
        const storedGaps = window.localStorage.getItem("icebreaker-gaps");
        const storedAudit = window.localStorage.getItem(
          "icebreaker-audit-events",
        );
        const storedViews = window.localStorage.getItem(
          "icebreaker-saved-views",
        );
        const storedAttachments = window.localStorage.getItem(
          "icebreaker-attachments",
        );
        const storedScope = window.localStorage.getItem("icebreaker-scope");
        if (storedDefinitions) {
          const parsed = JSON.parse(storedDefinitions);
          if (Array.isArray(parsed))
            setDefinitions(
              (parsed as InventoryControl[]).map(normalizeControl),
            );
        } else if (storedControls) {
          const parsed = JSON.parse(storedControls);
          if (Array.isArray(parsed)) {
            setDefinitions(
              (parsed as InventoryControl[]).map(normalizeControl),
            );
            setExecutions(
              Object.fromEntries(
                (parsed as InventoryControl[]).map((control) => [
                  executionKey("July 2026", control.id),
                  {
                    ...defaultExecution(control, "July 2026"),
                    owner:
                      control.owner === "Unassigned"
                        ? "Unassigned"
                        : CURRENT_USER,
                    status: control.status,
                    due: control.due,
                    region: control.region || "Europe",
                    site: control.site || "",
                  },
                ]),
              ),
            );
          }
        }
        if (storedExecutions) {
          const parsed = JSON.parse(storedExecutions);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            setExecutions(parsed);
        }
        if (storedOwnershipChanges) {
          const parsed = JSON.parse(storedOwnershipChanges);
          setOwnershipChanges(Array.isArray(parsed) ? parsed : []);
        }
        if (storedGaps) {
          const parsed = JSON.parse(storedGaps);
          setGaps(Array.isArray(parsed) ? parsed : []);
        }
        if (storedAudit) {
          const parsed = JSON.parse(storedAudit);
          setAuditEvents(Array.isArray(parsed) ? parsed : []);
        }
        if (storedViews) {
          const parsed = JSON.parse(storedViews);
          if (Array.isArray(parsed)) setSavedViews(parsed);
        }
        if (storedAttachments) {
          const parsed = JSON.parse(storedAttachments);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setAttachments(
              Object.fromEntries(
                Object.entries(parsed).map(([key, value]) => [
                  key,
                  Array.isArray(value)
                    ? value.filter((item): item is string =>
                        Boolean(item && typeof item === "string"),
                      )
                    : [],
                ]),
              ),
            );
          }
        }
        if (storedScope) {
          const parsed = JSON.parse(storedScope);
          if (
            parsed &&
            Array.isArray(parsed.regions) &&
            Array.isArray(parsed.sites)
          )
            setScopeConfig({
              regions: parsed.regions,
              countries: Array.isArray(parsed.countries)
                ? parsed.countries
                : DEFAULT_SCOPE.countries,
              sites: parsed.sites,
            });
        }
      } catch {
        /* Ignore stale local MVP data. */
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      "icebreaker-control-definitions",
      JSON.stringify(definitions),
    );
    window.localStorage.setItem(
      "icebreaker-executions",
      JSON.stringify(executions),
    );
    window.localStorage.setItem(
      "icebreaker-ownership-changes",
      JSON.stringify(ownershipChanges),
    );
    window.localStorage.setItem("icebreaker-gaps", JSON.stringify(gaps));
    window.localStorage.setItem(
      "icebreaker-audit-events",
      JSON.stringify(auditEvents),
    );
  }, [
    definitions,
    executions,
    ownershipChanges,
    gaps,
    auditEvents,
    hydrated,
  ]);
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      "icebreaker-saved-views",
      JSON.stringify(savedViews),
    );
  }, [savedViews, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      "icebreaker-attachments",
      JSON.stringify(attachments),
    );
  }, [attachments, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      "icebreaker-scope",
      JSON.stringify(scopeConfig),
    );
  }, [scopeConfig, hydrated]);

  const mine = useMemo(
    () => controls.filter((control) => control.owner === CURRENT_USER),
    [controls],
  );
  const filtered = useMemo(
    () =>
      controls.filter((control) => {
        const haystack =
          `${controlCode(control)} ${control.name} ${control.businessProcess} ${control.process} ${control.owner} ${control.country} ${control.unit} ${control.pillar}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (pillarFilter === "All control pillars" ||
            control.pillar === pillarFilter) &&
          (processFilter === "All processes" ||
            control.process === processFilter) &&
          (businessProcessFilter === "All business processes" ||
            control.businessProcess === businessProcessFilter) &&
          (statusFilter === "All statuses" ||
            control.status === statusFilter) &&
          (regionFilter === "All configured regions" ||
            !scopeConfig.regions.includes(regionFilter) ||
            control.region === regionFilter) &&
          (countryFilter === "All countries" ||
            !scopeConfig.countries.includes(countryFilter) ||
            control.country === countryFilter) &&
          (siteFilter === "All configured sites" ||
            !scopeConfig.sites.includes(siteFilter) ||
            control.site === siteFilter) &&
          (ownerFilter === "All owners" || control.owner === ownerFilter) &&
          (typeFilter === "All control types" || control.type === typeFilter) &&
          (applicabilityFilter === "All applicability" ||
            (applicabilityFilter === "Applicable"
              ? control.applicable
              : !control.applicable)) &&
          (keyFilter === "All controls" ||
            (keyFilter === "Key controls"
              ? control.keyControl
              : !control.keyControl)) &&
          (frequencyFilter === "All frequencies" ||
            control.frequency === frequencyFilter) &&
          (attestationFilter === "All attestation frequencies" ||
            control.attestationFrequency === attestationFilter) &&
          (evidenceFilter === "All evidence rules" ||
            (evidenceFilter === "Evidence required"
              ? control.evidenceRequired
              : !control.evidenceRequired))
        );
      }),
    [
      controls,
      query,
      pillarFilter,
      processFilter,
      businessProcessFilter,
      statusFilter,
      evidenceFilter,
      regionFilter,
      countryFilter,
      siteFilter,
      scopeConfig,
      ownerFilter,
      typeFilter,
      applicabilityFilter,
      keyFilter,
      frequencyFilter,
      attestationFilter,
    ],
  );

  const navItems = role === "Controller Admin" ? adminNav : ownerNav;
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const appendAudit = (
    controlId: string,
    action: string,
    detail: string,
  ) => {
    setAuditEvents((current) => [
      {
        id: crypto.randomUUID(),
        controlId,
        period,
        action,
        actor: CURRENT_USER,
        timestamp: new Date().toISOString(),
        detail,
      },
      ...current,
    ]);
  };
  const updateControl = (id: string, updates: Partial<InventoryControl>) => {
    const definitionUpdates: Partial<InventoryControl> = {};
    const executionUpdates: Partial<ControlExecution> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (executionFields.has(key as keyof InventoryControl)) {
        Object.assign(executionUpdates, { [key]: value });
      } else {
        Object.assign(definitionUpdates, { [key]: value });
      }
    });
    if (Object.keys(definitionUpdates).length) {
      setDefinitions((current) =>
        current.map((control) =>
          control.id === id ? { ...control, ...definitionUpdates } : control,
        ),
      );
    }
    if (Object.keys(executionUpdates).length) {
      const definition =
        definitions.find((control) => control.id === id) ||
        inventoryControls.find((control) => control.id === id);
      if (definition) {
        setExecutions((current) => {
          const key = executionKey(period, id);
          return {
            ...current,
            [key]: {
              ...(current[key] || defaultExecution(definition, period)),
              ...executionUpdates,
            },
          };
        });
      }
    }
    setSelected((current) =>
      current?.id === id ? { ...current, ...updates } : current,
    );
  };
  const setControls = (next: InventoryControl[]) => {
    setDefinitions(next.map(normalizeControl));
    setExecutions((current) => {
      const updated = { ...current };
      next.forEach((control) => {
        updated[executionKey(period, control.id)] = {
          ...(current[executionKey(period, control.id)] ||
            defaultExecution(control, period)),
          owner: control.owner,
          status: control.status,
          due: control.due,
          region: control.region,
          country: control.country,
          site: control.site,
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
      });
      return updated;
    });
  };
  const changeRole = (next: Role) => {
    setRole(next);
    setActiveNav(next === "Controller Admin" ? "Control tower" : "My controls");
    setSelected(null);
    setOverlay(null);
  };
  const downloadReport = () => {
    const rows = [
      [
        "Control instance ID",
        "Control #",
        "Control pillar",
        "Control name",
        "Business process",
        "Sub-process",
        "Control frequency",
        "Attestation frequency",
        "Control type",
        "Key control",
        "Fraud control",
        "Applicable",
        "Evidence required",
        "Control Owner",
        "Region",
        "Country",
        "Unit",
        "Ownership acknowledged",
        "Acknowledged at",
        "Status",
        "Workflow stage",
        "Documentation reviewed",
        "Execution outcome",
        "Deviation notes",
        "Evidence files",
        "Due",
      ],
      ...filtered.map((c) => [
        c.id,
        controlCode(c),
        c.pillar,
        c.name,
        c.businessProcess,
        c.process,
        c.frequency,
        c.attestationFrequency,
        c.type,
        c.keyControl ? "Yes" : "No",
        c.fraudControl ? "Yes" : "No",
        c.applicable ? "Yes" : "No",
        c.evidenceRequired ? "Yes" : "No",
        c.owner,
        c.region,
        c.country,
        c.unit,
        c.accepted && c.understood ? "Yes" : "No",
        c.acknowledgedAt || "",
        c.status,
        workflowStage(
          c,
          attachments[executionKey(period, c.id)] || [],
        ),
        c.documentationReviewed ? "Yes" : "No",
        c.executionOutcome || "Not recorded",
        c.deviationNotes || "",
        (attachments[executionKey(period, c.id)] || []).join("; "),
        c.due,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = "ICEbreaker-controls-report.csv";
    link.click();
    URL.revokeObjectURL(href);
    notify(`Downloaded ${filtered.length} controls`);
  };

  const pageCopy = copy[activeNav];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img
            className="brand-lockup"
            src="/brand/logo-lockup.png"
            alt="Mars Food & Nutrition"
          />
          <div className="product-name">
            <span className="ice-dot" />
            ICEbreaker
          </div>
          <p>Digitalized Controls Hub</p>
        </div>
        <div className="pilot-pill">
          <span>ICE</span>
          <div>
            <strong>Controls workspace</strong>
            <small>Food & Nutrition · Enterprise-ready</small>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map(([item, icon]) => (
            <button
              key={item}
              className={activeNav === item ? "nav-item active" : "nav-item"}
              onClick={() => setActiveNav(item)}
            >
              <span aria-hidden="true">{icon}</span>
              {item}
              {item === "My controls" && mine.length > 0 && (
                <b>{mine.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="purpose-card">
          <img
            src="/brand/better-food-text.png"
            alt="Better food today. A better world tomorrow."
          />
          <p>Controls that protect trust in every decision.</p>
        </div>
        <button
          className="profile-card"
          aria-label="Open Demo Account profile and change role"
          onClick={() => setOverlay("profile")}
        >
          <span>{DEMO_INITIALS}</span>
          <span>
            <strong>{CURRENT_USER}</strong>
            <small>Local MVP session · {role}</small>
          </span>
          <i>•••</i>
        </button>
      </aside>

      <main>
        <header className="topbar">
          <div className="mobile-brand">ICEbreaker</div>
          <label className="global-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search controls, owners or IDs"
              aria-label="Search controls"
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Help center"
              onClick={() => setOverlay("help")}
            >
              ?
            </button>
            <button
              className="icon-button notification"
              aria-label="Notifications"
              onClick={() => setOverlay("notifications")}
            >
              ♢<span />
            </button>
          </div>
        </header>
        <div className="content">
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span />
                {pageCopy.eyebrow}
              </div>
              <h1>{pageCopy.title}</h1>
              <p>{pageCopy.body}</p>
            </div>
            <label
              className="hero-date"
              title="Sets the active review and reporting cycle. Control requirements remain unchanged."
            >
              <span>Certification period</span>
              <select
                aria-label="Certification period"
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value);
                  notify(
                    `${event.target.value} selected · execution and evidence are tracked separately`,
                  );
                }}
              >
                <option>July 2026</option>
                <option>Q3 2026</option>
                <option>FY 2026</option>
              </select>
              <small>Active review & reporting cycle</small>
            </label>
          </section>
          <section className="purpose-line">
            <strong>Today, we’re making control ownership clear.</strong>
            <span>
              Because in the world we want tomorrow, every risk gets the right
              attention at the right time.
            </span>
          </section>
          {activeNav === "Control tower" && (
            <ControlTower
              controls={controls}
              openControl={setSelected}
              setActiveNav={setActiveNav}
            />
          )}
          {activeNav === "My controls" && (
            <MyControls
              controls={mine}
              openControl={setSelected}
              setActiveNav={setActiveNav}
            />
          )}
          {activeNav === "Controls library" && (
            <ControlsLibrary
              controls={filtered}
              processFilter={processFilter}
              setProcessFilter={setProcessFilter}
              businessProcessFilter={businessProcessFilter}
              setBusinessProcessFilter={setBusinessProcessFilter}
              evidenceFilter={evidenceFilter}
              setEvidenceFilter={setEvidenceFilter}
              pillarFilter={pillarFilter}
              setPillarFilter={setPillarFilter}
              openControl={setSelected}
              downloadReport={downloadReport}
            />
          )}
          {activeNav === "Reports" && (
            <Reports
              controls={filtered}
              availableControls={controls}
              processFilter={processFilter}
              setProcessFilter={setProcessFilter}
              businessProcessFilter={businessProcessFilter}
              setBusinessProcessFilter={setBusinessProcessFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              evidenceFilter={evidenceFilter}
              setEvidenceFilter={setEvidenceFilter}
              pillarFilter={pillarFilter}
              setPillarFilter={setPillarFilter}
              regionFilter={regionFilter}
              setRegionFilter={setRegionFilter}
              countryFilter={countryFilter}
              setCountryFilter={setCountryFilter}
              siteFilter={siteFilter}
              setSiteFilter={setSiteFilter}
              ownerFilter={ownerFilter}
              setOwnerFilter={setOwnerFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              applicabilityFilter={applicabilityFilter}
              setApplicabilityFilter={setApplicabilityFilter}
              keyFilter={keyFilter}
              setKeyFilter={setKeyFilter}
              frequencyFilter={frequencyFilter}
              setFrequencyFilter={setFrequencyFilter}
              attestationFilter={attestationFilter}
              setAttestationFilter={setAttestationFilter}
              scopeConfig={scopeConfig}
              audience={audience}
              setAudience={setAudience}
              savedViews={savedViews}
              setSavedViews={setSavedViews}
              downloadReport={downloadReport}
              notify={notify}
              openControl={setSelected}
              ownershipChanges={ownershipChanges}
              auditEvents={auditEvents}
            />
          )}
          {activeNav === "Gap remediation" && (
            <GapRemediation
              gaps={gaps}
              controls={controls}
              updateGaps={setGaps}
              notify={notify}
              appendAudit={appendAudit}
              period={period}
            />
          )}
          {activeNav === "Admin setup" && (
            <AdminSetup
              controls={controls}
              setControls={setControls}
              updateControl={updateControl}
              notify={notify}
              openControl={setSelected}
              setActiveNav={setActiveNav}
              scopeConfig={scopeConfig}
              setScopeConfig={setScopeConfig}
            />
          )}
        </div>
      </main>

      {selected && (
        <ControlDrawerBoundary
          key={`${period}-${selected.id}-${role}`}
          close={() => setSelected(null)}
        >
          <ControlDrawer
            control={selected}
            role={role}
            period={period}
            attachments={
              attachments[executionKey(period, selected.id)] || []
            }
            previousEvidence={Object.entries(attachments)
              .filter(
                ([key, files]) =>
                  key.endsWith(`::${selected.id}`) &&
                  key !== executionKey(period, selected.id) &&
                  files.length > 0,
              )
              .flatMap(([key, files]) =>
                files.map((file) => ({ period: key.split("::")[0], file })),
              )}
            close={() => setSelected(null)}
            updateControl={updateControl}
            addAttachment={(name) =>
              setAttachments((current) => ({
                ...current,
                [executionKey(period, selected.id)]: [
                  ...(current[executionKey(period, selected.id)] || []),
                  name,
                ],
              }))
            }
            notify={notify}
            changeRole={changeRole}
            scopeConfig={scopeConfig}
            ownershipChanges={ownershipChanges}
            setOwnershipChanges={setOwnershipChanges}
            gaps={gaps}
            setGaps={setGaps}
            appendAudit={appendAudit}
          />
        </ControlDrawerBoundary>
      )}
      {overlay && (
        <OverlayPanel
          type={overlay}
          role={role}
          controls={controls}
          mine={mine}
          close={() => setOverlay(null)}
          openProfile={() => setOverlay("profile")}
          changeRole={changeRole}
          go={(nav) => {
            setActiveNav(nav);
            setOverlay(null);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

function OverlayPanel({
  type,
  role,
  controls,
  mine,
  close,
  openProfile,
  changeRole,
  go,
}: {
  type: Exclude<Overlay, null>;
  role: Role;
  controls: InventoryControl[];
  mine: InventoryControl[];
  close: () => void;
  openProfile: () => void;
  changeRole: (role: Role) => void;
  go: (nav: Nav) => void;
}) {
  const unassigned = controls.filter(
    (control) => control.owner === "Unassigned",
  ).length;
  const missingDtp = controls.filter(
    (control) => control.dtpStatus !== "Current",
  ).length;
  return (
    <>
      <button
        className="modal-scrim"
        onClick={close}
        aria-label="Close panel"
      />
      <section
        className="utility-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${type} panel`}
      >
        <header>
          <div>
            <span className="section-kicker">ICEbreaker</span>
            <h2>
              {type === "help"
                ? "Help center & 101"
                : type === "notifications"
                  ? "Notifications"
                  : "Profile & access"}
            </h2>
          </div>
          <button onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        {type === "help" && (
          <div className="modal-body help-body">
            <div className="help-lead">
              <strong>Two roles. One connected control lifecycle.</strong>
              <p>
                Controller Admins configure and monitor the process. Control
                Owners accept, perform and certify their assigned controls.
              </p>
            </div>
            <div className="role-guide">
              <article>
                <span>Controller Admin</span>
                <strong>Configure → assign → monitor → report</strong>
                <p>
                  Sets scope, ownership, evidence rules, due dates, DTP guidance
                  and reminder schedules.
                </p>
              </article>
              <article>
                <span>Control Owner</span>
                <strong>Accept → understand → perform → certify</strong>
                <p>
                  Works only from assigned controls and uploads evidence where
                  required.
                </p>
              </article>
            </div>
            <ol className="help-steps">
              <li>
                <b>1</b>
                <span>
                  <strong>Set up the framework</strong>
                  <small>
                    Admin setup defines applicability and assigns Control
                    Owners.
                  </small>
                </span>
              </li>
              <li>
                <b>2</b>
                <span>
                  <strong>Execute the control</strong>
                  <small>
                    The owner follows instructions and the local desktop
                    procedure (DTP).
                  </small>
                </span>
              </li>
              <li>
                <b>3</b>
                <span>
                  <strong>Certify and monitor</strong>
                  <small>
                    Status updates flow into the Control tower and audience
                    reporting.
                  </small>
                </span>
              </li>
            </ol>
            <a className="doc-download" href="./ICEbreaker-101.docx" download>
              ⇩ Download the complete ICEbreaker 101 guide
            </a>
            <a
              className="doc-download stakeholder-guide"
              href="./ICEbreaker-Stakeholder-Review-Guide.docx"
              download
            >
              ⇩ Download the stakeholder review guide
            </a>
          </div>
        )}
        {type === "notifications" && (
          <div className="modal-body notification-list">
            <button onClick={() => go("Admin setup")}>
              <span className="alert-icon warning-bg">!</span>
              <span>
                <strong>{unassigned} controls need an owner</strong>
                <small>
                  Open Ownership setup to assign accountable Control Owners.
                </small>
              </span>
              <b>›</b>
            </button>
            <button onClick={() => go("Admin setup")}>
              <span className="alert-icon warning-bg">D</span>
              <span>
                <strong>{missingDtp} desktop procedures need attention</strong>
                <small>Add or review local step-by-step guidance.</small>
              </span>
              <b>›</b>
            </button>
            <button onClick={openProfile}>
              <span className="alert-icon">✓</span>
              <span>
                <strong>{mine.length} controls assigned to Demo Account</strong>
                <small>
                  {mine.length
                    ? "Open the profile to switch into the Control Owner review queue."
                    : "Assign a control, then switch roles from the Demo Account profile."}
                </small>
              </span>
              <b>›</b>
            </button>
          </div>
        )}
        {type === "profile" && (
          <div className="modal-body profile-panel">
            <div className="profile-identity">
              <span>{DEMO_INITIALS}</span>
              <div>
                <strong>{CURRENT_USER}</strong>
                <small>Local MVP session</small>
              </div>
            </div>
            <div className="auth-note">
              <strong>Microsoft SSO is not connected yet</strong>
              <p>
                This demo account can preview both role experiences. In the
                enterprise version, Microsoft Entra ID will determine each
                person’s identity and permissions.
              </p>
            </div>
            <span className="section-kicker">Preview role</span>
            <div className="profile-role-switch">
              {(["Controller Admin", "Control Owner"] as const).map((item) => (
                <button
                  className={role === item ? "active" : ""}
                  key={item}
                  onClick={() => changeRole(item)}
                >
                  <strong>{item}</strong>
                  <small>
                    {item === "Controller Admin"
                      ? "Configure and monitor"
                      : "Review assigned controls"}
                  </small>
                </button>
              ))}
            </div>
            <p className="profile-assignment-note">
              Controls assigned in this MVP are always assigned to Demo Account,
              so switching to Control Owner shows the exact review queue created
              during admin setup.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function ControlTower({
  controls,
  openControl,
  setActiveNav,
}: {
  controls: InventoryControl[];
  openControl: (c: InventoryControl) => void;
  setActiveNav: (n: Nav) => void;
}) {
  const certified = controls.filter((c) => c.status === "Certified").length;
  const assigned = controls.filter((c) => c.owner !== "Unassigned").length;
  const completion = controls.length
    ? Math.round((certified / controls.length) * 100)
    : 0;
  const attention = controls
    .filter((c) => c.status !== "Certified")
    .slice(0, 3);
  return (
    <>
      <section className="metrics">
        <Metric
          label="Controls in scope"
          value={`${controls.length}`}
          note="Configured ICE controls"
        />
        <Metric
          label="Ownership assigned"
          value={`${assigned}/${controls.length}`}
          note="Control Owner coverage"
          tone="green"
        />
        <Metric
          label="Evidence required"
          value={`${controls.filter((c) => c.evidenceRequired).length}`}
          note="Admin-configurable rules"
          tone="orange"
        />
        <Metric
          label="DTP coverage"
          value={`${controls.filter((c) => c.dtpStatus === "Current").length}/${controls.length}`}
          note="Desktop procedures current"
          tone="water"
        />
      </section>
      <section className="dashboard-grid">
        <article className="panel health-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Live control health</span>
              <h2>Execution at a glance</h2>
            </div>
            <button
              className="text-button"
              onClick={() => setActiveNav("Reports")}
            >
              View report →
            </button>
          </div>
          <div className="health-content">
            <div
              className="donut"
              style={{
                background: `conic-gradient(var(--pea) 0 ${completion}%, #e8e2dc ${completion}% 100%)`,
              }}
            >
              <div>
                <strong>{completion}%</strong>
                <span>certified</span>
              </div>
            </div>
            <div className="legend">
              {(
                [
                  "Certified",
                  "Not started",
                  "Evidence needed",
                  "Unassigned",
                ] as ControlStatus[]
              ).map((status) => (
                <div key={status}>
                  <span
                    className={`legend-dot ${status === "Certified" ? "on-track" : status === "Evidence needed" ? "at-risk" : status === "Unassigned" ? "overdue" : "in-review"}`}
                  />
                  <span>{status}</span>
                  <strong>
                    {controls.filter((c) => c.status === status).length}
                  </strong>
                </div>
              ))}
            </div>
            <div className="setup-progress">
              <span className="section-kicker">Getting started</span>
              <div>
                <strong>1</strong>
                <span>Configure regions and sites</span>
                <button onClick={() => setActiveNav("Admin setup")}>
                  Open setup
                </button>
              </div>
              <div>
                <strong>2</strong>
                <span>Assign Control Owners</span>
                <button onClick={() => setActiveNav("Admin setup")}>
                  Assign
                </button>
              </div>
              <div>
                <strong>3</strong>
                <span>Monitor execution</span>
                <button onClick={() => setActiveNav("Reports")}>Report</button>
              </div>
            </div>
          </div>
        </article>
        <article className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker orange-text">Prioritized</span>
              <h2>Needs your attention</h2>
            </div>
            <span className="count-badge">
              {controls.filter((c) => c.status !== "Certified").length} items
            </span>
          </div>
          {attention.map((control) => (
            <button
              className="attention-item"
              key={control.id}
              onClick={() => openControl(control)}
            >
              <span className="alert-icon warning-bg">?</span>
              <span>
                <strong>{control.status}</strong>
                <small>
                  {control.id} · {control.process} · {control.due}
                </small>
              </span>
              <b>›</b>
            </button>
          ))}
          <button
            className="attention-cta"
            onClick={() => setActiveNav("Admin setup")}
          >
            Complete control setup<span>→</span>
          </button>
        </article>
      </section>
      <ControlTable
        controls={controls.slice(0, 8)}
        title="Controls ready for configuration"
        openControl={openControl}
        onExport={() => setActiveNav("Reports")}
      />
    </>
  );
}

function MyControls({
  controls,
  openControl,
  setActiveNav,
}: {
  controls: InventoryControl[];
  openControl: (c: InventoryControl) => void;
  setActiveNav: (n: Nav) => void;
}) {
  const certified = controls.filter((c) => c.status === "Certified").length;
  return (
    <section className="workspace-view">
      <div className="view-metrics">
        <article>
          <span>Assigned to me</span>
          <strong>{controls.length}</strong>
          <small>Current period</small>
        </article>
        <article>
          <span>To acknowledge</span>
          <strong>
            {controls.filter((c) => !c.accepted || !c.understood).length}
          </strong>
          <small>Accept and understand</small>
        </article>
        <article>
          <span>Need attention</span>
          <strong>
            {
              controls.filter(
                (c) => c.status === "Overdue" || c.status === "Evidence needed",
              ).length
            }
          </strong>
          <small>Act before due date</small>
        </article>
        <article>
          <span>Certified</span>
          <strong>{certified}</strong>
          <small>Current period</small>
        </article>
      </div>
      {controls.length ? (
        <div className="view-grid">
          <article className="panel view-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Prioritized queue</span>
                <h2>Your next best actions</h2>
              </div>
              <span className="count-badge">{controls.length} assigned</span>
            </div>
            {controls.map((control, index) => (
              <button
                className="work-item"
                key={control.id}
                onClick={() => openControl(control)}
              >
                <span className={`work-order ${index < 2 ? "urgent" : ""}`}>
                  {index + 1}
                </span>
                <span>
                  <strong>{control.name}</strong>
                  <small>
                    {control.id} · {control.process} · {control.due}
                  </small>
                </span>
                <span className={`status ${statusClass[control.status]}`}>
                  <i />
                  {!control.accepted || !control.understood
                    ? "Acknowledge"
                    : control.status}
                </span>
                <b>›</b>
              </button>
            ))}
          </article>
          <OwnerJourney controls={controls} />
        </div>
      ) : (
        <article className="panel owner-empty">
          <span>✓</span>
          <h2>No controls are assigned to this local MVP user</h2>
          <p>
            Assignments are created by a Controller Admin. The badge is
            intentionally hidden until this user has real work.
          </p>
          <button onClick={() => setActiveNav("Controls library")}>
            Browse the controls library
          </button>
        </article>
      )}
    </section>
  );
}

function OwnerJourney({ controls }: { controls: InventoryControl[] }) {
  const total = controls.length;
  const acknowledged = controls.filter(
    (control) => control.accepted && control.understood,
  ).length;
  const performed = controls.filter((control) => control.performed).length;
  const certified = controls.filter(
    (control) => control.status === "Certified",
  ).length;
  return (
    <article className="panel view-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Control Owner journey</span>
          <h2>One guided execution flow</h2>
        </div>
      </div>
      <div className="journey">
        <div className={acknowledged === total && total ? "done" : "current"}>
          <i>1</i>
          <span>
            <strong>Confirm & accept ownership</strong>
            <small>
              {acknowledged} of {total} acknowledged separately
            </small>
          </span>
        </div>
        <div
          className={
            performed === total && total
              ? "done"
              : acknowledged > 0
                ? "current"
                : ""
          }
        >
          <i>2</i>
          <span>
            <strong>Understand & perform</strong>
            <small>
              {performed} of {total} execution confirmations
            </small>
          </span>
        </div>
        <div
          className={
            certified === total && total
              ? "done"
              : performed > 0
                ? "current"
                : ""
          }
        >
          <i>3</i>
          <span>
            <strong>Upload & certify</strong>
            <small>
              {certified} of {total} controls certified
            </small>
          </span>
        </div>
      </div>
    </article>
  );
}

function ControlsLibrary({
  controls,
  processFilter,
  setProcessFilter,
  businessProcessFilter,
  setBusinessProcessFilter,
  evidenceFilter,
  setEvidenceFilter,
  pillarFilter,
  setPillarFilter,
  openControl,
  downloadReport,
}: {
  controls: InventoryControl[];
  processFilter: string;
  setProcessFilter: (v: string) => void;
  businessProcessFilter: string;
  setBusinessProcessFilter: (v: string) => void;
  evidenceFilter: string;
  setEvidenceFilter: (v: string) => void;
  pillarFilter: string;
  setPillarFilter: (v: string) => void;
  openControl: (c: InventoryControl) => void;
  downloadReport: () => void;
}) {
  return (
    <section className="workspace-view">
      <div className="filter-bar">
        <label>
          Control pillar
          <select
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value)}
          >
            <option>All control pillars</option>
            <option>ICE Controls</option>
            <option>Sustainability Controls</option>
            <option>Operating Controls</option>
          </select>
        </label>
        <label>
          Business process
          <select
            value={businessProcessFilter}
            onChange={(e) => setBusinessProcessFilter(e.target.value)}
          >
            <option>All business processes</option>
            {Array.from(new Set(controls.map((c) => c.businessProcess)))
              .sort()
              .map((process) => (
                <option key={process}>{process}</option>
              ))}
          </select>
        </label>
        <label>
          Sub-process
          <select
            value={processFilter}
            onChange={(e) => setProcessFilter(e.target.value)}
          >
            <option>All processes</option>
            {processCounts.map(({ process }) => (
              <option key={process}>{process}</option>
            ))}
          </select>
        </label>
        <label>
          Evidence rule
          <select
            value={evidenceFilter}
            onChange={(e) => setEvidenceFilter(e.target.value)}
          >
            <option>All evidence rules</option>
            <option>Evidence required</option>
            <option>Certification only</option>
          </select>
        </label>
        <button
          onClick={() => {
            setProcessFilter("All processes");
            setBusinessProcessFilter("All business processes");
            setEvidenceFilter("All evidence rules");
            setPillarFilter("All control pillars");
          }}
        >
          Clear filters
        </button>
        <span>{controls.length} controls</span>
      </div>
      <ControlTable
        controls={controls}
        title="Enterprise controls library"
        openControl={openControl}
        showRules
        onExport={downloadReport}
      />
    </section>
  );
}

function Reports({
  controls,
  availableControls,
  processFilter,
  setProcessFilter,
  businessProcessFilter,
  setBusinessProcessFilter,
  statusFilter,
  setStatusFilter,
  evidenceFilter,
  setEvidenceFilter,
  pillarFilter,
  setPillarFilter,
  regionFilter,
  setRegionFilter,
  countryFilter,
  setCountryFilter,
  siteFilter,
  setSiteFilter,
  ownerFilter,
  setOwnerFilter,
  typeFilter,
  setTypeFilter,
  applicabilityFilter,
  setApplicabilityFilter,
  keyFilter,
  setKeyFilter,
  frequencyFilter,
  setFrequencyFilter,
  attestationFilter,
  setAttestationFilter,
  scopeConfig,
  audience,
  setAudience,
  savedViews,
  setSavedViews,
  downloadReport,
  notify,
  openControl,
  ownershipChanges,
  auditEvents,
}: {
  controls: InventoryControl[];
  availableControls: InventoryControl[];
  processFilter: string;
  setProcessFilter: (v: string) => void;
  businessProcessFilter: string;
  setBusinessProcessFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  evidenceFilter: string;
  setEvidenceFilter: (v: string) => void;
  pillarFilter: string;
  setPillarFilter: (v: string) => void;
  regionFilter: string;
  setRegionFilter: (v: string) => void;
  countryFilter: string;
  setCountryFilter: (v: string) => void;
  siteFilter: string;
  setSiteFilter: (v: string) => void;
  ownerFilter: string;
  setOwnerFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  applicabilityFilter: string;
  setApplicabilityFilter: (v: string) => void;
  keyFilter: string;
  setKeyFilter: (v: string) => void;
  frequencyFilter: string;
  setFrequencyFilter: (v: string) => void;
  attestationFilter: string;
  setAttestationFilter: (v: string) => void;
  scopeConfig: ScopeConfig;
  audience: Audience;
  setAudience: (v: Audience) => void;
  savedViews: SavedView[];
  setSavedViews: (v: SavedView[]) => void;
  downloadReport: () => void;
  notify: (m: string) => void;
  openControl: (c: InventoryControl) => void;
  ownershipChanges: OwnershipChange[];
  auditEvents: AuditEvent[];
}) {
  const owners = Array.from(
    new Set(availableControls.map((c) => c.owner)),
  ).sort();
  const controlTypes = Array.from(
    new Set(availableControls.map((c) => c.type)),
  ).sort();
  const businessProcesses = Array.from(
    new Set(availableControls.map((c) => c.businessProcess)),
  ).sort();
  const frequencies = Array.from(
    new Set(availableControls.map((c) => c.frequency)),
  ).sort();
  const attestationFrequencies = Array.from(
    new Set(availableControls.map((c) => c.attestationFrequency)),
  ).sort();
  const save = () => {
    const name = window
      .prompt(
        "Name this reporting view",
        `Saved control view ${savedViews.length + 1}`,
      )
      ?.trim();
    if (!name) return;
    setSavedViews([
      ...savedViews,
      {
        name,
        businessProcess: businessProcessFilter,
        process: processFilter,
        status: statusFilter,
        evidence: evidenceFilter,
        audience,
        pillar: pillarFilter,
        region: regionFilter,
        country: countryFilter,
        site: siteFilter,
        owner: ownerFilter,
        controlType: typeFilter,
        applicability: applicabilityFilter,
        keyControl: keyFilter,
        frequency: frequencyFilter,
        attestationFrequency: attestationFilter,
      },
    ]);
    notify(`Saved “${name}”`);
  };
  const load = (view: SavedView) => {
    setBusinessProcessFilter(
      view.businessProcess || "All business processes",
    );
    setProcessFilter(view.process);
    setStatusFilter(view.status);
    setEvidenceFilter(view.evidence);
    setPillarFilter(view.pillar || "All control pillars");
    setRegionFilter(view.region || "All configured regions");
    setCountryFilter(view.country || "All countries");
    setSiteFilter(view.site || "All configured sites");
    setOwnerFilter(view.owner || "All owners");
    setTypeFilter(view.controlType || "All control types");
    setApplicabilityFilter(view.applicability || "All applicability");
    setKeyFilter(view.keyControl || "All controls");
    setFrequencyFilter(view.frequency || "All frequencies");
    setAttestationFilter(
      view.attestationFrequency || "All attestation frequencies",
    );
    setAudience(view.audience);
    notify(`Loaded “${view.name}”`);
  };
  return (
    <section className="workspace-view">
      <div className="audience-tabs">
        <span>Reporting for</span>
        {(["Leadership", "Site owners", "Controllers"] as Audience[]).map(
          (item) => (
            <button
              className={audience === item ? "active" : ""}
              key={item}
              onClick={() => setAudience(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <AudienceDashboard
        audience={audience}
        controls={controls}
        scopeConfig={scopeConfig}
      />
      <div className="report-layout">
        <article className="panel report-builder">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Advanced filters</span>
              <h2>Build a reporting view</h2>
            </div>
            <button className="primary-small" onClick={save}>
              Save this view
            </button>
          </div>
          <div className="scope-lock">
            <span>Business segment</span>
            <strong>Food & Nutrition</strong>
            <small>Fixed application scope</small>
          </div>
          <div className="report-filters">
            <label>
              Control pillar
              <select
                value={pillarFilter}
                onChange={(e) => setPillarFilter(e.target.value)}
              >
                <option>All control pillars</option>
                <option>ICE Controls</option>
                <option>Sustainability Controls</option>
                <option>Operating Controls</option>
              </select>
            </label>
            <label>
              Region
              <select
                value={
                  scopeConfig.regions.includes(regionFilter)
                    ? regionFilter
                    : "All configured regions"
                }
                onChange={(e) => setRegionFilter(e.target.value)}
              >
                <option>All configured regions</option>
                {scopeConfig.regions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            </label>
            <label>
              Country
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              >
                <option>All countries</option>
                {scopeConfig.countries.map((country) => (
                  <option key={country}>{country}</option>
                ))}
              </select>
            </label>
            <label>
              Unit / site
              <select
                value={
                  scopeConfig.sites.includes(siteFilter)
                    ? siteFilter
                    : "All configured sites"
                }
                onChange={(e) => setSiteFilter(e.target.value)}
              >
                <option>All configured sites</option>
                {scopeConfig.sites.map((site) => (
                  <option key={site}>{site}</option>
                ))}
              </select>
            </label>
            <label>
              Business process
              <select
                value={businessProcessFilter}
                onChange={(e) => setBusinessProcessFilter(e.target.value)}
              >
                <option>All business processes</option>
                {businessProcesses.map((process) => (
                  <option key={process}>{process}</option>
                ))}
              </select>
            </label>
            <label>
              Sub-process
              <select
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
              >
                <option>All processes</option>
                {processCounts.map(({ process }) => (
                  <option key={process}>{process}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All statuses</option>
                {Object.keys(statusClass).map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Evidence
              <select
                value={evidenceFilter}
                onChange={(e) => setEvidenceFilter(e.target.value)}
              >
                <option>All evidence rules</option>
                <option>Evidence required</option>
                <option>Certification only</option>
              </select>
            </label>
            <label>
              Control Owner
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
              >
                <option>All owners</option>
                {owners.map((owner) => (
                  <option key={owner}>{owner}</option>
                ))}
              </select>
            </label>
            <label>
              Control type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option>All control types</option>
                {controlTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Applicability
              <select
                value={applicabilityFilter}
                onChange={(e) => setApplicabilityFilter(e.target.value)}
              >
                <option>All applicability</option>
                <option>Applicable</option>
                <option>Not applicable</option>
              </select>
            </label>
            <label>
              Key control
              <select
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
              >
                <option>All controls</option>
                <option>Key controls</option>
                <option>Non-key controls</option>
              </select>
            </label>
            <label>
              Control frequency
              <select
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value)}
              >
                <option>All frequencies</option>
                {frequencies.map((frequency) => (
                  <option key={frequency}>{frequency}</option>
                ))}
              </select>
            </label>
            <label>
              Attestation frequency
              <select
                value={attestationFilter}
                onChange={(e) => setAttestationFilter(e.target.value)}
              >
                <option>All attestation frequencies</option>
                {attestationFrequencies.map((frequency) => (
                  <option key={frequency}>{frequency}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="report-result">
            <div>
              <strong>{controls.length}</strong>
              <span>matching controls</span>
            </div>
            <div>
              <strong>
                {controls.filter((c) => c.status === "Certified").length}
              </strong>
              <span>certified</span>
            </div>
            <div>
              <strong>
                {controls.filter((c) => c.owner === "Unassigned").length}
              </strong>
              <span>unassigned</span>
            </div>
            <button onClick={downloadReport}>⇩ Download CSV</button>
          </div>
        </article>
        <aside className="panel saved-views">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Reusable</span>
              <h2>Saved views</h2>
            </div>
          </div>
          {savedViews.map((view, index) => (
            <button key={`${view.name}-${index}`} onClick={() => load(view)}>
              <span className={`saved-icon s${index % 3}`}>▤</span>
              <span>
                <strong>{view.name}</strong>
                <small>
                  {view.audience} ·{" "}
                  {view.process === "All processes"
                    ? "All processes"
                    : view.process}
                </small>
              </span>
              <b>›</b>
            </button>
          ))}
        </aside>
      </div>
      {audience === "Controllers" && (
        <div className="report-layout">
          <article className="panel ownership-history">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Accountability trail</span>
                <h2>Recent ownership changes</h2>
              </div>
              <span>{ownershipChanges.length} recorded</span>
            </div>
            {ownershipChanges.length ? (
              ownershipChanges.slice(0, 8).map((change) => (
                <div className="change-row" key={change.id}>
                  <span>{change.controlId}</span>
                  <strong>
                    {change.fromOwner} → {change.toOwner}
                  </strong>
                  <small>
                    {change.period} · Handover{" "}
                    {change.handoverConfirmed ? "confirmed" : "missing"} ·
                    Training{" "}
                    {change.trainingConfirmed ? "confirmed" : "missing"}
                  </small>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <strong>No ownership changes recorded.</strong>
                <span>Confirmed reassignments will appear here.</span>
              </div>
            )}
          </article>
          <article className="panel ownership-history">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Audit trail</span>
                <h2>Recent control activity</h2>
              </div>
              <span>{auditEvents.length} events</span>
            </div>
            {auditEvents.length ? (
              auditEvents.slice(0, 8).map((event) => (
                <div className="change-row" key={event.id}>
                  <span>{event.controlId}</span>
                  <strong>{event.action}</strong>
                  <small>
                    {event.period} · {event.actor} ·{" "}
                    {new Date(event.timestamp).toLocaleString()}
                  </small>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <strong>No control activity recorded.</strong>
                <span>Certifications and material changes will appear here.</span>
              </div>
            )}
          </article>
        </div>
      )}
      <ControlTable
        controls={controls.slice(0, 10)}
        title="Report preview"
        openControl={openControl}
        onExport={downloadReport}
      />
    </section>
  );
}

function AudienceDashboard({
  audience,
  controls,
  scopeConfig,
}: {
  audience: Audience;
  controls: InventoryControl[];
  scopeConfig: ScopeConfig;
}) {
  const count = Math.max(controls.length, 1);
  const certified = controls.filter((c) => c.status === "Certified").length;
  const assigned = controls.filter((c) => c.owner !== "Unassigned").length;
  const dtp = controls.filter((c) => c.dtpStatus === "Current").length;
  const topProcesses = processCounts.slice(0, 5).map((item) => ({
    ...item,
    matching: controls.filter((c) => c.process === item.process).length,
  }));
  if (audience === "Site owners")
    return <SiteOwnerDashboard controls={controls} scopeConfig={scopeConfig} />;
  if (audience === "Leadership")
    return (
      <section className="report-visual-grid">
        <article className="panel visual-card">
          <span className="section-kicker">Enterprise health</span>
          <h2>Certification progress</h2>
          <div
            className="report-donut"
            style={{
              background: `conic-gradient(var(--pea) 0 ${Math.round((certified / count) * 100)}%, #ece6e1 ${Math.round((certified / count) * 100)}% 100%)`,
            }}
          >
            <div>
              <strong>{Math.round((certified / count) * 100)}%</strong>
              <span>certified</span>
            </div>
          </div>
        </article>
        <article className="panel visual-card wide">
          <span className="section-kicker">Portfolio signal</span>
          <h2>Controls by status</h2>
          <div className="chart-bars">
            {Object.keys(statusClass).map((status) => {
              const value = controls.filter((c) => c.status === status).length;
              return (
                <div key={status}>
                  <span>{status}</span>
                  <i>
                    <b style={{ width: `${(value / count) * 100}%` }} />
                  </i>
                  <strong>{value}</strong>
                </div>
              );
            })}
          </div>
        </article>
        <article className="panel visual-card">
          <span className="section-kicker">Concentration</span>
          <h2>Largest control areas</h2>
          <div className="rank-list">
            {topProcesses.map((item) => (
              <div key={item.process}>
                <span>{item.process}</span>
                <strong>{item.matching}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    );
  if (audience === "Site owners")
    return (
      <section className="report-visual-grid">
        <article className="panel visual-card">
          <span className="section-kicker">Site readiness</span>
          <h2>Ownership coverage</h2>
          <strong className="big-number">
            {Math.round((assigned / count) * 100)}%
          </strong>
          <p>
            {assigned} of {controls.length} controls assigned
          </p>
        </article>
        <article className="panel visual-card wide">
          <span className="section-kicker">Recommended site view</span>
          <h2>Readiness by site</h2>
          <div className="site-placeholder">
            <span>⌂</span>
            <div>
              <strong>Add sites in Admin setup to compare performance</strong>
              <small>
                The production view will rank certification, evidence and
                overdue controls by site.
              </small>
            </div>
          </div>
          <div className="mini-recommendations">
            <span>Certification rate</span>
            <span>Overdue controls</span>
            <span>Evidence completeness</span>
            <span>Owner coverage</span>
          </div>
        </article>
        <article className="panel visual-card">
          <span className="section-kicker">Procedure readiness</span>
          <h2>DTP coverage</h2>
          <strong className="big-number">
            {Math.round((dtp / count) * 100)}%
          </strong>
          <p>{dtp} desktop procedures current</p>
        </article>
      </section>
    );
  return (
    <section className="report-visual-grid">
      <article className="panel visual-card wide">
        <span className="section-kicker">Execution readiness</span>
        <h2>Controller operating metrics</h2>
        <div className="coverage-bars">
          {[
            ["Owner coverage", assigned],
            ["DTP coverage", dtp],
            ["Certified", certified],
            [
              "Evidence rules set",
              controls.filter((c) => c.evidenceRequired).length,
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <i>
                <b style={{ width: `${(Number(value) / count) * 100}%` }} />
              </i>
              <strong>
                {value}/{controls.length}
              </strong>
            </div>
          ))}
        </div>
      </article>
      <article className="panel visual-card">
        <span className="section-kicker">Exception queue</span>
        <h2>Immediate attention</h2>
        <div className="exception-number">
          {
            controls.filter(
              (c) =>
                c.owner === "Unassigned" ||
                c.status === "Overdue" ||
                c.status === "Evidence needed",
            ).length
          }
        </div>
        <p>Unassigned, overdue or missing-evidence controls</p>
      </article>
      <article className="panel visual-card">
        <span className="section-kicker">Recommended next</span>
        <h2>Controller reporting</h2>
        <div className="rank-list">
          <div>
            <span>Aging of overdue items</span>
            <strong>Phase 1</strong>
          </div>
          <div>
            <span>Reminder effectiveness</span>
            <strong>Phase 1</strong>
          </div>
          <div>
            <span>Gap remediation trend</span>
            <strong>Phase 2</strong>
          </div>
        </div>
      </article>
    </section>
  );
}

function SiteOwnerDashboard({
  controls,
  scopeConfig,
}: {
  controls: InventoryControl[];
  scopeConfig: ScopeConfig;
}) {
  const mappedControls = controls.filter((control) => control.site);
  return (
    <section className="report-visual-grid">
      <article className="panel visual-card">
        <span className="section-kicker">Configured scope</span>
        <h2>Sites & factories</h2>
        <strong className="big-number">{scopeConfig.sites.length}</strong>
        <p>{mappedControls.length} controls mapped to a site</p>
      </article>
      <article className="panel visual-card wide">
        <span className="section-kicker">Site-owner view</span>
        <h2>Readiness by site</h2>
        {scopeConfig.sites.length ? (
          <div className="site-readiness-table">
            {scopeConfig.sites.map((site) => {
              const siteControls = controls.filter(
                (control) => control.site === site,
              );
              const siteCertified = siteControls.filter(
                (control) => control.status === "Certified",
              ).length;
              const exceptions = siteControls.filter(
                (control) =>
                  control.owner === "Unassigned" ||
                  control.status === "Overdue" ||
                  control.status === "Evidence needed",
              ).length;
              return (
                <div key={site}>
                  <span>
                    <strong>{site}</strong>
                    <small>{siteControls.length} controls in scope</small>
                  </span>
                  <span>
                    <strong>
                      {siteControls.length
                        ? Math.round(
                            (siteCertified / siteControls.length) * 100,
                          )
                        : 0}
                      %
                    </strong>
                    <small>certified</small>
                  </span>
                  <span>
                    <strong>{exceptions}</strong>
                    <small>exceptions</small>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="site-placeholder">
            <span>⌂</span>
            <div>
              <strong>Add sites in Admin setup to compare performance</strong>
              <small>
                Once controls are mapped to a site, this view calculates
                certification progress and exceptions for its owner.
              </small>
            </div>
          </div>
        )}
      </article>
      <article className="panel visual-card">
        <span className="section-kicker">How it works</span>
        <h2>Site-owner report</h2>
        <ol className="site-report-steps">
          <li>Configure the site.</li>
          <li>Map controls to that site.</li>
          <li>Monitor certification and exceptions.</li>
        </ol>
        <p>Use the Site / factory filter below to isolate one location.</p>
      </article>
    </section>
  );
}

function GapRemediation({
  gaps,
  controls,
  updateGaps,
  notify,
  appendAudit,
  period,
}: {
  gaps: RemediationGap[];
  controls: InventoryControl[];
  updateGaps: Dispatch<SetStateAction<RemediationGap[]>>;
  notify: (m: string) => void;
  appendAudit: (controlId: string, action: string, detail: string) => void;
  period: string;
}) {
  const [newGap, setNewGap] = useState({
    controlId: controls[0]?.id || "",
    title: "",
    description: "",
    severity: "Medium" as RemediationGap["severity"],
    owner: CURRENT_USER,
    due: "",
  });
  const addGap = () => {
    if (!newGap.controlId || !newGap.title.trim() || !newGap.due) {
      notify("Select a control, add a gap title and target date");
      return;
    }
    const gap: RemediationGap = {
      id: crypto.randomUUID(),
      ...newGap,
      title: newGap.title.trim(),
      description: newGap.description.trim(),
      period,
      status: "Open",
      closureEvidence: "",
      controllerApproved: false,
      createdAt: new Date().toISOString(),
    };
    updateGaps((current) => [gap, ...current]);
    appendAudit(gap.controlId, "Gap logged", gap.title);
    setNewGap({ ...newGap, title: "", description: "", due: "" });
    notify(`Gap logged for ${gap.controlId}`);
  };
  const updateGap = (id: string, updates: Partial<RemediationGap>) =>
    updateGaps((current) =>
      current.map((gap) => (gap.id === id ? { ...gap, ...updates } : gap)),
    );
  const openGaps = gaps.filter((gap) => gap.status !== "Closed");
  const overdue = openGaps.filter(
    (gap) => gap.due && new Date(gap.due) < new Date(),
  );
  return (
    <section className="workspace-view">
      <div className="admin-summary">
        <span>
          <strong>{openGaps.length}</strong> open gaps
        </span>
        <span>
          <strong>
            {
              openGaps.filter(
                (gap) =>
                  gap.severity === "High" || gap.severity === "Critical",
              ).length
            }
          </strong>{" "}
          high / critical
        </span>
        <span>
          <strong>{overdue.length}</strong> overdue
        </span>
      </div>
      <article className="panel setup-card gap-create">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Controller action</span>
            <h2>Log a remediation gap</h2>
          </div>
        </div>
        <div className="report-filters">
          <label>
            Control
            <select
              value={newGap.controlId}
              onChange={(e) =>
                setNewGap({ ...newGap, controlId: e.target.value })
              }
            >
              {controls.map((control) => (
                <option value={control.id} key={control.id}>
                  {controlCode(control)} · {control.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select
              value={newGap.severity}
              onChange={(e) =>
                setNewGap({
                  ...newGap,
                  severity: e.target.value as RemediationGap["severity"],
                })
              }
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </label>
          <label>
            Remediation owner
            <input
              value={newGap.owner}
              onChange={(e) => setNewGap({ ...newGap, owner: e.target.value })}
            />
          </label>
          <label>
            Target date
            <input
              type="date"
              value={newGap.due}
              onChange={(e) => setNewGap({ ...newGap, due: e.target.value })}
            />
          </label>
        </div>
        <label>
          Gap title
          <input
            value={newGap.title}
            onChange={(e) => setNewGap({ ...newGap, title: e.target.value })}
            placeholder="Describe the control exception"
          />
        </label>
        <label>
          Remediation action
          <textarea
            value={newGap.description}
            onChange={(e) =>
              setNewGap({ ...newGap, description: e.target.value })
            }
            placeholder="What needs to change, and what will good closure look like?"
          />
        </label>
        <button className="primary-small" onClick={addGap}>
          Create remediation
        </button>
      </article>
      <div className="gap-list">
        {gaps.map((gap) => (
          <article className="panel setup-card" key={gap.id}>
            <div className="panel-heading">
              <div>
                <span className="section-kicker">
                  {gap.controlId} · {gap.severity}
                </span>
                <h2>{gap.title}</h2>
              </div>
              <span className={`status ${gap.status === "Closed" ? "success" : "warning"}`}>
                {gap.status}
              </span>
            </div>
            <p>{gap.description || "Remediation detail to be confirmed."}</p>
            <div className="detail-grid">
              <div>
                <span>Owner</span>
                <strong>{gap.owner}</strong>
              </div>
              <div>
                <span>Target date</span>
                <strong>{gap.due}</strong>
              </div>
            </div>
            <div className="report-filters">
              <label>
                Status
                <select
                  value={gap.status}
                  onChange={(e) => {
                    const status = e.target.value as RemediationGap["status"];
                    if (
                      status === "Closed" &&
                      (!gap.closureEvidence || !gap.controllerApproved)
                    ) {
                      notify(
                        "Closure evidence and Controller approval are required",
                      );
                      return;
                    }
                    updateGap(gap.id, { status });
                    appendAudit(
                      gap.controlId,
                      "Gap status changed",
                      `${gap.title}: ${status}`,
                    );
                  }}
                >
                  <option>Open</option>
                  <option>In progress</option>
                  <option>Ready for closure</option>
                  <option>Closed</option>
                </select>
              </label>
              <label>
                Closure evidence reference
                <input
                  value={gap.closureEvidence}
                  onChange={(e) =>
                    updateGap(gap.id, { closureEvidence: e.target.value })
                  }
                  placeholder="File name, ticket or link"
                />
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={gap.controllerApproved}
                  onChange={(e) =>
                    updateGap(gap.id, {
                      controllerApproved: e.target.checked,
                    })
                  }
                />
                Controller closure approval
              </label>
            </div>
          </article>
        ))}
        {!gaps.length && (
          <div className="panel empty-state">
            <strong>No remediation gaps logged.</strong>
            <span>Use the form above when an exception requires action.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function AdminSetup({
  controls,
  setControls,
  updateControl,
  notify,
  openControl,
  setActiveNav,
  scopeConfig,
  setScopeConfig,
}: {
  controls: InventoryControl[];
  setControls: (v: InventoryControl[]) => void;
  updateControl: (id: string, updates: Partial<InventoryControl>) => void;
  notify: (m: string) => void;
  openControl: (c: InventoryControl) => void;
  setActiveNav: (n: Nav) => void;
  scopeConfig: ScopeConfig;
  setScopeConfig: (scope: ScopeConfig) => void;
}) {
  const [tab, setTab] = useState("Scope & structure");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [site, setSite] = useState("");
  const [reminderLog, setReminderLog] = useState("");
  const [importPreview, setImportPreview] = useState<{
    rows: Record<string, string>[];
    errors: string[];
  } | null>(null);
  const [newControl, setNewControl] = useState({
    id: "",
    name: "",
    process: "Manufacturing",
  });
  const addScope = (
    kind: keyof ScopeConfig,
    value: string,
    clear: () => void,
  ) => {
    const cleaned = value.trim();
    if (!cleaned) {
      notify(
        `Enter a ${kind === "sites" ? "unit or site" : kind === "countries" ? "country" : "region"}`,
      );
      return;
    }
    if (
      scopeConfig[kind].some(
        (item) => item.toLowerCase() === cleaned.toLowerCase(),
      )
    ) {
      notify(`${cleaned} is already configured`);
      return;
    }
    setScopeConfig({
      ...scopeConfig,
      [kind]: [...scopeConfig[kind], cleaned],
    });
    clear();
    notify(
      `${cleaned} added to ${kind === "sites" ? "units & sites" : kind}`,
    );
  };
  const removeScope = (kind: keyof ScopeConfig, value: string) => {
    setScopeConfig({
      ...scopeConfig,
      [kind]: scopeConfig[kind].filter((item) => item !== value),
    });
    if (kind === "sites") {
      setControls(
        controls.map((control) =>
          control.site === value ? { ...control, site: "" } : control,
        ),
      );
    }
    notify(`${value} removed`);
  };
  const downloadTemplate = async () => {
    const headers = [
      "Control Pillar",
      "Region",
      "Country",
      "Unit",
      "Control #",
      "Business Process",
      "Sub-Process",
      "Control Name",
      "Control Objective",
      "Risk Description",
      "Control Description",
      "Control Owner",
      "Control Frequency",
      "Key Control?",
      "Fraud Control?",
      "Preventive / Detective",
      "Control Type",
      "Attestation Frequency",
      "Evidence Needed (Y/N)",
      "Due Date",
    ];
    await writeXlsxFile(
      [
        headers.map((value) => ({ value, fontWeight: "bold" as const })),
        [
          "Sustainability Controls",
          "EU",
          "Netherlands",
          "OBL",
          "SUS.EN.01",
          "Greenhouse Gas Emissions",
          "Enablon",
          "Review of Completed Questionnaires in Enablon",
          "Questionnaires are complete, accurate and timely",
          "Incomplete data may lead to inaccurate emissions reporting",
          "Review source data, resolve discrepancies and retain evidence.",
          CURRENT_USER,
          "Periodic / Quarterly / Annual",
          "Y",
          "N",
          "Preventive",
          "Manual with IT Dependency",
          "Quarterly",
          "Y",
          "2026-07-31",
        ].map((value) => ({ value })),
      ],
      { fileName: "ICEbreaker-admin-upload-template.xlsx" },
    );
    notify("Excel mass-upload template downloaded");
  };
  const importWorkbook = async (file?: File) => {
    if (!file) return;
    const sheet = await readXlsxFile(file);
    const headers = (sheet.shift() || []).map((value) =>
      String(value || "").trim(),
    );
    const required = [
      "Control Pillar",
      "Region",
      "Country",
      "Unit",
      "Control #",
      "Control Name",
      "Business Process",
      "Sub-Process",
      "Control Frequency",
      "Attestation Frequency",
    ];
    const missing = required.filter((header) => !headers.includes(header));
    const rows = sheet
      .filter((row) => row.some((value) => value !== null && value !== ""))
      .map((row) =>
        headers.map((header, index) => {
          const value = row[index];
          return value instanceof Date
            ? value.toISOString().slice(0, 10)
            : String(value ?? "").trim();
        }),
      );
    const errors = missing.map((header) => `Missing column: ${header}`);
    const seen = new Set<string>();
    rows.forEach((cells, index) => {
      const controlNumber = cells[headers.indexOf("Control #")];
      const regionValue = cells[headers.indexOf("Region")];
      const countryValue = cells[headers.indexOf("Country")];
      const unitValue = cells[headers.indexOf("Unit")];
      const id = makeInstanceId(
        controlNumber,
        regionValue,
        countryValue,
        unitValue,
      );
      if (!controlNumber)
        errors.push(`Row ${index + 2}: Control # is required`);
      if (seen.has(id))
        errors.push(
          `Row ${index + 2}: duplicate control instance (${controlNumber}, ${countryValue}, ${unitValue})`,
        );
      seen.add(id);
      if (
        !controls.some((control) => control.id === id) &&
        (!cells[headers.indexOf("Control Name")] ||
          !cells[headers.indexOf("Sub-Process")] ||
          !cells[headers.indexOf("Control Frequency")])
      )
        errors.push(
          `Row ${index + 2}: new controls require name, sub-process and frequency`,
        );
    });
    setImportPreview({
      rows: rows.map((cells) =>
        Object.fromEntries(headers.map((header, index) => [header, cells[index]])),
      ),
      errors,
    });
    if (errors.length) {
      notify(`Excel checked · ${errors.length} issues to resolve`);
      return;
    }
    notify(`Excel checked · ${rows.length} rows ready to apply`);
  };
  const applyImport = () => {
    if (!importPreview || importPreview.errors.length) return;
    const imported = new Map(
      importPreview.rows.map((row) => [
        makeInstanceId(
          row["Control #"],
          row["Region"],
          row["Country"],
          row["Unit"],
        ),
        row,
      ]),
    );
    const importedRows = Array.from(imported.values());
    setScopeConfig({
      regions: Array.from(
        new Set([
          ...scopeConfig.regions,
          ...importedRows.map((row) => row["Region"]).filter(Boolean),
        ]),
      ),
      countries: Array.from(
        new Set([
          ...scopeConfig.countries,
          ...importedRows.map((row) => row["Country"]).filter(Boolean),
        ]),
      ),
      sites: Array.from(
        new Set([
          ...scopeConfig.sites,
          ...importedRows.map((row) => row["Unit"]).filter(Boolean),
        ]),
      ),
    });
    const yes = (value: string, fallback: boolean) =>
      value ? ["Y", "YES"].includes(value.toUpperCase()) : fallback;
    const fromRow = (
      row: Record<string, string>,
      current?: InventoryControl,
    ): InventoryControl => {
      const owner = row["Control Owner"] || current?.owner || "Unassigned";
      const attestationFrequency =
        row["Attestation Frequency"] ||
        current?.attestationFrequency ||
        "Quarterly";
      const controlNumber =
        row["Control #"] || current?.controlNumber || current?.id || "";
      const regionValue = row["Region"] || current?.region || "EU";
      const countryValue = row["Country"] || current?.country || "";
      const unitValue = row["Unit"] || current?.unit || "";
      return normalizeControl({
        ...(current || ({} as InventoryControl)),
        id: makeInstanceId(
          controlNumber,
          regionValue,
          countryValue,
          unitValue,
        ),
        controlNumber,
        pillar:
          row["Control Pillar"] === "Sustainability Controls"
            ? "Sustainability Controls"
            : row["Control Pillar"] === "Operating Controls"
              ? "Operating Controls"
              : current?.pillar || "ICE Controls",
        name: row["Control Name"] || current?.name || controlNumber,
        businessProcess:
          row["Business Process"] || current?.businessProcess || "Other",
        process: row["Sub-Process"] || current?.process || "Other",
        objective: row["Control Objective"] || current?.objective || "",
        riskDescription:
          row["Risk Description"] || current?.riskDescription || "",
        description:
          row["Control Description"] || current?.description || "",
        instructions:
          row["Control Description"] || current?.instructions || "",
        frequency:
          row["Control Frequency"] || current?.frequency || "Periodic",
        attestationFrequency,
        type: row["Control Type"] || current?.type || "Manual",
        nature:
          row["Preventive / Detective"] === "Detective"
            ? "Detective"
            : current?.nature || "Preventive",
        keyControl: yes(row["Key Control?"], current?.keyControl || false),
        fraudControl: yes(
          row["Fraud Control?"],
          current?.fraudControl || false,
        ),
        applicable: current?.applicable ?? true,
        evidenceRequired: yes(
          row["Evidence Needed (Y/N)"],
          current?.evidenceRequired ?? true,
        ),
        owner,
        status:
          owner === "Unassigned"
            ? "Unassigned"
            : current?.status === "Certified"
              ? "Certified"
              : "Acknowledgement pending",
        due:
          row["Due Date"] ||
          current?.due ||
          dueForFrequency(attestationFrequency),
        region: regionValue,
        country: countryValue,
        unit: unitValue,
        site: unitValue,
        dtpStatus: current?.dtpStatus || "Not added",
        dtpSummary: current?.dtpSummary || "",
        dtpOwner: current?.dtpOwner || owner,
        dtpVersion: current?.dtpVersion || "",
        dtpLastReviewed: current?.dtpLastReviewed || "",
        dtpNextReview: current?.dtpNextReview || "",
        dtpDocument: current?.dtpDocument || "",
        dtpHistory: current?.dtpHistory || [],
      });
    };
    const existing = controls.map((control) => {
      const row = imported.get(control.id);
      if (!row) return control;
      imported.delete(control.id);
      return fromRow(row, control);
    });
    const added = Array.from(imported.values()).map((row) => fromRow(row));
    setControls([...existing, ...added]);
    setImportPreview(null);
    notify(
      `${importPreview.rows.length} control instances applied without replacing history`,
    );
  };
  const assigned = controls.filter((c) => c.owner !== "Unassigned").length;
  const addControl = () => {
    const controlNumber = newControl.id.trim().toUpperCase();
    const id = makeInstanceId(controlNumber, "EU", "Netherlands", "OBL");
    const name = newControl.name.trim();
    if (!controlNumber || !name) {
      notify("Control ID and name are required");
      return;
    }
    if (controls.some((control) => control.id === id)) {
      notify(`${id} already exists`);
      return;
    }
    setControls([
      ...controls,
      normalizeControl({
        id,
        controlNumber,
        pillar: "ICE Controls",
        name,
        businessProcess: "Inventory",
        process: newControl.process.trim() || "Inventory",
        objective: "",
        riskDescription: "",
        description: "",
        frequency: "Periodic",
        attestationFrequency: "Quarterly",
        keyControl: false,
        fraudControl: false,
        nature: "Preventive",
        type: "Manual",
        evidenceRequired: true,
        owner: "Unassigned",
        status: "Unassigned",
        due: "2026-07-31",
        dtpStatus: "Not added",
        region: "EU",
        country: "Netherlands",
        site: "OBL",
        unit: "OBL",
        instructions: "",
        applicable: true,
        dtpSummary: "",
        dtpOwner: "Controller Admin",
        dtpVersion: "",
        dtpLastReviewed: "",
        dtpNextReview: "",
        dtpDocument: "",
        dtpHistory: [],
      }),
    ]);
    setNewControl({ id: "", name: "", process: "Manufacturing" });
    notify(`${controlNumber} added to the OBL control library`);
  };
  return (
    <section className="workspace-view">
      <div className="admin-tabs">
        {[
          "Scope & structure",
          "Control requirements",
          "Ownership",
          "Reminders",
        ].map((item) => (
          <button
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Scope & structure" && (
        <div className="admin-grid">
          <article className="panel setup-card">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Organization</span>
                <h2>Regions and sites</h2>
              </div>
              <span className="draft-badge">Admin managed</span>
            </div>
            <div className="fixed-scope">
              <span>Business segment</span>
              <strong>Food & Nutrition</strong>
              <small>Fixed for this application</small>
            </div>
            <div className="scope-group-label">Regions</div>
            <div className="scope-tags">
              {scopeConfig.regions.map((item) => (
                <span key={item}>
                  {item}
                  <button
                    aria-label={`Remove region ${item}`}
                    onClick={() => removeScope("regions", item)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="scope-group-label">Countries</div>
            <div className="scope-tags">
              {scopeConfig.countries.map((item) => (
                <span key={item}>
                  {item}
                  <button
                    aria-label={`Remove country ${item}`}
                    onClick={() => removeScope("countries", item)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="scope-group-label">Units & sites</div>
            <div className="scope-tags site-tags">
              {scopeConfig.sites.length ? (
                scopeConfig.sites.map((item) => (
                  <span key={item}>
                    {item}
                    <button
                      aria-label={`Remove site ${item}`}
                      onClick={() => removeScope("sites", item)}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <small>No sites configured yet</small>
              )}
            </div>
            <div className="scope-form">
              <label>
                Region
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Europe"
                />
              </label>
              <button
                onClick={() => addScope("regions", region, () => setRegion(""))}
              >
                Add
              </button>
              <label>
                Country
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Netherlands"
                />
              </label>
              <button
                onClick={() =>
                  addScope("countries", country, () => setCountry(""))
                }
              >
                Add
              </button>
              <label>
                Unit / site
                <input
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder="e.g. OBL"
                />
              </label>
              <button
                onClick={() => addScope("sites", site, () => setSite(""))}
              >
                Add
              </button>
            </div>
          </article>
          <article className="panel setup-card">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Mass setup</span>
                <h2>Upload controls & ownership</h2>
              </div>
            </div>
            <label className="upload-zone file-card">
              <span>⇧</span>
              <strong>Choose a completed Excel template</strong>
              <small>
                Controls, applicability, Control Owners and due-date rules
              </small>
              <b>Choose file</b>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => importWorkbook(e.target.files?.[0])}
              />
            </label>
            <button className="template-link" onClick={downloadTemplate}>
              ⇩ Download mass-upload template
            </button>
            {importPreview && (
              <div className="import-preview">
                <strong>
                  {importPreview.rows.length} rows checked ·{" "}
                  {importPreview.errors.length
                    ? `${importPreview.errors.length} issues`
                    : "ready to apply"}
                </strong>
                {importPreview.errors.map((error) => (
                  <small key={error}>{error}</small>
                ))}
                <button
                  className="primary-small"
                  disabled={Boolean(importPreview.errors.length)}
                  onClick={applyImport}
                >
                  Apply validated import
                </button>
              </div>
            )}
          </article>
        </div>
      )}
      {tab === "Control requirements" && (
        <>
          <div className="admin-summary">
            <span>
              <strong>{controls.length}</strong> controls loaded
            </span>
            <span>
              <strong>
                {controls.filter((c) => c.evidenceRequired).length}
              </strong>{" "}
              evidence required
            </span>
            <span>
              <strong>
                {controls.filter((c) => c.dtpStatus === "Current").length}
              </strong>{" "}
              DTPs current
            </span>
          </div>
          <article className="panel requirement-list">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Admin editable</span>
                <h2>Evidence, instructions & DTP</h2>
              </div>
              <button className="primary-small" onClick={addControl}>
                Add control
              </button>
            </div>
            <div className="report-filters new-control-form">
              <label>
                Control ID
                <input
                  value={newControl.id}
                  onChange={(e) =>
                    setNewControl({ ...newControl, id: e.target.value })
                  }
                  placeholder="INV.XX.01"
                />
              </label>
              <label>
                Control name
                <input
                  value={newControl.name}
                  onChange={(e) =>
                    setNewControl({ ...newControl, name: e.target.value })
                  }
                  placeholder="Control requirement"
                />
              </label>
              <label>
                Sub-process
                <input
                  value={newControl.process}
                  onChange={(e) =>
                    setNewControl({ ...newControl, process: e.target.value })
                  }
                />
              </label>
            </div>
            {controls.slice(0, 10).map((control) => (
              <div className="requirement-row" key={control.id}>
                <button onClick={() => openControl(control)}>
                  <span>{control.id}</span>
                  <strong>{control.name}</strong>
                  <small>{control.process}</small>
                </button>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={control.evidenceRequired}
                    onChange={(e) =>
                      updateControl(control.id, {
                        evidenceRequired: e.target.checked,
                      })
                    }
                  />
                  <span />
                  Evidence required
                </label>
                <button
                  className="manage-button"
                  onClick={() => openControl(control)}
                >
                  Manage guidance
                </button>
                <button
                  className="manage-button danger-link"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${control.id} from the control library?`,
                      )
                    ) {
                      setControls(
                        controls.filter((item) => item.id !== control.id),
                      );
                      notify(`${control.id} removed`);
                    }
                  }}
                >
                  Remove
                </button>
                <span
                  className={`dtp-badge ${control.dtpStatus === "Current" ? "current" : "needs"}`}
                >
                  {control.dtpStatus}
                </span>
              </div>
            ))}
          </article>
        </>
      )}
      {tab === "Ownership" && (
        <div className="admin-grid">
          <article className="panel setup-card">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Assignment health</span>
                <h2>Control Owner coverage</h2>
              </div>
            </div>
            <div className="ownership-chart">
              <div>
                <span>Assigned</span>
                <strong>{assigned}</strong>
                <i
                  style={{ width: `${(assigned / controls.length) * 100}%` }}
                />
              </div>
              <div>
                <span>Certified</span>
                <strong>
                  {controls.filter((c) => c.status === "Certified").length}
                </strong>
                <i
                  style={{
                    width: `${(controls.filter((c) => c.status === "Certified").length / controls.length) * 100}%`,
                  }}
                />
              </div>
              <div>
                <span>Unassigned</span>
                <strong>{controls.length - assigned}</strong>
                <i
                  style={{
                    width: `${((controls.length - assigned) / controls.length) * 100}%`,
                  }}
                />
              </div>
            </div>
            <button
              className="wide-secondary"
              onClick={() => setActiveNav("Reports")}
            >
              Open ownership gap report
            </button>
          </article>
          <article className="panel setup-card">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Quick assignment</span>
                <h2>Unassigned controls</h2>
              </div>
            </div>
            {controls
              .filter((c) => c.owner === "Unassigned")
              .slice(0, 5)
              .map((control) => (
                <div className="change-row" key={control.id}>
                  <span>{control.id}</span>
                  <strong>{control.name}</strong>
                  <button onClick={() => openControl(control)}>Assign →</button>
                </div>
              ))}
          </article>
        </div>
      )}
      {tab === "Reminders" && (
        <div className="admin-grid">
          <article className="panel setup-card">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Simulation</span>
                <h2>Reminder sequence</h2>
              </div>
              <span className="draft-badge">MVP workflow</span>
            </div>
            {[
              ["7 days before", "Friendly heads-up"],
              ["3 days before", "Action reminder"],
              ["On due date", "Due today"],
              ["1 day overdue", "Owner + Controller Admin"],
            ].map(([timing, label], index) => (
              <div className="reminder-rule" key={timing}>
                <span>{index + 1}</span>
                <div>
                  <strong>{label}</strong>
                  <small>{timing} · Includes direct ICEbreaker link</small>
                </div>
                <label className="toggle-label">
                  <input type="checkbox" defaultChecked />
                  <span />
                </label>
              </div>
            ))}
            <button
              className="wide-secondary"
              onClick={() => {
                const entry = `Simulated reminder preview generated at ${new Date().toLocaleTimeString()}`;
                setReminderLog(entry);
                notify(entry);
              }}
            >
              Generate simulated email preview
            </button>
          </article>
          <article className="panel email-preview">
            <div className="email-head">
              <span>M</span>
              <div>
                <strong>ICEbreaker reminder</strong>
                <small>To: Assigned Control Owner</small>
              </div>
            </div>
            <p>Your control certification is approaching its due date.</p>
            <div>
              <strong>Open ICEbreaker to review the requirement</strong>
              <small>Ownership · Instructions · Evidence · Certification</small>
            </div>
            <button onClick={() => notify("Preview link validated")}>
              Open control link
            </button>
            <small>
              {reminderLog ||
                "Generate a preview to record a simulated reminder."}
            </small>
            <div className="email-scope-note">
              <strong>MVP behavior: no email is sent.</strong>
              <small>
                This public build creates an on-screen preview only. The
                enterprise target uses Microsoft SSO identity and governed
                delivery through Microsoft Graph after GCP deployment.
              </small>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function ControlDrawer({
  control,
  role,
  period,
  attachments,
  previousEvidence,
  close,
  updateControl,
  addAttachment,
  notify,
  changeRole,
  scopeConfig,
  ownershipChanges,
  setOwnershipChanges,
  gaps,
  setGaps,
  appendAudit,
}: {
  control: InventoryControl;
  role: Role;
  period: string;
  attachments: string[];
  previousEvidence: Array<{ period: string; file: string }>;
  close: () => void;
  updateControl: (id: string, updates: Partial<InventoryControl>) => void;
  addAttachment: (name: string) => void;
  notify: (m: string) => void;
  changeRole: (r: Role) => void;
  scopeConfig: ScopeConfig;
  ownershipChanges: OwnershipChange[];
  setOwnershipChanges: Dispatch<SetStateAction<OwnershipChange[]>>;
  gaps: RemediationGap[];
  setGaps: Dispatch<SetStateAction<RemediationGap[]>>;
  appendAudit: (controlId: string, action: string, detail: string) => void;
}) {
  const [accepted, setAccepted] = useState(control.accepted || false);
  const [understood, setUnderstood] = useState(control.understood || false);
  const [acknowledgedAt, setAcknowledgedAt] = useState(
    control.acknowledgedAt || "",
  );
  const [acknowledgementSaved, setAcknowledgementSaved] = useState(
    Boolean(control.accepted && control.understood && control.acknowledgedAt),
  );
  const [executionOutcome, setExecutionOutcome] = useState<ExecutionOutcome>(
    control.executionOutcome || "Not recorded",
  );
  const [deviationNotes, setDeviationNotes] = useState(
    control.deviationNotes || "",
  );
  const [documentationReviewed, setDocumentationReviewed] = useState(
    control.documentationReviewed || false,
  );
  const [dtpOpened, setDtpOpened] = useState(false);
  const [progressSaved, setProgressSaved] = useState(
    Boolean(control.draftSavedAt),
  );
  const [draft, setDraft] = useState(control);
  const [showReassign, setShowReassign] = useState(false);
  const [newOwner, setNewOwner] = useState("");
  const [handover, setHandover] = useState(false);
  const [training, setTraining] = useState(false);
  const [requestModal, setRequestModal] = useState<
    "gap" | "guidance" | null
  >(null);
  const [gapRequest, setGapRequest] = useState({
    title: "",
    description: "",
    severity: "Medium" as RemediationGap["severity"],
    owner: draft.owner === "Unassigned" ? CURRENT_USER : draft.owner,
    due: "",
  });
  const [guidanceRequest, setGuidanceRequest] = useState({
    topic: "Procedure or DTP",
    urgency: "Standard",
    question: "",
  });
  const saveAdmin = () => {
    const status: ControlStatus =
      draft.owner === "Unassigned"
        ? "Unassigned"
        : draft.status === "Unassigned"
          ? "Acknowledgement pending"
          : draft.status;
    updateControl(control.id, { ...draft, status });
    appendAudit(
      control.id,
      "Control requirements updated",
      "Ownership, execution rules or guidance changed",
    );
    notify(`${controlCode(control)} requirements saved`);
  };
  const reassign = () => {
    if (!newOwner.trim() || !handover || !training) {
      notify("New owner, handover and training confirmation are required");
      return;
    }
    const change: OwnershipChange = {
      id: crypto.randomUUID(),
      controlId: control.id,
      period,
      fromOwner: draft.owner,
      toOwner: newOwner.trim(),
      requestedBy: CURRENT_USER,
      changedAt: new Date().toISOString(),
      handoverConfirmed: handover,
      trainingConfirmed: training,
    };
    setOwnershipChanges((current) => [change, ...current]);
    updateControl(control.id, {
      owner: change.toOwner,
      status: "Acknowledgement pending",
      accepted: false,
      understood: false,
      acknowledgedAt: undefined,
      performed: false,
      executionOutcome: "Not recorded",
      deviationNotes: "",
      draftSavedAt: undefined,
      documentationReviewed: false,
      documentationReviewedAt: undefined,
    });
    appendAudit(
      control.id,
      "Ownership reassigned",
      `${change.fromOwner} to ${change.toOwner}; handover and training confirmed`,
    );
    notify(`${controlCode(control)} reassigned to ${change.toOwner}`);
    close();
  };
  const saveAcknowledgement = () => {
    if (!accepted || !understood) {
      notify("Confirm ownership and understanding before acknowledging");
      return;
    }
    const timestamp = new Date().toISOString();
    updateControl(control.id, {
      accepted: true,
      understood: true,
      acknowledgedAt: timestamp,
    });
    setAcknowledgedAt(timestamp);
    setAcknowledgementSaved(true);
    appendAudit(
      control.id,
      "Ownership acknowledged",
      "Control Owner accepted accountability and confirmed understanding",
    );
    notify(`${controlCode(control)} ownership acknowledgement saved`);
  };
  const saveProgress = () => {
    if (
      executionOutcome === "Performed with deviations" &&
      !deviationNotes.trim()
    ) {
      notify("Describe the deviation before saving progress");
      return;
    }
    const timestamp = new Date().toISOString();
    const performedNow =
      executionOutcome === "Performed as documented" ||
      executionOutcome === "Performed with deviations";
    updateControl(control.id, {
      accepted,
      understood,
      acknowledgedAt: acknowledgedAt || undefined,
      performed: performedNow,
      executionOutcome,
      deviationNotes: deviationNotes.trim(),
      documentationReviewed,
      documentationReviewedAt: documentationReviewed ? timestamp : undefined,
      draftSavedAt: timestamp,
    });
    setProgressSaved(true);
    if (
      executionOutcome === "Performed with deviations" &&
      !gaps.some(
        (gap) =>
          gap.controlId === control.id &&
          gap.period === period &&
          gap.status !== "Closed",
      )
    ) {
      setGaps((current) => [
        {
          id: crypto.randomUUID(),
          controlId: control.id,
          period,
          title: "Execution deviated from the DTP",
          description: deviationNotes.trim(),
          severity: "Medium",
          owner: draft.owner === "Unassigned" ? CURRENT_USER : draft.owner,
          due: draft.due,
          status: "Open",
          closureEvidence: "",
          controllerApproved: false,
          createdAt: timestamp,
        },
        ...current,
      ]);
    }
    appendAudit(
      control.id,
      "Control progress saved",
      `${executionOutcome}; evidence files: ${attachments.length}`,
    );
    notify(`${controlCode(control)} progress saved for Controller visibility`);
  };
  const saveDtp = () => {
    const changedVersion =
      Boolean(control.dtpDocument || control.dtpVersion) &&
      (control.dtpDocument !== draft.dtpDocument ||
        control.dtpVersion !== draft.dtpVersion);
    const dtpHistory = changedVersion
      ? [
          {
            document: control.dtpDocument || "Inline procedure",
            version: control.dtpVersion || "Unversioned",
            owner: control.dtpOwner || "Unassigned",
            reviewedAt: control.dtpLastReviewed || "Not recorded",
          },
          ...control.dtpHistory,
        ]
      : control.dtpHistory;
    updateControl(control.id, {
      dtpSummary: draft.dtpSummary,
      dtpOwner: draft.dtpOwner,
      dtpVersion: draft.dtpVersion,
      dtpLastReviewed: draft.dtpLastReviewed,
      dtpNextReview: draft.dtpNextReview,
      dtpDocument: draft.dtpDocument,
      dtpStatus: draft.dtpStatus,
      dtpHistory,
    });
    appendAudit(
      control.id,
      "DTP guidance updated",
      `${draft.dtpDocument || "Inline procedure"} · ${draft.dtpVersion || "No version"}`,
    );
    setDraft({ ...draft, dtpHistory });
    notify(`${controlCode(control)} DTP guidance saved`);
  };
  const submitGap = () => {
    if (!gapRequest.title.trim() || !gapRequest.description.trim()) {
      notify("Add a gap title and remediation detail");
      return;
    }
    setGaps((current) => [
      {
        id: crypto.randomUUID(),
        controlId: control.id,
        period,
        title: gapRequest.title.trim(),
        description: gapRequest.description.trim(),
        severity: gapRequest.severity,
        owner: gapRequest.owner.trim() || CURRENT_USER,
        due: gapRequest.due,
        status: "Open",
        closureEvidence: "",
        controllerApproved: false,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    appendAudit(
      control.id,
      "Gap logged",
      `${gapRequest.severity}: ${gapRequest.title.trim()}`,
    );
    setRequestModal(null);
    setGapRequest({
      ...gapRequest,
      title: "",
      description: "",
      due: "",
    });
    notify(`Gap submitted · now visible in Gap remediation`);
  };
  const submitGuidance = () => {
    if (!guidanceRequest.question.trim()) {
      notify("Describe the guidance you need");
      return;
    }
    appendAudit(
      control.id,
      "Guidance requested",
      `${guidanceRequest.topic} · ${guidanceRequest.urgency}: ${guidanceRequest.question.trim()}`,
    );
    setRequestModal(null);
    setGuidanceRequest({ ...guidanceRequest, question: "" });
    notify("Guidance request submitted to the Controller team");
  };
  return (
    <>
      <button
        className="drawer-scrim"
        onClick={close}
        aria-label="Close control details"
      />
      <aside className="control-drawer" aria-label="Control detail panel">
        <div className="drawer-header">
          <span className={`status ${statusClass[draft.status]}`}>
            <i />
            {draft.status}
          </span>
          <button onClick={close}>×</button>
        </div>
        <div className="drawer-body">
          <span className="control-id">
            {controlCode(draft)} · {draft.country} · {draft.unit}
            {draft.keyControl && <b>Key control</b>}
          </span>
          <h2>{draft.name}</h2>
          <p className="drawer-intro">
            {role === "Controller Admin"
              ? "Configure ownership, timing, evidence rules and guidance for this control."
              : "Accept ownership, follow the documented procedure and certify completion."}
          </p>
          <div className="detail-grid">
            <div>
              <span>Sub-process</span>
              <strong>{draft.process}</strong>
            </div>
            <div>
              <span>Frequency</span>
              <strong>{draft.frequency}</strong>
            </div>
            <div>
              <span>Evidence</span>
              <strong>
                {draft.evidenceRequired ? "Required" : "Certification only"}
              </strong>
            </div>
            <div>
              <span>Control type</span>
              <strong>{draft.type}</strong>
            </div>
            <div>
              <span>Open gaps</span>
              <strong>
                {
                  gaps.filter(
                    (gap) =>
                      gap.controlId === draft.id && gap.status !== "Closed",
                  ).length
                }
              </strong>
            </div>
          </div>
          {role === "Controller Admin" ? (
            <>
              <section className="drawer-section admin-editor">
                <div>
                  <span className="section-kicker">Controller Admin</span>
                  <h3>Control requirements</h3>
                </div>
                <div className="admin-meta-grid">
                  <label>
                    Control pillar
                    <select
                      value={draft.pillar}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          pillar: e.target.value as InventoryControl["pillar"],
                        })
                      }
                    >
                      <option>ICE Controls</option>
                      <option>Sustainability Controls</option>
                      <option>Operating Controls</option>
                    </select>
                  </label>
                  <label>
                    Country
                    <select
                      value={draft.country}
                      onChange={(e) =>
                        setDraft({ ...draft, country: e.target.value })
                      }
                    >
                      {scopeConfig.countries.map((country) => (
                        <option key={country}>{country}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Business process
                    <input
                      value={draft.businessProcess}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          businessProcess: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Sub-process
                    <input
                      value={draft.process}
                      onChange={(e) =>
                        setDraft({ ...draft, process: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Control frequency
                    <input
                      value={draft.frequency}
                      onChange={(e) =>
                        setDraft({ ...draft, frequency: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Attestation frequency
                    <input
                      value={draft.attestationFrequency}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          attestationFrequency: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="admin-check-grid">
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={draft.keyControl}
                      onChange={(e) =>
                        setDraft({ ...draft, keyControl: e.target.checked })
                      }
                    />
                    Key control
                  </label>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={draft.fraudControl}
                      onChange={(e) =>
                        setDraft({ ...draft, fraudControl: e.target.checked })
                      }
                    />
                    Fraud control
                  </label>
                </div>
                <label>
                  Control Owner
                  <select
                    value={draft.owner}
                    onChange={(e) =>
                      setDraft({ ...draft, owner: e.target.value })
                    }
                  >
                    <option value="Unassigned">Unassigned</option>
                    {Array.from(
                      new Set([
                        ...DEMO_OWNERS,
                        ...(draft.owner !== "Unassigned" ? [draft.owner] : []),
                      ]),
                    ).map((owner) => (
                      <option key={owner}>{owner}</option>
                    ))}
                  </select>
                  <small className="field-note">
                    Prototype directory only. Demo Account is the only
                    assignable user until enterprise identity is connected.
                  </small>
                </label>
                <label>
                  Unit / site
                  <select
                    value={draft.site}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        site: e.target.value,
                        unit: e.target.value,
                      })
                    }
                  >
                    <option value="">Not mapped to a unit</option>
                    {scopeConfig.sites.map((site) => (
                      <option key={site}>{site}</option>
                    ))}
                  </select>
                  <small className="field-note">
                    Drives unit reporting and the organization filters.
                  </small>
                </label>
                <label>
                  Due date
                  <input
                    value={draft.due === "Not scheduled" ? "" : draft.due}
                    type="date"
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        due: e.target.value || "Not scheduled",
                      })
                    }
                  />
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.evidenceRequired}
                    onChange={(e) =>
                      setDraft({ ...draft, evidenceRequired: e.target.checked })
                    }
                  />{" "}
                  Evidence required
                </label>
                <label>
                  Execution instructions
                  <textarea
                    value={draft.instructions}
                    placeholder="Add requirements, examples and what good looks like"
                    onChange={(e) =>
                      setDraft({ ...draft, instructions: e.target.value })
                    }
                  />
                </label>
                <details className="admin-detail-fields">
                  <summary>Edit objective, risk and control description</summary>
                  <label>
                    Control objective
                    <textarea
                      value={draft.objective}
                      onChange={(e) =>
                        setDraft({ ...draft, objective: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Risk description
                    <textarea
                      value={draft.riskDescription}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          riskDescription: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Control description
                    <textarea
                      value={draft.description}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                    />
                  </label>
                </details>
                <button onClick={saveAdmin}>Save control requirements</button>
              </section>
              <section className="drawer-section dtp-editor">
                <div className="dtp-heading">
                  <span className="section-kicker">Desktop procedure</span>
                  <h3>DTP guidance · Controller override</h3>
                  <p>
                    Capture the working steps here and attach the detailed
                    procedure when one exists. Control Owners see both in their
                    review experience.
                  </p>
                </div>
                <label className="dtp-procedure-field">
                  <span>Procedure steps</span>
                  <textarea
                    value={draft.dtpSummary}
                    rows={7}
                    placeholder={
                      "1. Run the inventory report for the review period.\n2. Compare exceptions to the documented threshold.\n3. Investigate variances and retain the final approved report."
                    }
                    onChange={(e) =>
                      setDraft({ ...draft, dtpSummary: e.target.value })
                    }
                  />
                  <small>
                    Add enough detail for a new owner to understand the
                    sequence. Use numbered steps, checks and escalation points.
                  </small>
                </label>
                <div className="dtp-meta-grid">
                  <label>
                    Version
                    <input
                      value={draft.dtpVersion}
                      onChange={(e) =>
                        setDraft({ ...draft, dtpVersion: e.target.value })
                      }
                      placeholder="e.g. 1.0"
                    />
                  </label>
                  <label>
                    Procedure owner
                    <input
                      value={draft.dtpOwner}
                      onChange={(e) =>
                        setDraft({ ...draft, dtpOwner: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Last reviewed
                    <input
                      type="date"
                      value={draft.dtpLastReviewed}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          dtpLastReviewed: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Next review
                    <input
                      type="date"
                      value={draft.dtpNextReview}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          dtpNextReview: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label className="guidance-card file-card dtp-upload">
                  <span>▤</span>
                  <span>
                    <strong>
                      {draft.dtpStatus === "Not added"
                        ? "Add a desktop procedure"
                        : draft.dtpDocument || `${draft.process} desktop procedure`}
                    </strong>
                    <small>
                      {draft.dtpStatus} · Upload or replace local guidance
                    </small>
                  </span>
                  <b>+</b>
                  <input
                    type="file"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setDraft({
                          ...draft,
                          dtpStatus: "Current",
                          dtpDocument: e.target.files[0].name,
                        });
                        notify(`${e.target.files[0].name} attached`);
                      }
                    }}
                  />
                </label>
                <div className="dtp-actions">
                  <button className="primary-button" onClick={saveDtp}>
                    Save DTP guidance
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        dtpStatus: "Current",
                        dtpLastReviewed: new Date()
                          .toISOString()
                          .slice(0, 10),
                      })
                    }
                  >
                    Confirm current
                  </button>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="drawer-section">
                <div>
                  <span className="section-kicker">Required confirmations</span>
                  <h3>Control Owner acknowledgement</h3>
                </div>
                <p className="acknowledgement-intro">
                  Save this step now to record acceptance and understanding.
                  You can close the control and return later to perform and
                  certify it.
                </p>
                <label className="check-card">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => {
                      setAccepted(e.target.checked);
                      setAcknowledgementSaved(false);
                    }}
                  />
                  <span>
                    <strong>I confirm and accept ownership</strong>
                    <small>
                      I am accountable for this control for the period.
                    </small>
                  </span>
                </label>
                <label className="check-card">
                  <input
                    type="checkbox"
                    checked={understood}
                    onChange={(e) => {
                      setUnderstood(e.target.checked);
                      setAcknowledgementSaved(false);
                    }}
                  />
                  <span>
                    <strong>I understand the requirement</strong>
                    <small>
                      I reviewed the instructions and desktop procedure.
                    </small>
                  </span>
                </label>
                <div className="acknowledgement-actions">
                  <button
                    className="primary-button"
                    disabled={
                      !accepted || !understood || acknowledgementSaved
                    }
                    onClick={saveAcknowledgement}
                  >
                    {acknowledgementSaved
                      ? "Acknowledgement saved"
                      : "Acknowledge & save"}
                  </button>
                  {acknowledgementSaved && acknowledgedAt && (
                    <span className="acknowledgement-saved">
                      ✓ Recorded {new Date(acknowledgedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </section>
              <section className="drawer-section">
                <div>
                  <span className="section-kicker">Documentation</span>
                  <h3>Procedure & evidence</h3>
                </div>
                <div className="guidance-card">
                  <span>▤</span>
                  <span>
                    <strong>
                      {draft.dtpStatus === "Current"
                        ? draft.dtpDocument || "Desktop procedure available"
                        : "Desktop procedure not yet available"}
                    </strong>
                    <small>
                      {draft.dtpStatus}
                      {draft.dtpVersion ? ` · Version ${draft.dtpVersion}` : ""}
                      {draft.dtpLastReviewed
                        ? ` · Reviewed ${draft.dtpLastReviewed}`
                        : ""}
                    </small>
                  </span>
                </div>
                {draft.dtpStatus === "Current" && (
                  <button
                    className="secondary-button dtp-open-button"
                    onClick={() => {
                      setDtpOpened(true);
                      notify(
                        `${draft.dtpDocument || "Inline procedure"} opened in the prototype`,
                      );
                    }}
                  >
                    Open desktop procedure
                  </button>
                )}
                {draft.dtpSummary && (
                  <p className="field-note">{draft.dtpSummary}</p>
                )}
                {draft.instructions && (
                  <div className="fixed-scope">
                    <span>Execution instructions</span>
                    <strong>{draft.instructions}</strong>
                  </div>
                )}
                <label className="guidance-card file-card">
                  <span>▱</span>
                  <span>
                    <strong>
                      {draft.evidenceRequired
                        ? "Upload execution evidence"
                        : "Evidence is optional"}
                    </strong>
                    <small>
                      {attachments.length
                        ? attachments.join(", ")
                        : "No evidence attached"}
                    </small>
                  </span>
                  <b>+</b>
                  <input
                    type="file"
                    disabled={!draft.evidenceRequired}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        addAttachment(e.target.files[0].name);
                        notify(`${e.target.files[0].name} added as evidence`);
                      }
                    }}
                  />
                </label>
                {previousEvidence.length > 0 && (
                  <details className="previous-evidence">
                    <summary>
                      Previous-period evidence ({previousEvidence.length})
                    </summary>
                    {previousEvidence.slice(0, 8).map((item, index) => (
                      <span key={`${item.period}-${item.file}-${index}`}>
                        <strong>{item.file}</strong>
                        <small>{item.period}</small>
                      </span>
                    ))}
                  </details>
                )}
                {draft.dtpStatus === "Current" && (
                  <label className="check-card documentation-check">
                    <input
                      type="checkbox"
                      checked={documentationReviewed}
                      disabled={!dtpOpened && !control.documentationReviewed}
                      onChange={(e) => {
                        setDocumentationReviewed(e.target.checked);
                        setProgressSaved(false);
                      }}
                    />
                    <span>
                      <strong>I reviewed the current desktop procedure</strong>
                      <small>
                        Open the procedure above before recording this
                        confirmation.
                      </small>
                    </span>
                  </label>
                )}
                <div className="execution-confirmation">
                  <span className="section-kicker">Execution confirmation</span>
                  <label className="outcome-field">
                    Execution outcome
                    <select
                      value={executionOutcome}
                      onChange={(e) => {
                        setExecutionOutcome(e.target.value as ExecutionOutcome);
                        setProgressSaved(false);
                      }}
                    >
                      <option>Not recorded</option>
                      <option>Performed as documented</option>
                      <option>Performed with deviations</option>
                      <option>Not performed</option>
                    </select>
                  </label>
                  {executionOutcome === "Performed with deviations" && (
                    <label className="outcome-field">
                      Describe the deviation and immediate action
                      <textarea
                        rows={4}
                        value={deviationNotes}
                        onChange={(e) => {
                          setDeviationNotes(e.target.value);
                          setProgressSaved(false);
                        }}
                        placeholder="What differed from the procedure, what is the impact, and what action was taken?"
                      />
                    </label>
                  )}
                  <p className="field-note">
                    Saving progress makes the outcome visible to Controllers.
                    A deviation also creates an open remediation gap.
                  </p>
                  <button
                    className="secondary-button save-progress"
                    onClick={saveProgress}
                  >
                    {progressSaved
                      ? "Execution progress saved"
                      : "Save execution progress"}
                  </button>
                </div>
                <details className="owner-dtp-maintenance">
                  <summary>Propose a DTP update</summary>
                  <p>
                    Control Owners can maintain working guidance. Each saved
                    replacement preserves the prior file/version in history.
                  </p>
                  <label className="dtp-procedure-field">
                    Procedure steps
                    <textarea
                      rows={6}
                      value={draft.dtpSummary}
                      onChange={(e) =>
                        setDraft({ ...draft, dtpSummary: e.target.value })
                      }
                    />
                  </label>
                  <div className="dtp-meta-grid">
                    <label>
                      Version
                      <input
                        value={draft.dtpVersion}
                        onChange={(e) =>
                          setDraft({ ...draft, dtpVersion: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Procedure owner
                      <input
                        value={draft.dtpOwner}
                        onChange={(e) =>
                          setDraft({ ...draft, dtpOwner: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="guidance-card file-card dtp-upload">
                    <span>▤</span>
                    <span>
                      <strong>
                        {draft.dtpDocument || "Attach a desktop procedure"}
                      </strong>
                      <small>
                        Filename retained for this browser-based prototype
                      </small>
                    </span>
                    <b>+</b>
                    <input
                      type="file"
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          setDraft({
                            ...draft,
                            dtpDocument: e.target.files[0].name,
                            dtpStatus: "Current",
                            dtpOwner:
                              draft.dtpOwner === "Unassigned"
                                ? CURRENT_USER
                                : draft.dtpOwner,
                          });
                      }}
                    />
                  </label>
                  <button
                    className="primary-button owner-dtp-save"
                    onClick={saveDtp}
                  >
                    Save DTP update
                  </button>
                  {draft.dtpHistory.length > 0 && (
                    <div className="dtp-history">
                      <strong>Version history</strong>
                      {draft.dtpHistory.slice(0, 5).map((item, index) => (
                        <span key={`${item.version}-${index}`}>
                          {item.document} · {item.version} · {item.reviewedAt}
                        </span>
                      ))}
                    </div>
                  )}
                </details>
              </section>
              <section className="drawer-section">
                <div>
                  <span className="section-kicker">Ownership</span>
                  <h3>People & support</h3>
                </div>
                <div className="people-row">
                  <span className="avatar orange-avatar">
                    {draft.owner === "Unassigned" ? "?" : DEMO_INITIALS}
                  </span>
                  <span>
                    <small>Control Owner</small>
                    <strong>{draft.owner}</strong>
                  </span>
                  <button
                    onClick={() => setShowReassign(!showReassign)}
                  >
                    Reassign
                  </button>
                </div>
                {showReassign && (
                  <div className="reassign-form">
                    <label>
                      New Control Owner
                      <select
                        value={newOwner}
                        onChange={(e) => setNewOwner(e.target.value)}
                      >
                        <option value="">Select prototype owner</option>
                        <option>{CURRENT_USER}</option>
                      </select>
                    </label>
                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={handover}
                        onChange={(e) => setHandover(e.target.checked)}
                      />
                      Handover of responsibilities is complete
                    </label>
                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={training}
                        onChange={(e) => setTraining(e.target.checked)}
                      />
                      Training and procedure walkthrough are complete
                    </label>
                    <button onClick={reassign}>Confirm reassignment</button>
                  </div>
                )}
                {ownershipChanges
                  .filter((change) => change.controlId === control.id)
                  .slice(0, 3)
                  .map((change) => (
                    <small className="field-note" key={change.id}>
                      {new Date(change.changedAt).toLocaleDateString()}:{" "}
                      {change.fromOwner} → {change.toOwner}
                    </small>
                  ))}
              </section>
            </>
          )}
        </div>
        <div className="drawer-footer">
          {role === "Controller Admin" && (
            <button
              className="secondary-button"
              onClick={() => setRequestModal("gap")}
            >
              Log a gap
            </button>
          )}
          <button
            className="secondary-button"
            onClick={() => setRequestModal("guidance")}
          >
            Ask for guidance
          </button>
          {role === "Control Owner" ? (
            <button
              className="primary-button"
              disabled={
                !acknowledgementSaved ||
                !progressSaved ||
                !(
                  executionOutcome === "Performed as documented" ||
                  executionOutcome === "Performed with deviations"
                ) ||
                (executionOutcome === "Performed with deviations" &&
                  !deviationNotes.trim()) ||
                (draft.dtpStatus === "Current" && !documentationReviewed) ||
                (draft.evidenceRequired && attachments.length === 0)
              }
              onClick={() => {
                updateControl(draft.id, {
                  status: "Certified",
                  due: "Complete",
                  accepted,
                  understood,
                  acknowledgedAt,
                  performed: true,
                  executionOutcome,
                  deviationNotes: deviationNotes.trim(),
                  documentationReviewed,
                  documentationReviewedAt: documentationReviewed
                    ? new Date().toISOString()
                    : undefined,
                  certifiedAt: new Date().toISOString(),
                });
                appendAudit(
                  draft.id,
                  "Control certified",
                  "Saved ownership acknowledgement, execution and evidence requirements confirmed",
                );
                notify(`${controlCode(draft)} certified`);
                close();
              }}
            >
              Certify control
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={() => changeRole("Control Owner")}
            >
              Preview Control Owner view
            </button>
          )}
        </div>
      </aside>
      {requestModal && (
        <>
          <button
            className="request-dialog-scrim"
            aria-label="Close request form"
            onClick={() => setRequestModal(null)}
          />
          <section
            className="request-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-dialog-title"
          >
            <header>
              <div>
                <span className="section-kicker">
                  {requestModal === "gap"
                    ? "Exception management"
                    : "Controller support"}
                </span>
                <h2 id="request-dialog-title">
                  {requestModal === "gap"
                    ? "Log a control gap"
                    : "Ask for guidance"}
                </h2>
                <p>
                  {controlCode(control)} · {control.name}
                </p>
              </div>
              <button
                aria-label="Close request form"
                onClick={() => setRequestModal(null)}
              >
                ×
              </button>
            </header>
            {requestModal === "gap" ? (
              <div className="request-dialog-body">
                <div className="request-outcome">
                  <span>!</span>
                  <div>
                    <strong>What happens after submission?</strong>
                    <p>
                      The item appears in Gap remediation for Controller review,
                      assignment, target-date tracking and closure approval.
                    </p>
                  </div>
                </div>
                <label>
                  Gap title
                  <input
                    value={gapRequest.title}
                    onChange={(e) =>
                      setGapRequest({ ...gapRequest, title: e.target.value })
                    }
                    placeholder="Summarize the exception"
                  />
                </label>
                <label>
                  What happened and what needs to be remediated?
                  <textarea
                    rows={5}
                    value={gapRequest.description}
                    onChange={(e) =>
                      setGapRequest({
                        ...gapRequest,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe the issue, impact and expected corrective action"
                  />
                </label>
                <div className="request-field-grid">
                  <label>
                    Severity
                    <select
                      value={gapRequest.severity}
                      onChange={(e) =>
                        setGapRequest({
                          ...gapRequest,
                          severity: e.target
                            .value as RemediationGap["severity"],
                        })
                      }
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                  </label>
                  <label>
                    Remediation owner
                    <input
                      value={gapRequest.owner}
                      onChange={(e) =>
                        setGapRequest({ ...gapRequest, owner: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Target date
                    <input
                      type="date"
                      value={gapRequest.due}
                      onChange={(e) =>
                        setGapRequest({ ...gapRequest, due: e.target.value })
                      }
                    />
                  </label>
                </div>
                <footer>
                  <button
                    className="secondary-button"
                    onClick={() => setRequestModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="primary-button" onClick={submitGap}>
                    Submit gap
                  </button>
                </footer>
              </div>
            ) : (
              <div className="request-dialog-body">
                <div className="request-outcome guidance">
                  <span>?</span>
                  <div>
                    <strong>What happens after submission?</strong>
                    <p>
                      The request is added to this control activity history
                      and a simulated notification is sent to the Controller
                      team. Enterprise routing will use Microsoft 365.
                    </p>
                  </div>
                </div>
                <div className="request-field-grid">
                  <label>
                    Guidance topic
                    <select
                      value={guidanceRequest.topic}
                      onChange={(e) =>
                        setGuidanceRequest({
                          ...guidanceRequest,
                          topic: e.target.value,
                        })
                      }
                    >
                      <option>Procedure or DTP</option>
                      <option>Evidence requirement</option>
                      <option>Control interpretation</option>
                      <option>Ownership or reassignment</option>
                      <option>Technical issue</option>
                    </select>
                  </label>
                  <label>
                    Response needed
                    <select
                      value={guidanceRequest.urgency}
                      onChange={(e) =>
                        setGuidanceRequest({
                          ...guidanceRequest,
                          urgency: e.target.value,
                        })
                      }
                    >
                      <option>Standard</option>
                      <option>Before due date</option>
                      <option>Urgent — execution blocked</option>
                    </select>
                  </label>
                </div>
                <label>
                  What guidance do you need?
                  <textarea
                    rows={6}
                    value={guidanceRequest.question}
                    onChange={(e) =>
                      setGuidanceRequest({
                        ...guidanceRequest,
                        question: e.target.value,
                      })
                    }
                    placeholder="Include the question, relevant context and any decision you need from the Controller team"
                  />
                </label>
                <footer>
                  <button
                    className="secondary-button"
                    onClick={() => setRequestModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="primary-button" onClick={submitGuidance}>
                    Submit request
                  </button>
                </footer>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function ControlTable({
  controls,
  title,
  openControl,
  showRules = false,
  onExport,
}: {
  controls: InventoryControl[];
  title: string;
  openControl: (c: InventoryControl) => void;
  showRules?: boolean;
  onExport: () => void;
}) {
  return (
    <section className="panel controls-panel">
      <div className="panel-heading controls-heading">
        <div>
          <span className="section-kicker">Control workspace</span>
          <h2>{title}</h2>
        </div>
        <div className="table-actions">
          <button onClick={onExport}>⇩ Export</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Control</th>
              <th>Control Owner</th>
              <th>Frequency</th>
              {showRules && <th>Evidence / DTP</th>}
              <th>Due</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => (
              <tr key={control.id} onClick={() => openControl(control)}>
                <td>
                  <div className="control-title">
                    <span>
                      {controlCode(control)} · {control.country} · {control.unit}
                    </span>
                    <strong>{control.name}</strong>
                    <small>
                      {control.pillar} · {control.businessProcess} · {control.process} · {control.nature}
                      {control.keyControl ? " · Key" : ""}
                    </small>
                  </div>
                </td>
                <td>
                  {control.owner === "Unassigned" ? (
                    <span className="unassigned-owner">Assign owner</span>
                  ) : (
                    <div className="owner">
                      <span>
                        {control.owner
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <strong>{control.owner}</strong>
                    </div>
                  )}
                </td>
                <td>
                  <strong className="cell-main">{control.frequency}</strong>
                  <small className="cell-sub">
                    Attestation: {control.attestationFrequency}
                  </small>
                </td>
                {showRules && (
                  <td>
                    <strong className="cell-main">
                      {control.evidenceRequired
                        ? "Required"
                        : "Certification only"}
                    </strong>
                    <small className="cell-sub">DTP: {control.dtpStatus}</small>
                  </td>
                )}
                <td>
                  <strong className="cell-main">{control.due}</strong>
                  <small className="cell-sub">{workflowStage(control)}</small>
                </td>
                <td>
                  <span className={`status ${statusClass[control.status]}`}>
                    <i />
                    {control.status}
                  </span>
                </td>
                <td>
                  <button
                    className="row-arrow"
                    aria-label={`Open ${controlCode(control)} for ${control.unit}`}
                  >
                    ›
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {controls.length === 0 && (
          <div className="empty-state">
            <strong>No controls match this view.</strong>
            <span>Try clearing one or more filters.</span>
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>Showing {controls.length} controls</span>
        <span>Select a row to view or configure it</span>
      </div>
    </section>
  );
}
