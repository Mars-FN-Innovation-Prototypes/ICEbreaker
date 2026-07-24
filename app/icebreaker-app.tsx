"use client";
/* Static brand assets are intentionally served directly on GitHub Pages. */
/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  inventoryControls,
  processCounts,
  type ControlStatus,
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
type ScopeConfig = { regions: string[]; sites: string[] };
type SavedView = {
  name: string;
  process: string;
  status: string;
  evidence: string;
  audience: Audience;
  region?: string;
  site?: string;
  owner?: string;
  controlType?: string;
  applicability?: string;
  keyControl?: string;
  frequency?: string;
};

const CURRENT_USER = "Demo Account";
const DEMO_INITIALS = "DA";
const DEFAULT_SCOPE: ScopeConfig = { regions: ["Europe"], sites: [] };
const normalizeControl = (control: InventoryControl): InventoryControl => ({
  ...control,
  applicable: control.applicable ?? true,
  dtpSummary: control.dtpSummary || "",
  dtpOwner: control.dtpOwner || "Controller Admin",
  dtpVersion: control.dtpVersion || "",
  dtpLastReviewed: control.dtpLastReviewed || "",
  dtpNextReview: control.dtpNextReview || "",
  dtpDocument: control.dtpDocument || "",
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
  "Due soon": "review",
  "Evidence needed": "warning",
  Overdue: "danger",
  Unassigned: "neutral",
  "Not started": "neutral",
};

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
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [evidenceFilter, setEvidenceFilter] = useState("All evidence rules");
  const [regionFilter, setRegionFilter] = useState("All configured regions");
  const [siteFilter, setSiteFilter] = useState("All configured sites");
  const [ownerFilter, setOwnerFilter] = useState("All owners");
  const [typeFilter, setTypeFilter] = useState("All control types");
  const [applicabilityFilter, setApplicabilityFilter] =
    useState("All applicability");
  const [keyFilter, setKeyFilter] = useState("All controls");
  const [frequencyFilter, setFrequencyFilter] = useState("All frequencies");
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
        return { ...definition, ...execution };
      }),
    [definitions, executions, period],
  );

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
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
          setDefinitions(
            (JSON.parse(storedDefinitions) as InventoryControl[]).map(
              normalizeControl,
            ),
          );
        } else if (storedControls) {
          const parsed: InventoryControl[] = JSON.parse(storedControls);
          setDefinitions(parsed.map(normalizeControl));
          setExecutions(
            Object.fromEntries(
              parsed.map((control) => [
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
        if (storedExecutions) setExecutions(JSON.parse(storedExecutions));
        if (storedOwnershipChanges)
          setOwnershipChanges(JSON.parse(storedOwnershipChanges));
        if (storedGaps) setGaps(JSON.parse(storedGaps));
        if (storedAudit) setAuditEvents(JSON.parse(storedAudit));
        if (storedViews) setSavedViews(JSON.parse(storedViews));
        if (storedAttachments) setAttachments(JSON.parse(storedAttachments));
        if (storedScope) setScopeConfig(JSON.parse(storedScope));
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
          `${control.id} ${control.name} ${control.process} ${control.owner}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (processFilter === "All processes" ||
            control.process === processFilter) &&
          (statusFilter === "All statuses" ||
            control.status === statusFilter) &&
          (regionFilter === "All configured regions" ||
            !scopeConfig.regions.includes(regionFilter) ||
            control.region === regionFilter) &&
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
          (evidenceFilter === "All evidence rules" ||
            (evidenceFilter === "Evidence required"
              ? control.evidenceRequired
              : !control.evidenceRequired))
        );
      }),
    [
      controls,
      query,
      processFilter,
      statusFilter,
      evidenceFilter,
      regionFilter,
      siteFilter,
      scopeConfig,
      ownerFilter,
      typeFilter,
      applicabilityFilter,
      keyFilter,
      frequencyFilter,
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
          site: control.site,
          accepted: control.accepted || false,
          understood: control.understood || false,
          performed: control.performed || false,
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
        "Control ID",
        "Control name",
        "Sub-process",
        "Frequency",
        "Control type",
        "Key control",
        "Applicable",
        "Evidence required",
        "Control Owner",
        "Region",
        "Site / factory",
        "Status",
        "Due",
      ],
      ...filtered.map((c) => [
        c.id,
        c.name,
        c.process,
        c.frequency,
        c.type,
        c.keyControl ? "Yes" : "No",
        c.applicable ? "Yes" : "No",
        c.evidenceRequired ? "Yes" : "No",
        c.owner,
        c.region,
        c.site,
        c.status,
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
              evidenceFilter={evidenceFilter}
              setEvidenceFilter={setEvidenceFilter}
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
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              evidenceFilter={evidenceFilter}
              setEvidenceFilter={setEvidenceFilter}
              regionFilter={regionFilter}
              setRegionFilter={setRegionFilter}
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
        <ControlDrawer
          control={selected}
          role={role}
          period={period}
          attachments={
            attachments[executionKey(period, selected.id)] || []
          }
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
          <span>To accept</span>
          <strong>
            {controls.filter((c) => c.status === "Unassigned").length}
          </strong>
          <small>Ownership confirmation</small>
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
                  {control.status}
                </span>
                <b>›</b>
              </button>
            ))}
          </article>
          <OwnerJourney />
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

function OwnerJourney() {
  return (
    <article className="panel view-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Control Owner journey</span>
          <h2>One guided execution flow</h2>
        </div>
      </div>
      <div className="journey">
        <div className="done">
          <i>1</i>
          <span>
            <strong>Confirm & accept ownership</strong>
            <small>Make accountability explicit</small>
          </span>
        </div>
        <div className="current">
          <i>2</i>
          <span>
            <strong>Understand & perform</strong>
            <small>Follow instructions and DTP</small>
          </span>
        </div>
        <div>
          <i>3</i>
          <span>
            <strong>Upload & certify</strong>
            <small>Attach evidence where required</small>
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
  evidenceFilter,
  setEvidenceFilter,
  openControl,
  downloadReport,
}: {
  controls: InventoryControl[];
  processFilter: string;
  setProcessFilter: (v: string) => void;
  evidenceFilter: string;
  setEvidenceFilter: (v: string) => void;
  openControl: (c: InventoryControl) => void;
  downloadReport: () => void;
}) {
  return (
    <section className="workspace-view">
      <div className="filter-bar">
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
            setEvidenceFilter("All evidence rules");
          }}
        >
          Clear filters
        </button>
        <span>{controls.length} controls</span>
      </div>
      <ControlTable
        controls={controls}
        title="ICE framework control library"
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
  statusFilter,
  setStatusFilter,
  evidenceFilter,
  setEvidenceFilter,
  regionFilter,
  setRegionFilter,
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
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  evidenceFilter: string;
  setEvidenceFilter: (v: string) => void;
  regionFilter: string;
  setRegionFilter: (v: string) => void;
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
  const frequencies = Array.from(
    new Set(availableControls.map((c) => c.frequency)),
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
        process: processFilter,
        status: statusFilter,
        evidence: evidenceFilter,
        audience,
        region: regionFilter,
        site: siteFilter,
        owner: ownerFilter,
        controlType: typeFilter,
        applicability: applicabilityFilter,
        keyControl: keyFilter,
        frequency: frequencyFilter,
      },
    ]);
    notify(`Saved “${name}”`);
  };
  const load = (view: SavedView) => {
    setProcessFilter(view.process);
    setStatusFilter(view.status);
    setEvidenceFilter(view.evidence);
    setRegionFilter(view.region || "All configured regions");
    setSiteFilter(view.site || "All configured sites");
    setOwnerFilter(view.owner || "All owners");
    setTypeFilter(view.controlType || "All control types");
    setApplicabilityFilter(view.applicability || "All applicability");
    setKeyFilter(view.keyControl || "All controls");
    setFrequencyFilter(view.frequency || "All frequencies");
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
              Site / factory
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
              <select disabled>
                <option>All processes</option>
                <option>Inventory</option>
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
              Frequency
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
                  {control.id} · {control.name}
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
      notify(`Enter a ${kind === "sites" ? "site or factory" : "region"}`);
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
      `${cleaned} added to ${kind === "sites" ? "sites & factories" : "regions"}`,
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
      "Control ID",
      "Control Name",
      "Sub-process",
      "Frequency",
      "Control Type",
      "Nature",
      "Key Control (Y/N)",
      "Applicable (Y/N)",
      "Evidence Needed (Y/N)",
      "Control Owner",
      "Region",
      "Site",
      "Due Date",
    ];
    await writeXlsxFile(
      [
        headers.map((value) => ({ value, fontWeight: "bold" as const })),
        [
          "INV.MF.01",
          "Creation and Changes to Bill of Materials",
          "Manufacturing",
          "Event Based",
          "Manual with IT Dependency",
          "Preventive",
          "Y",
          "Y",
          "Y",
          CURRENT_USER,
          "Europe",
          "Poznan Factory",
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
      "Control ID",
      "Control Name",
      "Sub-process",
      "Frequency",
      "Evidence Needed (Y/N)",
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
      const id = cells[headers.indexOf("Control ID")];
      if (!id) errors.push(`Row ${index + 2}: Control ID is required`);
      if (seen.has(id)) errors.push(`Row ${index + 2}: duplicate Control ID`);
      seen.add(id);
      if (
        !controls.some((control) => control.id === id) &&
        (!cells[headers.indexOf("Control Name")] ||
          !cells[headers.indexOf("Sub-process")] ||
          !cells[headers.indexOf("Frequency")])
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
    const headers = Object.keys(importPreview.rows[0] || {});
    const imported = new Map(
      importPreview.rows.map((row) => [
        row["Control ID"],
        headers.map((header) => row[header]),
      ]),
    );
    const importedSites = Array.from(imported.values())
      .map((row) => row[headers.indexOf("Site")])
      .filter((value): value is string => Boolean(value));
    if (importedSites.length) {
      setScopeConfig({
        ...scopeConfig,
        sites: Array.from(new Set([...scopeConfig.sites, ...importedSites])),
      });
    }
    const yes = (value: string, fallback: boolean) =>
      value ? ["Y", "YES"].includes(value.toUpperCase()) : fallback;
    const existing = controls.map((control) => {
        const row = imported.get(control.id);
        if (!row) return control;
        imported.delete(control.id);
        const requestedOwner = row[headers.indexOf("Control Owner")];
        const owner = requestedOwner ? CURRENT_USER : "Unassigned";
        return normalizeControl({
          ...control,
          name: row[headers.indexOf("Control Name")] || control.name,
          process: row[headers.indexOf("Sub-process")] || control.process,
          frequency: row[headers.indexOf("Frequency")] || control.frequency,
          type: row[headers.indexOf("Control Type")] || control.type,
          nature:
            row[headers.indexOf("Nature")] === "Detective"
              ? "Detective"
              : control.nature,
          keyControl: yes(
            row[headers.indexOf("Key Control (Y/N)")],
            control.keyControl,
          ),
          applicable: yes(
            row[headers.indexOf("Applicable (Y/N)")],
            control.applicable,
          ),
          owner,
          region: row[headers.indexOf("Region")] || control.region,
          site: row[headers.indexOf("Site")] || control.site,
          unit: "Food & Nutrition",
          due: row[headers.indexOf("Due Date")] || control.due,
          evidenceRequired:
            yes(
              row[headers.indexOf("Evidence Needed (Y/N)")],
              control.evidenceRequired,
            ),
          status: owner === "Unassigned" ? "Unassigned" : "Not started",
        });
      });
    const added = Array.from(imported.values()).map((row) =>
      normalizeControl({
        id: row[headers.indexOf("Control ID")],
        name: row[headers.indexOf("Control Name")],
        process: row[headers.indexOf("Sub-process")],
        frequency: row[headers.indexOf("Frequency")],
        type: row[headers.indexOf("Control Type")] || "Manual",
        nature:
          row[headers.indexOf("Nature")] === "Detective"
            ? "Detective"
            : "Preventive",
        keyControl: yes(row[headers.indexOf("Key Control (Y/N)")], false),
        applicable: yes(row[headers.indexOf("Applicable (Y/N)")], true),
        evidenceRequired: yes(
          row[headers.indexOf("Evidence Needed (Y/N)")],
          true,
        ),
        owner: row[headers.indexOf("Control Owner")]
          ? CURRENT_USER
          : "Unassigned",
        status: row[headers.indexOf("Control Owner")]
          ? "Not started"
          : "Unassigned",
        due: row[headers.indexOf("Due Date")] || "Not scheduled",
        dtpStatus: "Not added",
        region: row[headers.indexOf("Region")] || "Europe",
        site: row[headers.indexOf("Site")] || "",
        unit: "Food & Nutrition",
        instructions: "",
        dtpSummary: "",
        dtpOwner: "Controller Admin",
        dtpVersion: "",
        dtpLastReviewed: "",
        dtpNextReview: "",
        dtpDocument: "",
      }),
    );
    setControls([...existing, ...added]);
    setImportPreview(null);
    notify(
      `${importPreview.rows.length} control rows imported · assignments mapped to Demo Account`,
    );
  };
  const assigned = controls.filter((c) => c.owner !== "Unassigned").length;
  const addControl = () => {
    const id = newControl.id.trim().toUpperCase();
    const name = newControl.name.trim();
    if (!id || !name) {
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
        name,
        process: newControl.process.trim() || "Inventory",
        frequency: "Periodic",
        keyControl: false,
        nature: "Preventive",
        type: "Manual",
        evidenceRequired: true,
        owner: "Unassigned",
        status: "Unassigned",
        due: "Not scheduled",
        dtpStatus: "Not added",
        region: "Europe",
        site: "",
        unit: "Food & Nutrition",
        instructions: "",
        applicable: true,
        dtpSummary: "",
        dtpOwner: "Controller Admin",
        dtpVersion: "",
        dtpLastReviewed: "",
        dtpNextReview: "",
        dtpDocument: "",
      }),
    ]);
    setNewControl({ id: "", name: "", process: "Manufacturing" });
    notify(`${id} added to the control library`);
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
            <div className="scope-group-label">Sites & factories</div>
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
                Country or region
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
                Site / factory
                <input
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder="Enter site or factory"
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
              Generate reminder preview
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
            <small>
              Enterprise target: Entra ID identity with governed delivery
              through Microsoft Graph after GCP deployment.
            </small>
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
  const [performed, setPerformed] = useState(control.performed || false);
  const [draft, setDraft] = useState(control);
  const [showReassign, setShowReassign] = useState(false);
  const [newOwner, setNewOwner] = useState("");
  const [handover, setHandover] = useState(false);
  const [training, setTraining] = useState(false);
  const saveAdmin = () => {
    const status: ControlStatus =
      draft.owner === "Unassigned"
        ? "Unassigned"
        : draft.status === "Unassigned"
          ? "Not started"
          : draft.status;
    updateControl(control.id, { ...draft, status, unit: "Food & Nutrition" });
    appendAudit(
      control.id,
      "Control requirements updated",
      "Ownership, execution rules or guidance changed",
    );
    notify(`${control.id} requirements saved`);
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
      status: "Not started",
      accepted: false,
      understood: false,
      performed: false,
    });
    appendAudit(
      control.id,
      "Ownership reassigned",
      `${change.fromOwner} to ${change.toOwner}; handover and training confirmed`,
    );
    notify(`${control.id} reassigned to ${change.toOwner}`);
    close();
  };
  const logGap = () => {
    const title = window.prompt(
      "Describe the control gap",
      `${control.id} execution exception`,
    );
    if (!title?.trim()) return;
    setGaps((current) => [
      {
        id: crypto.randomUUID(),
        controlId: control.id,
        period,
        title: title.trim(),
        description: "",
        severity: "Medium",
        owner: draft.owner,
        due: "",
        status: "Open",
        closureEvidence: "",
        controllerApproved: false,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    appendAudit(control.id, "Gap logged", title.trim());
    notify(`Gap logged for ${control.id}`);
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
            {draft.id}
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
                <label>
                  Control Owner
                  <select
                    value={
                      draft.owner === CURRENT_USER ? CURRENT_USER : "Unassigned"
                    }
                    onChange={(e) =>
                      setDraft({ ...draft, owner: e.target.value })
                    }
                  >
                    <option value="Unassigned">Unassigned</option>
                    <option value={CURRENT_USER}>{CURRENT_USER}</option>
                  </select>
                  <small className="field-note">
                    Demo Account is the only assignable user in this MVP.
                  </small>
                </label>
                <label>
                  Site / factory
                  <select
                    value={draft.site}
                    onChange={(e) =>
                      setDraft({ ...draft, site: e.target.value })
                    }
                  >
                    <option value="">Not mapped to a site</option>
                    {scopeConfig.sites.map((site) => (
                      <option key={site}>{site}</option>
                    ))}
                  </select>
                  <small className="field-note">
                    Drives the Site owners report and site filter.
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
                <button onClick={saveAdmin}>Save control requirements</button>
              </section>
              <section className="drawer-section">
                <div>
                  <span className="section-kicker">Desktop procedure</span>
                  <h3>DTP guidance</h3>
                </div>
                <label>
                  Procedure summary
                  <textarea
                    value={draft.dtpSummary}
                    placeholder="Add concise steps here, or summarize the attached procedure"
                    onChange={(e) =>
                      setDraft({ ...draft, dtpSummary: e.target.value })
                    }
                  />
                </label>
                <div className="detail-grid">
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
                <label className="guidance-card file-card">
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
                <button
                  className="wide-secondary"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      dtpStatus: "Current",
                      dtpLastReviewed: new Date().toISOString().slice(0, 10),
                    })
                  }
                >
                  Confirm DTP is current
                </button>
              </section>
            </>
          ) : (
            <>
              <section className="drawer-section">
                <div>
                  <span className="section-kicker">Required confirmations</span>
                  <h3>Control Owner acknowledgement</h3>
                </div>
                <label className="check-card">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
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
                    onChange={(e) => setUnderstood(e.target.checked)}
                  />
                  <span>
                    <strong>I understand the requirement</strong>
                    <small>
                      I reviewed the instructions and desktop procedure.
                    </small>
                  </span>
                </label>
                <label className="check-card">
                  <input
                    type="checkbox"
                    checked={performed}
                    onChange={(e) => setPerformed(e.target.checked)}
                  />
                  <span>
                    <strong>The control was performed as documented</strong>
                    <small>
                      Exceptions were recorded and escalated where needed.
                    </small>
                  </span>
                </label>
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
                      <input
                        value={newOwner}
                        onChange={(e) => setNewOwner(e.target.value)}
                        placeholder="Enter new owner"
                      />
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
            <button className="secondary-button" onClick={logGap}>
              Log a gap
            </button>
          )}
          <button
            className="secondary-button"
            onClick={() =>
              notify("Guidance request recorded for the Controller team")
            }
          >
            Ask for guidance
          </button>
          {role === "Control Owner" ? (
            <button
              className="primary-button"
              disabled={
                !accepted ||
                !understood ||
                !performed ||
                (draft.evidenceRequired && attachments.length === 0)
              }
              onClick={() => {
                updateControl(draft.id, {
                  status: "Certified",
                  due: "Complete",
                  accepted,
                  understood,
                  performed,
                  certifiedAt: new Date().toISOString(),
                });
                appendAudit(
                  draft.id,
                  "Control certified",
                  "Ownership, understanding and execution acknowledgements confirmed",
                );
                notify(`${draft.id} certified`);
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
                    <span>{control.id}</span>
                    <strong>{control.name}</strong>
                    <small>
                      {control.process} · {control.nature}
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
                  <small className="cell-sub">{control.type}</small>
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
                  <small className="cell-sub">Current period</small>
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
                    aria-label={`Open ${control.id}`}
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
