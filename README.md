# ICEbreaker — Digitalized Controls Hub

ICEbreaker is a scalable controls workspace for Mars Food & Nutrition. The first MVP pilot focuses on Europe inventory controls and Control Owners/Reviewers, while the information model and navigation are designed to support additional regions and control families.

## Phase 1 capabilities

- 132 stakeholder-provided control instances across ICE and Sustainability pillars, modeled by control number + region + country + unit so one definition can recur in multiple scopes.
- Controller-only reporting with saved filters, clear-all controls, leadership/site/controller dashboards, pillar views, CSV extracts and ownership-activity reporting.
- Period-specific control assignments, status, evidence, acknowledgements and certification.
- Control Owner workflow with separately saved ownership acknowledgement, partial drafts, explicit execution outcomes, DTP review, evidence and final certification.
- Reassignment requests with completed handover/training confirmations and explicit Controller approval; the prototype never silently changes the assigned owner.
- Admin maintenance for scope, controls, lifecycle, explicit evidence rules, instructions and desktop procedures (DTPs), plus Control Owner DTP maintenance and version history.
- Evidence upload plus SharePoint/reference links. Evidence requirements start `Not scoped` and are set only by upload or Controller Admin action; they are never inferred.
- Active, not-applicable and archived lifecycle states retain control history instead of deleting records.
- Native Excel `.xlsx` mass upload with validation and preview.
- Direct Controller visibility of owner drafts, deviations, non-performance, overdue work and evidence exceptions. Lightweight gap remediation supports ownership, dates, status, closure approval and an external ServiceNow reference.
- Simulated reminder sequence with direct-control-link behavior.

Control preparer workflows, predictive analytics, ServiceNow integration and advanced collaboration remain outside Phase 1.

## Prototype architecture

The public GitHub Pages build is a client-side MVP. Definitions, period execution records, file references, reassignment requests, remediation gaps and audit events are separated in the application model and persisted in the browser for testing. Actual document bytes are stored in IndexedDB. Eight representative instances initially belong to Demo Account; other controls start unassigned. Control Owners can read all DTP guidance, but the UI exposes period evidence only for assignments to the active test account. These are demo restrictions, not server security.

For the intended Azure enterprise handoff (not provisioned), retain the React application and replace local persistence with:

- Microsoft Entra ID / SSO for identity and role claims.
- EA-approved Azure application hosting, relational data storage and scheduled jobs.
- Governed object storage and/or approved SharePoint references for evidence and DTP files.
- Microsoft Graph or an approved enterprise mail service for reminders.
- Server-enforced authorization, retention and immutable audit logging.

No sensitive production data should be entered into the public prototype.

## September Phase 1 testing release

- Controller calendar setup/import, quarterly/annual queue visibility and period/week deadlines. Original cycle keys are retained; no official Mars calendar is invented.
- Explicit test account directory/search and bottom-left identity/role switch. Approved reassignment resets acknowledgement, retains prior work and leaves certified ownership intact.
- Read-only global descriptions with separate local instructions. Validated Controller imports remain the framework maintenance path.
- IndexedDB file storage (20 MB/file, 150 MB workspace), downloadable DTP/evidence, prior document versions and shared DTP snapshots across unit instances.
- Controller guidance inbox and Owner conversations with resolution states. Everything stays in one browser; this is not multi-user collaboration.
- Centrally configured, frequency-based reminder simulations: Periodic 7/2/0, Quarterly 14/7/2/0, Annual 28/14/7/2/0 calendar days before/on the deadline. Owner follow-ups on overdue days 1/8/15… and Controller escalation at day 7; daily recipient digests with deduplication. Other frequencies require configuration. Separate readiness and weekly unanswered-guidance previews. No background jobs or real emails.
- Visible searchable Owner results, predefined frequency choices with effective-period history, safe deletion of unused periods, guidance filters/pending-response badges, and one-step DTP confirmation with a read-only review date.
- Editable external ServiceNow reference distinct from permanent gap ID, filtered gap extracts, saved-view deletion, and test-data backup/restore including files.
- Walkthrough: `public/ICEbreaker-Phase-1-Review.html` (linked from Help center).

Keep existing browser storage version `stakeholder-feedback-v2` to preserve prior test data. New settings use `icebreaker-phase1`; new files use the `icebreaker-local-files` IndexedDB database. Original filename-only entries remain visible but require re-upload to retrieve content. Role restrictions are UI demonstrations, not security boundaries.

### Verification

`node --test tests/phase1-domain.test.mjs` validates scheduling, reminders and assignment rules. `tests/phase1-ui.mjs` runs isolated browser tests against a local build; set `PLAYWRIGHT_PATH` when using a bundled Playwright installation. Browser tests use only synthetic files and fresh browser contexts.

## Local development

```sh
npm install
npm run dev
npm test
```
