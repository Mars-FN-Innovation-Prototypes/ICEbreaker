# ICEbreaker — Digitalized Controls Hub

ICEbreaker is a scalable controls workspace for Mars Food & Nutrition. The first MVP pilot focuses on Europe inventory controls and Control Owners/Reviewers, while the information model and navigation are designed to support additional regions and control families.

## Phase 1 capabilities

- 132 stakeholder-provided control instances across ICE and Sustainability pillars, modeled by control number + region + country + unit so one definition can recur in multiple scopes.
- Controller-only reporting with saved filters, leadership/site/controller dashboards, CSV extracts and ownership-change reporting.
- Period-specific control assignments, status, evidence, acknowledgements and certification.
- Control Owner workflow with separately saved ownership acknowledgement and execution progress, explicit deviation outcomes, DTP review, evidence and final certification.
- Reassignment with required handover and training confirmation.
- Admin maintenance for scope, controls, applicability, evidence rules, instructions and desktop procedures (DTPs), plus Control Owner DTP proposals and version history.
- Native Excel `.xlsx` mass upload with validation and preview.
- Lightweight gap remediation with ownership, due date, severity, closure evidence and Controller approval.
- Simulated reminder sequence with direct-control-link behavior.

Control preparer workflows, predictive analytics, ServiceNow integration and advanced collaboration remain outside Phase 1.

## Prototype architecture

The public GitHub Pages build is a client-side MVP. Definitions, period execution records, evidence filenames, reassignment history, remediation gaps and audit events are separated in the application model and persisted in the browser for testing. Eight representative instances are assigned to the Demo Account; the remaining imported ownership fields intentionally start unassigned.

For enterprise deployment, retain the React application and replace local persistence with:

- Microsoft Entra ID / SSO for identity and role claims.
- GCP-hosted application services and governed data storage.
- Object storage for evidence and DTP files.
- Microsoft Graph or an approved enterprise mail service for reminders.
- Server-enforced authorization, retention and immutable audit logging.

No sensitive production data should be entered into the public prototype.

## Local development

```sh
npm install
npm run dev
npm test
```
