# ICEbreaker — Digitalized Controls Hub

ICEbreaker is a scalable controls workspace for Mars Food & Nutrition. The first MVP pilot focuses on Europe inventory controls and Control Owners/Reviewers, while the information model and navigation are designed to support additional regions and control families.

## Phase 1 capabilities

- 132 stakeholder-provided control instances across ICE and Sustainability pillars, modeled by control number + region + country + unit so one definition can recur in multiple scopes.
- Controller-only reporting with saved filters, clear-all controls, leadership/site/controller dashboards, pillar views, CSV extracts and ownership-activity reporting.
- Period-specific control assignments, status, evidence, acknowledgements and certification.
- Control Owner workflow with separately saved ownership acknowledgement, partial drafts, explicit execution outcomes, DTP review, evidence and final certification.
- Reassignment requests with handover/training readiness confirmations and a Controller-visible review flag; the prototype never silently changes the assigned owner.
- Admin maintenance for scope, controls, lifecycle, explicit evidence rules, instructions and desktop procedures (DTPs), plus Control Owner DTP maintenance and version history.
- Evidence upload plus SharePoint/reference links. Evidence requirements start `Not scoped` and are set only by upload or Controller Admin action; they are never inferred.
- Active, not-applicable and archived lifecycle states retain control history instead of deleting records.
- Native Excel `.xlsx` mass upload with validation and preview.
- Direct Controller visibility of owner drafts, deviations, non-performance, overdue work and evidence exceptions. Lightweight gap remediation is retained for testing but is not being expanded in this iteration.
- Simulated reminder sequence with direct-control-link behavior.

Control preparer workflows, predictive analytics, ServiceNow integration and advanced collaboration remain outside Phase 1.

## Prototype architecture

The public GitHub Pages build is a client-side MVP. Definitions, period execution records, evidence filenames/links, reassignment requests, remediation gaps and audit events are separated in the application model and persisted in the browser for testing. Eight representative instances are assigned to the Demo Account; the remaining imported ownership fields intentionally start unassigned. Control Owners can read all DTP guidance, but period evidence is exposed only for controls assigned to the active Demo Account.

For enterprise deployment, retain the React application and replace local persistence with:

- Microsoft Entra ID / SSO for identity and role claims.
- GCP-hosted application services and governed data storage.
- Governed object storage and/or approved SharePoint references for evidence and DTP files.
- Microsoft Graph or an approved enterprise mail service for reminders.
- Server-enforced authorization, retention and immutable audit logging.

No sensitive production data should be entered into the public prototype.

## Local development

```sh
npm install
npm run dev
npm test
```
