"use client";

import { useMemo, useState } from "react";

type Status = "On track" | "Ready for review" | "At risk" | "Overdue";

type Control = {
  id: string;
  name: string;
  process: string;
  frequency: string;
  status: Status;
  owner: string;
  reviewer: string;
  region: string;
  unit: string;
  due: string;
  evidence: number;
  keyControl: boolean;
  type: string;
};

const controls: Control[] = [
  { id: "GA.BS.01", name: "Performance of Balance Sheet Account Reconciliations", process: "Balance Sheet Reconciliations", frequency: "Periodic", status: "Overdue", owner: "Ari Patel", reviewer: "MGSF Operations Manager", region: "Europe", unit: "Petcare", due: "Jul 14", evidence: 0, keyControl: true, type: "Manual with IT Dependency" },
  { id: "GA.PE.02", name: "Review of Fluctuation Analysis", process: "Period End", frequency: "Periodic", status: "At risk", owner: "Nina Costa", reviewer: "S&F Head", region: "LATAM", unit: "Snacking", due: "Today", evidence: 1, keyControl: true, type: "Manual with IT Dependency" },
  { id: "GA.JE.05", name: "Manual Journal Entry Approval", process: "Journal Entries", frequency: "Periodic", status: "Ready for review", owner: "Jordan Lee", reviewer: "S&F Head or Delegate", region: "North America", unit: "Food & Nutrition", due: "Jul 18", evidence: 3, keyControl: true, type: "Manual with IT Dependency" },
  { id: "GA.PE.10", name: "Reporting Package Review", process: "Period End", frequency: "Quarterly", status: "On track", owner: "Sofia Martin", reviewer: "Business Unit Controller", region: "Europe", unit: "Snacking", due: "Jul 22", evidence: 2, keyControl: true, type: "Manual with IT Dependency" },
  { id: "GA.IC.01", name: "Review of Intercompany Balances", process: "Intercompany", frequency: "Periodic", status: "At risk", owner: "Marcus Chen", reviewer: "MGSF Operations", region: "Asia", unit: "Petcare", due: "Jul 17", evidence: 0, keyControl: true, type: "Manual with IT Dependency" },
  { id: "GA.SD.01", name: "Segregation of Duties Review (Business Unit)", process: "Segregation of Duties", frequency: "Semi-Annual", status: "On track", owner: "Priya Rao", reviewer: "Appropriate Associate", region: "Asia", unit: "Food & Nutrition", due: "Jul 29", evidence: 4, keyControl: true, type: "Manual" },
  { id: "GA.MD.03", name: "Maintenance of General Accounting Master Data", process: "Master Data", frequency: "Annually", status: "Ready for review", owner: "Owen Brooks", reviewer: "Business Unit Controller", region: "North America", unit: "Petcare", due: "Jul 20", evidence: 2, keyControl: false, type: "Manual with IT Dependency" },
  { id: "GA.PD.01", name: "Local process documentation and desktop procedures review", process: "Process Documentation", frequency: "Annually", status: "On track", owner: "Leila Haddad", reviewer: "Appropriate Associate", region: "MEA", unit: "Food & Nutrition", due: "Aug 02", evidence: 5, keyControl: true, type: "Manual" },
];

const statusClass: Record<Status, string> = {
  "On track": "success",
  "Ready for review": "review",
  "At risk": "warning",
  Overdue: "danger",
};

const roleCopy = {
  Controller: { eyebrow: "Control tower", title: "See risk sooner. Act before it grows.", body: "A live view of control health across teams, regions and business units." },
  Preparer: { eyebrow: "My control work", title: "Know what is due. Prove what is done.", body: "One guided workspace for instructions, evidence and ownership." },
  Reviewer: { eyebrow: "Review queue", title: "Review the right evidence, right on time.", body: "Prioritized submissions with context, history and clear next actions." },
};

