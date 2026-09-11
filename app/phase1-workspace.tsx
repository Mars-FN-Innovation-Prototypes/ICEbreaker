"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import readXlsxFile from "read-excel-file";
import writeXlsxFile from "write-excel-file";
import type { InventoryControl } from "./inventory-controls";
import {
  INITIAL_PHASE1,
  REMINDER_RULES,
  validateCalendar,
  reminderCandidates,
  fileLabel,
  fileId,
  isDate,
  csvCell,
  type Phase1State,
  type CalendarPeriod,
  type GuidanceRequest,
} from "./phase1-domain";
import {
  allLocalFiles,
  readLocalFile,
  restoreLocalFiles,
  type LocalFile,
} from "./local-files";
import { persistWorkspaceValue, workspaceSnapshot } from "./local-state";

type Phase1ContextType = {
  state: Phase1State;
  setState: Dispatch<SetStateAction<Phase1State>>;
  currentUser: string;
  setCurrentUser: (name: string) => void;
};
const Phase1Context = createContext<Phase1ContextType | null>(null);
export const usePhase1 = () => {
  const context = useContext(Phase1Context);
  if (!context) throw new Error("Phase 1 workspace is unavailable");
  return context;
};
export function Phase1Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Phase1State>(INITIAL_PHASE1);
  const [currentUser, setCurrentUser] = useState("Demo Account");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    const report = () =>
      setStorageError(
        "Browser storage is full or unavailable. Keep this tab open and export a backup from Admin setup → Test data to preserve your current work.",
      );
    window.addEventListener("icebreaker-storage-error", report);
    return () => window.removeEventListener("icebreaker-storage-error", report);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem("icebreaker-phase1");
        if (raw) {
          const saved = JSON.parse(raw);
          if (
            saved &&
            Array.isArray(saved.people) &&
            Array.isArray(saved.calendar) &&
            Array.isArray(saved.guidance) &&
            Array.isArray(saved.rules) &&
            Array.isArray(saved.messages)
          )
            setState(saved);
        }
      } catch {
        setStorageError(
          "Saved test settings could not be loaded. Restore a valid backup before continuing.",
        );
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      persistWorkspaceValue("icebreaker-phase1", JSON.stringify(state));
    } catch {
      setTimeout(
        () =>
          setStorageError(
            "Your browser could not save changes. Export a backup now; do not close this tab.",
          ),
        0,
      );
    }
  }, [state, ready]);
  return (
    <Phase1Context.Provider
      value={{ state, setState, currentUser, setCurrentUser }}
    >
      {storageError && (
        <div role="alert" className="storage-error">
          {storageError}
        </div>
      )}
      {children}
    </Phase1Context.Provider>
  );
}
export function OwnerPicker({
  value,
  onChange,
  allowUnassigned = true,
  label = "Control Owner",
}: {
  value: string;
  onChange: (name: string) => void;
  allowUnassigned?: boolean;
  label?: string;
}) {
  const { state } = usePhase1();
  const [search, setSearch] = useState("");
  const matches = state.people.filter((person) =>
    `${person.name} ${person.email} ${person.unit}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="owner-picker">
      <label>
        {label}
        <input
          aria-label={`Search ${label}`}
          placeholder="Search test name, email or unit"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowUnassigned ? (
          <option>Unassigned</option>
        ) : (
          <option value="">Choose a test account</option>
        )}
        {value &&
          value !== "Unassigned" &&
          !matches.some((p) => p.name === value) && (
            <option value={value}>{value} · current selection</option>
          )}
        {matches.map((person) => (
          <option key={person.name} value={person.name}>
            {person.name} · {person.email} · {person.unit}
          </option>
        ))}
      </select>
      <small>
        {matches.length} matching test accounts · no corporate directory
        connection
      </small>
    </div>
  );
}
export function LocalFileLink({ reference }: { reference: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const file = await readLocalFile(reference);
      if (!file)
        throw new Error(
          "File not found in this browser. Re-upload it or restore a backup that includes documents.",
        );
      const url = URL.createObjectURL(file.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to retrieve file");
    }
    setBusy(false);
  };
  return (
    <span className="local-file-link">
      {fileId(reference) ? (
        <button className="text-link" disabled={busy} onClick={download}>
          ⇩ {fileLabel(reference)}
        </button>
      ) : /^https?:\/\//i.test(reference) ? (
        <a href={reference} target="_blank" rel="noreferrer">
          {reference}
        </a>
      ) : (
        <span>
          {reference || "Inline procedure"}
          {reference && (
            <small>Legacy filename only — re-upload to enable retrieval</small>
          )}
        </span>
      )}
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
export function ScheduleFields({
  control,
  change,
}: {
  control: InventoryControl;
  change: (changes: Partial<InventoryControl>) => void;
}) {
  return (
    <div className="schedule-fields">
      <p>
        <strong>Control execution</strong> is how often the task is performed.{" "}
        <strong>Owner attestation</strong> is when the Owner confirms completion
        in ICEbreaker; Controller testing is a separate activity.
      </p>
      <div className="admin-meta-grid">
        <label>
          Deadline week
          <input
            type="number"
            min={1}
            max={53}
            placeholder="Use period end"
            value={control.dueWeek || ""}
            onChange={(e) =>
              change({
                dueWeek: e.target.value
                  ? Math.max(1, Math.min(53, Number(e.target.value)))
                  : undefined,
              })
            }
          />
        </label>
        <label>
          Day within week
          <select
            value={control.dueDay || 5}
            onChange={(e) => change({ dueDay: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                Day {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <small>
        Weeks start on the imported period start date. Leave the week empty to
        use period end. A saved date overrides the rule for the selected period
        only.
      </small>
    </div>
  );
}
export function CalendarSetup({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const { state, setState } = usePhase1();
  const [draft, setDraft] = useState<CalendarPeriod>({
    id: "",
    start: "",
    end: "",
    quarterEnd: false,
    halfEnd: false,
    yearEnd: false,
  });
  const [preview, setPreview] = useState<{
    rows: CalendarPeriod[];
    errors: string[];
  } | null>(null);
  const headers = [
    "Period",
    "Start",
    "End",
    "Quarter End (Y/N)",
    "Half Year End (Y/N)",
    "Year End (Y/N)",
  ];
  const importCalendar = async (file?: File) => {
    if (!file) return;
    try {
      const sheet = await readXlsxFile(file);
      const names = (sheet.shift() || []).map(String);
      if (headers.some((h) => !names.includes(h)))
        throw new Error(`Required columns: ${headers.join(", ")}`);
      const errors: string[] = [];
      const rows = sheet
        .filter((r) => r.some(Boolean))
        .map((r, index) => {
          const get = (name: string) => {
            const v = r[names.indexOf(name)];
            return v instanceof Date
              ? v.toISOString().slice(0, 10)
              : String(v ?? "").trim();
          };
          for (const h of headers.slice(3))
            if (!["Y", "N"].includes(get(h).toUpperCase()))
              errors.push(`Row ${index + 2}: ${h} must be Y or N.`);
          return {
            id: get("Period"),
            start: get("Start"),
            end: get("End"),
            quarterEnd: get(headers[3]).toUpperCase() === "Y",
            halfEnd: get(headers[4]).toUpperCase() === "Y",
            yearEnd: get(headers[5]).toUpperCase() === "Y",
          };
        });
      setPreview({ rows, errors: [...errors, ...validateCalendar(rows)] });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Calendar could not be read");
    }
  };
  const apply = (rows: CalendarPeriod[]) => {
    const errors = validateCalendar(rows);
    if (errors.length) return notify(errors[0]);
    setState((s) => ({
      ...s,
      calendar: [
        ...s.calendar.filter((p) => !rows.some((r) => r.id === p.id)),
        ...rows,
      ],
    }));
    setPreview(null);
    notify(
      "Calendar saved. Existing execution records and explicit due dates are unchanged.",
    );
  };
  return (
    <article className="panel setup-card phase1-panel">
      <span className="section-kicker">Controller scheduling</span>
      <h2>Reporting calendar</h2>
      <p>
        The three original demo cycles are retained for compatibility, not an
        official Mars calendar. Import approved dates or define periods below.
        Quarter/half/year flags determine when attestations appear. Event-based
        controls are activated explicitly in the control panel.
      </p>
      <div className="phase1-actions">
        <button
          className="secondary-small"
          onClick={() =>
            writeXlsxFile(
              [
                headers.map((value) => ({
                  value,
                  fontWeight: "bold" as const,
                })),
                ["Example P01", "2027-01-01", "2027-01-28", "N", "N", "N"].map(
                  (value) => ({ value }),
                ),
              ],
              { fileName: "ICEbreaker-calendar-template.xlsx" },
            )
          }
        >
          Download calendar template
        </button>
        <label className="secondary-small">
          Import calendar
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              void importCalendar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {preview && (
        <div className="import-preview">
          <strong>
            {preview.rows.length} periods · {preview.errors.length} issues
          </strong>
          {preview.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
          {preview.rows.map((r) => (
            <p key={r.id}>
              {r.id}: {r.start} → {r.end}
            </p>
          ))}
          <button
            disabled={!!preview.errors.length}
            className="primary-small"
            onClick={() => apply(preview.rows)}
          >
            Apply calendar
          </button>
          <button className="secondary-small" onClick={() => setPreview(null)}>
            Cancel calendar import
          </button>
          <p>
            Matching names update dates and flags; other periods and historical
            executions are retained.
          </p>
        </div>
      )}
      <div className="report-filters">
        <label>
          Period name
          <input
            value={draft.id}
            onChange={(e) => setDraft({ ...draft, id: e.target.value })}
          />
        </label>
        <label>
          Start
          <input
            type="date"
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
        </label>
        <label>
          End
          <input
            type="date"
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
        </label>
      </div>
      <div className="phase1-actions">
        {(
          [
            ["quarterEnd", "Quarter end"],
            ["halfEnd", "Half-year end"],
            ["yearEnd", "Year end"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
            />{" "}
            {label}
          </label>
        ))}
        <button
          className="primary-small"
          onClick={() => apply([{ ...draft, id: draft.id.trim() }])}
        >
          Save period
        </button>
      </div>
      <div className="phase1-list">
        {state.calendar.map((p) => (
          <div key={p.id}>
            <strong>{p.id}</strong>
            <span>
              {p.start} → {p.end} {p.quarterEnd ? " · Quarter end" : ""}
              {p.yearEnd ? " · Year end" : ""}
            </span>
            <button onClick={() => setDraft(p)}>Edit</button>
          </div>
        ))}
      </div>
    </article>
  );
}
export function GuidanceInbox({
  role,
  controls,
  openControl,
}: {
  role: string;
  controls: InventoryControl[];
  openControl: (control: InventoryControl) => void;
}) {
  const { state, setState, currentUser } = usePhase1();
  const [filter, setFilter] = useState("All requests");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const requests = state.guidance.filter(
    (r) =>
      (role === "Controller Admin" || r.owner === currentUser) &&
      (filter === "All requests" || r.status === filter),
  );
  const update = (id: string, change: Partial<GuidanceRequest>) =>
    setState((s) => ({
      ...s,
      guidance: s.guidance.map((r) => (r.id === id ? { ...r, ...change } : r)),
    }));
  return (
    <section className="workspace-view phase1-panel">
      <div className="panel setup-card">
        <span className="section-kicker">Controllership guidance</span>
        <h2>
          {role === "Controller Admin"
            ? "Controller inbox"
            : "My guidance requests"}
        </h2>
        <p>
          Questions about controls go to the Controller team. Both sides can
          reply and track resolution here. This inbox is local to this browser;
          switch test roles to review the full journey. No email or Teams
          message is sent.
        </p>
        <label>
          Status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["All requests", "Open", "Answered", "Resolved"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {!requests.length && (
        <div className="panel empty-state">
          No requests in this view. Use “Ask for guidance” in a control.
        </div>
      )}
      {requests.map((request) => (
        <article className="panel setup-card" key={request.id}>
          <span className="section-kicker">
            {request.period} · {request.topic} · {request.urgency}
          </span>
          <h3>
            {controls.find((c) => c.id === request.controlId)?.name ||
              request.controlId}
          </h3>
          <p className="preserve-lines">{request.question}</p>
          <small>
            From {request.owner} ·{" "}
            {new Date(request.createdAt).toLocaleString()} · {request.status}
          </small>
          {request.messages.map((m, i) => (
            <div className="guidance-message" key={i}>
              <strong>
                {m.author} · {m.role}
              </strong>
              <small>{new Date(m.at).toLocaleString()}</small>
              <p className="preserve-lines">{m.text}</p>
            </div>
          ))}
          <label>
            Reply
            <textarea
              rows={3}
              value={replies[request.id] || ""}
              onChange={(e) =>
                setReplies({ ...replies, [request.id]: e.target.value })
              }
            />
          </label>
          <div className="phase1-actions">
            <button
              className="primary-small"
              disabled={!replies[request.id]?.trim()}
              onClick={() => {
                update(request.id, {
                  status: role === "Controller Admin" ? "Answered" : "Open",
                  messages: [
                    ...request.messages,
                    {
                      author: currentUser,
                      role,
                      text: replies[request.id].trim(),
                      at: new Date().toISOString(),
                    },
                  ],
                });
                setReplies({ ...replies, [request.id]: "" });
              }}
            >
              Save reply
            </button>
            <button
              className="secondary-small"
              onClick={() =>
                update(request.id, {
                  status: request.status === "Resolved" ? "Open" : "Resolved",
                })
              }
            >
              {request.status === "Resolved"
                ? "Reopen request"
                : "Mark resolved"}
            </button>
            <button
              className="text-link"
              onClick={() => {
                const c = controls.find((c) => c.id === request.controlId);
                if (c) openControl(c);
              }}
            >
              Open control
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
export function ReminderSetup({
  controls,
  period,
  openControl,
  notify,
}: {
  controls: InventoryControl[];
  period: string;
  openControl: (c: InventoryControl) => void;
  notify: (m: string) => void;
}) {
  const { state, setState, currentUser } = usePhase1();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [target, setTarget] = useState(controls[0]?.id || "");
  const [preview, setPreview] = useState<ReturnType<typeof reminderCandidates>>(
    [],
  );
  const [showLog, setShowLog] = useState(false);
  const generate = () => {
    if (!isDate(date)) return notify("Choose a valid simulation date");
    const candidates = reminderCandidates(
      controls,
      period,
      date,
      state.rules,
      currentUser,
    );
    setPreview(candidates);
    setShowLog(false);
    setState((s) => ({
      ...s,
      messages: [
        ...candidates.filter(
          (m) => !s.messages.some((old) => old.key === m.key),
        ),
        ...s.messages,
      ],
    }));
    notify(
      `${candidates.length} simulated reminders. Duplicate runs do not duplicate the log. No email sent.`,
    );
  };
  const readiness = () => {
    const c = controls.find((c) => c.id === target);
    if (!c || c.owner === "Unassigned")
      return notify("Choose an assigned control for the readiness notice");
    const id = crypto.randomUUID();
    const m = {
      id,
      key: id,
      controlId: c.id,
      period,
      recipient: c.owner,
      sender: currentUser,
      date,
      rule: "Readiness notice",
      subject: `ICEbreaker · prepare for review · ${c.controlNumber}`,
      body: `The Controller team will review ${c.name} (${c.unit}) shortly. Please ensure ownership is acknowledged, the DTP is current and evidence is ready. This does not certify the control.`,
    };
    setPreview([m]);
    setShowLog(false);
    setState((s) => ({ ...s, messages: [m, ...s.messages] }));
    notify("Readiness notice recorded in the simulation log. No email sent.");
  };
  const messages = showLog ? state.messages : preview;
  return (
    <div className="phase1-panel">
      <article className="panel setup-card">
        <span className="section-kicker">Simulation only</span>
        <h2>Reminder sequence & readiness notices</h2>
        <p>
          <strong>MVP behavior: no email is sent.</strong> These are manual
          previews, not background jobs. The enterprise handoff will use
          approved Microsoft Graph delivery and Azure scheduling.
        </p>
        <div className="phase1-actions">
          {REMINDER_RULES.map((rule) => (
            <label key={rule}>
              <input
                type="checkbox"
                checked={state.rules.includes(rule)}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    rules: e.target.checked
                      ? [...s.rules, rule]
                      : s.rules.filter((r) => r !== rule),
                  }))
                }
              />{" "}
              {rule}
            </label>
          ))}
        </div>
        <label>
          Simulation date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="phase1-actions">
          <button className="primary-small" onClick={generate}>
            Generate simulated reminders
          </button>
          <button
            className="secondary-small"
            onClick={() => setShowLog(!showLog)}
          >
            {showLog
              ? "Show preview"
              : `Simulation log (${state.messages.length})`}
          </button>
        </div>
        <p>
          Only assigned, active, uncertified controls scheduled for {period} are
          eligible. Overdue messages are generated once per control per
          simulated day.
        </p>
        <label>
          Readiness notice control
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose control</option>
            {controls
              .filter((c) => c.owner !== "Unassigned")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.controlNumber} · {c.unit} · {c.owner}
                </option>
              ))}
          </select>
        </label>
        <button className="secondary-small" onClick={readiness}>
          Preview readiness notice
        </button>
      </article>
      {!messages.length && (
        <div className="panel empty-state">
          No messages. Select a date matching a deadline rule and generate a
          preview.
        </div>
      )}
      {messages.map((m) => (
        <article className="panel setup-card email-preview" key={m.key}>
          <strong>{m.subject}</strong>
          <small>
            From: {m.sender} via ICEbreaker · To: {m.recipient} · {m.date} ·{" "}
            {m.period}
          </small>
          <p>{m.body}</p>
          <a
            href={`?control=${encodeURIComponent(m.controlId)}&period=${encodeURIComponent(m.period)}`}
          >
            Open direct control link
          </a>
          <button
            onClick={() => {
              const c = controls.find((c) => c.id === m.controlId);
              if (c) openControl(c);
            }}
          >
            Preview control in this period
          </button>
          <small>Simulated — not queued or delivered</small>
        </article>
      ))}
    </div>
  );
}
export function TestDirectory({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const { state, setState } = usePhase1();
  const [person, setPerson] = useState({ name: "", email: "", unit: "" });
  return (
    <article className="panel setup-card phase1-panel">
      <span className="section-kicker">Explicit test identities</span>
      <h2>Test account directory</h2>
      <p>
        Use synthetic names and example.test emails only. Select the active
        account in the bottom-left profile. These accounts demonstrate
        assignments; they are not authentication.
      </p>
      <div className="report-filters">
        {(["name", "email", "unit"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              value={person[key]}
              onChange={(e) => setPerson({ ...person, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="phase1-actions">
        <button
          className="primary-small"
          onClick={() => {
            if (
              !person.name.trim() ||
              !/^[^@\s]+@example\.test$/i.test(person.email.trim()) ||
              !person.unit.trim()
            )
              return notify(
                "Enter a unique test name, an example.test email and a unit",
              );
            if (
              state.people.some(
                (p) =>
                  p.name.toLowerCase() === person.name.trim().toLowerCase() ||
                  p.email.toLowerCase() === person.email.trim().toLowerCase(),
              )
            )
              return notify("That test name or email already exists");
            setState((s) => ({
              ...s,
              people: [
                ...s.people,
                {
                  name: person.name.trim(),
                  email: person.email.trim(),
                  unit: person.unit.trim(),
                },
              ],
            }));
            setPerson({ name: "", email: "", unit: "" });
            notify("Test account added");
          }}
        >
          Add test account
        </button>
        <button
          className="secondary-small"
          onClick={() => {
            setState((s) => ({
              ...s,
              people: [
                ...s.people,
                ...Array.from({ length: 120 }, (_, i) => ({
                  name: `Demo Test ${String(i + 1).padStart(3, "0")}`,
                  email: `test${i + 1}@example.test`,
                  unit: i % 2 ? "KLN" : "OBL",
                })).filter(
                  (p) =>
                    !s.people.some(
                      (old) => old.name === p.name || old.email === p.email,
                    ),
                ),
              ],
            }));
            notify(
              "Search-testing accounts added; existing assignments unchanged",
            );
          }}
        >
          Add 120 search-test accounts
        </button>
      </div>
      <small>{state.people.length} test accounts available</small>
    </article>
  );
}
export function BulkOwnership({
  controls,
  assign,
  shareDtp,
  notify,
}: {
  controls: InventoryControl[];
  assign: (ids: string[], owner: string) => void;
  shareDtp: (ids: string[], source: InventoryControl) => void;
  notify: (m: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [owner, setOwner] = useState("Unassigned");
  const [source, setSource] = useState("");
  const matches = controls.filter((c) =>
    `${c.controlNumber} ${c.name} ${c.unit} ${c.owner}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <article className="panel setup-card phase1-panel">
      <span className="section-kicker">Multi-unit setup</span>
      <h2>Bulk assignment & shared guidance</h2>
      <p>
        Assignments and DTP references can be reused. Every unit retains its own
        acknowledgement, evidence and certification. Certified controls cannot
        be reassigned in their certified period.
      </p>
      <label>
        Find controls
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Control, unit or owner"
        />
      </label>
      <div className="phase1-actions">
        <button onClick={() => setSelected(matches.map((c) => c.id))}>
          Select {matches.length} matching
        </button>
        <button onClick={() => setSelected([])}>Clear selection</button>
        <strong>{selected.length} selected</strong>
      </div>
      <div className="bulk-control-list">
        {matches.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, c.id]
                    : selected.filter((id) => id !== c.id),
                )
              }
            />
            <span>
              <strong>
                {c.controlNumber} · {c.unit}
              </strong>
              <small>
                {c.name} · {c.owner} · {c.status}
              </small>
            </span>
          </label>
        ))}
      </div>
      <OwnerPicker value={owner} onChange={setOwner} />
      <button
        className="primary-small"
        disabled={!selected.length}
        onClick={() => {
          if (
            window.confirm(
              `Assign ${selected.length} selected instances to ${owner}? Ownership acknowledgements will reset where the owner changes. Execution history remains.`,
            )
          )
            assign(selected, owner);
        }}
      >
        Apply assignment to selected
      </button>
      <label>
        Reuse DTP from
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Choose a documented control</option>
          {controls
            .filter((c) => c.dtpDocument || c.dtpSummary)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.controlNumber} · {c.unit} · {c.dtpVersion || "Unversioned"}
              </option>
            ))}
        </select>
      </label>
      <button
        className="secondary-small"
        disabled={!selected.length || !source}
        onClick={() => {
          const c = controls.find((c) => c.id === source);
          if (!c) return notify("Choose a source");
          if (
            window.confirm(
              "Copy a snapshot of this guidance to the selected controls? Existing versions are retained. Future source edits do not update copies automatically.",
            )
          )
            shareDtp(
              selected.filter((id) => id !== source),
              c,
            );
        }}
      >
        Reuse guidance for selected
      </button>
    </article>
  );
}
function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function BackupPanel({ notify }: { notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    metadata: Record<string, string>;
    files: LocalFile[];
  } | null>(null);
  const exportBackup = async () => {
    setBusy(true);
    try {
      const metadata = workspaceSnapshot();
      const files = await Promise.all(
        (await allLocalFiles()).map(async ({ data, ...file }) => ({
          ...file,
          data: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(data);
          }),
        })),
      );
      downloadJson(
        {
          format: "icebreaker-test-backup",
          version: 1,
          createdAt: new Date().toISOString(),
          metadata,
          files,
        },
        `ICEbreaker-test-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      notify("Backup downloaded, including local documents. Store it safely.");
    } catch {
      notify("Backup failed. Keep this tab open and check browser storage.");
    }
    setBusy(false);
  };
  const readBackup = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setPreview(null);
    try {
      if (file.size > 220 * 1024 * 1024)
        throw new Error("Backup exceeds 220 MB");
      const parsed = JSON.parse(await file.text());
      if (
        parsed.format !== "icebreaker-test-backup" ||
        parsed.version !== 1 ||
        !parsed.metadata ||
        !Array.isArray(parsed.files)
      )
        throw new Error("Not a supported ICEbreaker backup");
      const allowed = [
        "icebreaker-data-version",
        "icebreaker-control-definitions",
        "icebreaker-executions",
        "icebreaker-ownership-changes",
        "icebreaker-gaps",
        "icebreaker-audit-events",
        "icebreaker-saved-views",
        "icebreaker-attachments",
        "icebreaker-scope",
        "icebreaker-phase1",
      ];
      const metadata = Object.fromEntries(
        Object.entries(parsed.metadata).filter(([key]) =>
          allowed.includes(key),
        ),
      ) as Record<string, string>;
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value !== "string")
          throw new Error("Invalid backup metadata");
        if (key !== "icebreaker-data-version") JSON.parse(value);
      }
      const definitions = JSON.parse(
        metadata["icebreaker-control-definitions"] || "null",
      );
      if (
        !Array.isArray(definitions) ||
        !definitions.length ||
        definitions.some(
          (c) =>
            !c.id || !c.controlNumber || !c.name || !c.attestationFrequency,
        )
      )
        throw new Error("Backup has invalid control definitions");
      const p1 = JSON.parse(metadata["icebreaker-phase1"] || "null");
      if (
        p1 &&
        (!Array.isArray(p1.people) ||
          !Array.isArray(p1.guidance) ||
          !Array.isArray(p1.messages) ||
          !Array.isArray(p1.rules) ||
          !Array.isArray(p1.calendar) ||
          validateCalendar(p1.calendar).length)
      )
        throw new Error("Backup has invalid Phase 1 settings");
      const files: LocalFile[] = parsed.files.map(
        (f: {
          id: string;
          name: string;
          type: string;
          data: string;
          createdAt: string;
        }) => {
          if (
            !f.id ||
            !f.name ||
            typeof f.data !== "string" ||
            !/^data:[^,]*;base64,/.test(f.data)
          )
            throw new Error("Invalid document in backup");
          const bytes = Uint8Array.from(atob(f.data.split(",")[1]), (c) =>
            c.charCodeAt(0),
          );
          return { ...f, data: new Blob([bytes], { type: f.type }) };
        },
      );
      setPreview({ metadata, files });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Invalid backup");
    }
    setBusy(false);
  };
  const restore = async () => {
    if (
      !preview ||
      !window.confirm(
        "Replace this browser's test workspace with the selected backup? Export your current workspace first. This does not affect any other browser.",
      )
    )
      return;
    setBusy(true);
    const old = Object.fromEntries(
      Object.keys(preview.metadata).map((key) => [
        key,
        localStorage.getItem(key),
      ]),
    );
    try {
      await restoreLocalFiles(preview.files);
      for (const [key, value] of Object.entries(preview.metadata))
        localStorage.setItem(key, value);
      window.location.reload();
    } catch (e) {
      for (const [key, value] of Object.entries(old)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      notify(
        e instanceof Error
          ? e.message
          : "Restore failed; prior metadata restored",
      );
      setBusy(false);
    }
  };
  return (
    <article className="panel setup-card phase1-panel">
      <span className="section-kicker">Local testing continuity</span>
      <h2>Backup & restore</h2>
      <p>
        Backups contain test records and uploaded documents. Use non-sensitive
        test material only; protect the exported file. Browser clearing, storage
        eviction or changing device can remove local data. This is not an
        enterprise backup service.
      </p>
      <div className="phase1-actions">
        <button
          className="primary-small"
          disabled={busy}
          onClick={exportBackup}
        >
          Export test workspace with documents
        </button>
        <label className="secondary-small">
          Choose backup
          <input
            type="file"
            accept=".json"
            disabled={busy}
            onChange={(e) => {
              void readBackup(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {preview && (
        <div className="import-preview">
          <strong>
            Validated backup · {preview.files.length} files ·{" "}
            {Object.keys(preview.metadata).length} data sections
          </strong>
          <button className="primary-small" disabled={busy} onClick={restore}>
            Restore this backup
          </button>
          <button className="secondary-small" onClick={() => setPreview(null)}>
            Cancel restore
          </button>
        </div>
      )}
    </article>
  );
}
export function OperationalReport({
  controls,
  gaps,
  pending,
}: {
  controls: InventoryControl[];
  gaps: {
    controlId: string;
    status: string;
    title: string;
    owner: string;
    due: string;
    serviceNowReference?: string;
  }[];
  pending: { controlId: string; status?: string }[];
}) {
  const { state } = usePhase1();
  const ids = new Set(controls.map((c) => c.id));
  const rows = [
    [
      "Pending reassignments",
      pending.filter((r) => r.status === "Requested" && ids.has(r.controlId))
        .length,
    ],
    [
      "Open guidance",
      state.guidance.filter(
        (r) => r.status !== "Resolved" && ids.has(r.controlId),
      ).length,
    ],
    [
      "Open gaps",
      gaps.filter((g) => g.status !== "Closed" && ids.has(g.controlId)).length,
    ],
  ];
  return (
    <article className="panel setup-card phase1-panel">
      <h3>Follow-up workload · filtered controls</h3>
      <div className="phase1-actions">
        {rows.map(([label, count]) => (
          <span key={String(label)}>
            <strong>{count}</strong> {label}
          </span>
        ))}
        <button
          className="secondary-small"
          onClick={() => {
            const lines = [
              [
                "Control",
                "Gap",
                "Owner",
                "Due",
                "Status",
                "ServiceNow reference",
              ],
              ...gaps
                .filter((g) => ids.has(g.controlId))
                .map((g) => [
                  g.controlId,
                  g.title,
                  g.owner,
                  g.due,
                  g.status,
                  g.serviceNowReference || "",
                ]),
            ];
            const url = URL.createObjectURL(
              new Blob(
                [lines.map((row) => row.map(csvCell).join(",")).join("\n")],
                { type: "text/csv" },
              ),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "ICEbreaker-gap-extract.csv";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          }}
        >
          Download filtered gaps
        </button>
      </div>
      <small>
        Counts include follow-ups across periods for the selected control
        instances. This extract is not a live ServiceNow integration.
      </small>
    </article>
  );
}