export default function Home() {
  const [role, setRole] = useState<keyof typeof roleCopy>("Controller");
  const [activeNav, setActiveNav] = useState("Control tower");
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [selected, setSelected] = useState<Control | null>(null);

  const filtered = useMemo(() => {
    return controls.filter((control) => {
      const matchesQuery = `${control.id} ${control.name} ${control.process} ${control.owner} ${control.region}`.toLowerCase().includes(query.toLowerCase());
      const matchesAttention = !attentionOnly || control.status === "At risk" || control.status === "Overdue";
      return matchesQuery && matchesAttention;
    });
  }, [query, attentionOnly]);

  const copy = roleCopy[role];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-lockup" src="/brand/logo-lockup.png" alt="Mars Food & Nutrition" />
          <div className="product-name"><span className="ice-dot" />ICEbreaker</div>
          <p>Digitalized Controls Hub</p>
        </div>

        <nav aria-label="Primary navigation">
          {[
            ["Control tower", "⌁"],
            ["My work", "✓"],
            ["Controls library", "▦"],
            ["Audit center", "◎"],
          ].map(([item, icon]) => (
            <button key={item} className={activeNav === item ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(item)}>
              <span aria-hidden="true">{icon}</span>{item}
              {item === "My work" && <b>6</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="purpose-card">
          <img src="/brand/better-food-text.png" alt="Better food today. A better world tomorrow." />
          <p>Controls that protect trust in every decision.</p>
        </div>
        <button className="profile-card" aria-label="Open user profile">
          <span>ES</span><span><strong>Erica Schmidt</strong><small>Global Controller</small></span><i>•••</i>
        </button>
      </aside>

      <main>
        <header className="topbar">
          <div className="mobile-brand">ICEbreaker</div>
          <label className="global-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search controls, owners or IDs" aria-label="Search controls" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="header-actions">
            <button className="icon-button" aria-label="Help">?</button>
            <button className="icon-button notification" aria-label="Notifications">♢<span /></button>
            <div className="role-switch" aria-label="Change prototype role">
              {(["Controller", "Preparer", "Reviewer"] as const).map((item) => (
                <button key={item} className={role === item ? "selected" : ""} onClick={() => setRole(item)}>{item}</button>
              ))}
            </div>
          </div>
        </header>

        <div className="content">
          <section className="hero">
            <div>
              <div className="eyebrow"><span />{copy.eyebrow}</div>
              <h1>{copy.title}</h1>
              <p>{copy.body}</p>
            </div>
            <div className="hero-date"><span>Reporting period</span><strong>July 2026</strong><button aria-label="Change period">⌄</button></div>
          </section>

          <section className="purpose-line">
            <strong>Today, we’re making control health visible.</strong>
            <span>Because in the world we want tomorrow, every risk gets the right attention at the right time.</span>
          </section>

          <section className="metrics" aria-label="Control health summary">
            <article><div className="metric-icon blue">▦</div><div><span>Controls in scope</span><strong>31</strong><small>16 key controls</small></div></article>
            <article><div className="metric-icon green">✓</div><div><span>On-time execution</span><strong>84%</strong><small className="up">↑ 6% vs. last period</small></div></article>
            <article><div className="metric-icon orange">!</div><div><span>Need attention</span><strong>6</strong><small>3 missing evidence</small></div></article>
            <article><div className="metric-icon water">⌁</div><div><span>Review turnaround</span><strong>1.8d</strong><small className="up">0.4d faster</small></div></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel health-panel">
              <div className="panel-heading"><div><span className="section-kicker">Live control health</span><h2>Execution at a glance</h2></div><button className="text-button">View report →</button></div>
              <div className="health-content">
                <div className="donut" aria-label="84 percent healthy"><div><strong>84%</strong><span>healthy</span></div></div>
                <div className="legend">
                  <div><span className="legend-dot on-track" /><span>On track</span><strong>20</strong></div>
                  <div><span className="legend-dot in-review" /><span>In review</span><strong>5</strong></div>
                  <div><span className="legend-dot at-risk" /><span>At risk</span><strong>4</strong></div>
                  <div><span className="legend-dot overdue" /><span>Overdue</span><strong>2</strong></div>
                </div>
                <div className="region-bars">
                  {[['North America', 92], ['Europe', 86], ['Asia', 82], ['LATAM', 71]].map(([label, value]) => (
                    <div key={label as string}><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}%</strong></div>
                  ))}
                </div>
              </div>
            </article>

            <article className="panel attention-panel">
              <div className="panel-heading"><div><span className="section-kicker orange-text">Prioritized</span><h2>Needs your attention</h2></div><span className="count-badge">6 items</span></div>
              <button className="attention-item" onClick={() => setSelected(controls[0])}><span className="alert-icon danger-bg">!</span><span><strong>Evidence missing</strong><small>GA.BS.01 · Europe · 2 days overdue</small></span><b>›</b></button>
              <button className="attention-item" onClick={() => setSelected(controls[1])}><span className="alert-icon warning-bg">◷</span><span><strong>Due today, reviewer unassigned</strong><small>GA.PE.02 · LATAM · Key control</small></span><b>›</b></button>
              <button className="attention-item" onClick={() => setSelected(controls[4])}><span className="alert-icon warning-bg">?</span><span><strong>Preparer asked for guidance</strong><small>GA.IC.01 · Asia · Intercompany</small></span><b>›</b></button>
              <button className="attention-cta" onClick={() => setAttentionOnly(!attentionOnly)}>{attentionOnly ? "Show all controls" : "Open gap triage"}<span>→</span></button>
            </article>
          </section>

          <section className="panel controls-panel">
            <div className="panel-heading controls-heading">
              <div><span className="section-kicker">Control workspace</span><h2>{attentionOnly ? "Controls needing attention" : "Upcoming & active controls"}</h2></div>
              <div className="table-actions"><button>☷ Filters <span>2</span></button><button>⇩ Export</button></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Control</th><th>Owner</th><th>Region / unit</th><th>Due</th><th>Evidence</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {filtered.map((control) => (
                    <tr key={control.id} onClick={() => setSelected(control)}>
                      <td><div className="control-title"><span>{control.id}</span><strong>{control.name}</strong><small>{control.process} · {control.frequency}{control.keyControl ? " · Key" : ""}</small></div></td>
                      <td><div className="owner"><span>{control.owner.split(" ").map((part) => part[0]).join("")}</span><strong>{control.owner}</strong></div></td>
                      <td><strong className="cell-main">{control.region}</strong><small className="cell-sub">{control.unit}</small></td>
                      <td><strong className="cell-main">{control.due}</strong><small className="cell-sub">2026</small></td>
                      <td><span className={control.evidence ? "evidence has-evidence" : "evidence"}>▱ {control.evidence}</span></td>
                      <td><span className={`status ${statusClass[control.status]}`}><i />{control.status}</span></td>
                      <td><button className="row-arrow" aria-label={`Open ${control.id}`}>›</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="empty-state"><strong>No controls match this view.</strong><span>Try a different search or clear the attention filter.</span></div>}
            </div>
            <div className="table-footer"><span>Showing {filtered.length} of 31 controls</span><button>View all controls →</button></div>
          </section>
        </div>
      </main>

      {selected && <>
        <button className="drawer-scrim" onClick={() => setSelected(null)} aria-label="Close control details" />
        <aside className="control-drawer" aria-label="Control detail panel">
          <div className="drawer-header"><span className={`status ${statusClass[selected.status]}`}><i />{selected.status}</span><button onClick={() => setSelected(null)} aria-label="Close">×</button></div>
          <div className="drawer-body">
            <span className="control-id">{selected.id}{selected.keyControl && <b>Key control</b>}</span>
            <h2>{selected.name}</h2>
            <p className="drawer-intro">Confirm the control was performed, upload complete evidence, and route it to the assigned reviewer.</p>
            <div className="progress-steps"><div className="done"><i>✓</i><span>Owned<small>Attested Jul 08</small></span></div><div className={selected.evidence ? "done" : "current"}><i>{selected.evidence ? "✓" : "2"}</i><span>Evidence<small>{selected.evidence ? `${selected.evidence} files uploaded` : "Upload required"}</small></span></div><div><i>3</i><span>Review<small>{selected.reviewer}</small></span></div></div>
            <div className="detail-grid"><div><span>Owner</span><strong>{selected.owner}</strong></div><div><span>Due date</span><strong>{selected.due}, 2026</strong></div><div><span>Region</span><strong>{selected.region}</strong></div><div><span>Control type</span><strong>{selected.type}</strong></div></div>
            <section className="drawer-section"><div><span className="section-kicker">What good looks like</span><h3>Execution guidance</h3></div><button className="guidance-card"><span>▤</span><span><strong>Best-practice instruction</strong><small>5-minute read · Updated Jun 2026</small></span><b>↗</b></button><button className="guidance-card"><span>▱</span><span><strong>Past accepted evidence</strong><small>View 4 examples from prior periods</small></span><b>›</b></button></section>
            <section className="drawer-section"><div><span className="section-kicker">Ownership</span><h3>People & support</h3></div><div className="people-row"><span className="avatar orange-avatar">{selected.owner.split(" ").map((part) => part[0]).join("")}</span><span><small>Preparer</small><strong>{selected.owner}</strong></span><button>Reassign</button></div><div className="people-row"><span className="avatar blue-avatar">MR</span><span><small>Reviewer</small><strong>{selected.reviewer}</strong></span><button>Message</button></div></section>
          </div>
          <div className="drawer-footer"><button className="secondary-button">Ask for guidance</button><button className="primary-button">{selected.evidence ? "Open review" : "Upload evidence"}</button></div>
        </aside>
      </>}
    </div>
  );
}
