# ICEbreaker — hardening and enterprise handoff

Status: hardened **prototype**, not production-ready. Reviewed 24 September 2026, from live baseline `209beb5`. No Azure resources, corporate identity permissions, production traffic or real emails were changed. Hardening is delivered as a separately reviewed source change, not an automatic production promotion.

## Executive outcome

The business workflows and Mars visual design are retained. The immediate work reduces dependency exposure, protects local test records from silent replacement, bounds untrusted imports, and adds repeatable verification. The current role switch, local files and audit records remain demonstrations. They cannot protect enterprise controls/evidence or support multiple concurrent employees.

## Review findings and treatment

| Priority | Finding | Treatment / remaining gate |
|---|---|---|
| P0 | No trusted identity or server-side role/scope checks | Explicit enterprise/production build guard; enterprise APIs and Entra integration still required. Never trust role/email/unit sent by the browser. |
| P0 | Local records, evidence and audit can be read/changed in the browser | Prototype warning retained. Move to transactional SQL, private evidence storage and server-written audit before real data. Local recovery does not make records authoritative. |
| P1 | Malformed JSON or unfamiliar version could be replaced by defaults | Shared bounded schemas, version checks, blocked writes, whole-workspace recovery screen and export. Original persisted data and unsaved snapshot can be exported separately. No automatic reset/deletion. |
| P1 | Multiple tabs silently overwrite each other | Storage-event and write-time conflict detection pauses stale tabs. This is best-effort local protection, not a distributed transaction; enterprise must use versioned writes/ETags. |
| P1 | Restore accepts weakly checked data/files and may overwrite a file ID | Complete-backup/schema validation, file/reference checks, per-file/total limits and canonical types. Conflicting immutable document IDs are refused. Files merge without deleting existing evidence. Metadata rollback is attempted on failure. SQL/object storage coordinated recovery is still required. |
| P1 | Excel imports/Office archives could exhaust memory or carry unexpected formats | 5 MiB workbook, 5,000 rows, 60 columns, 50,000 characters/cell; bounded ZIP directory and streamed actual-expansion checks before XML parsing. Macro/encrypted/ZIP64 and malformed archives rejected. This is not antivirus/CDR. |
| P1 | 25 dependency audit findings in baseline, including unused server stack | Removed Next/vinext/RSC/Cloudflare/Drizzle starter runtime from this static app; conventional React + TypeScript + Vite build. Updated and pinned dependencies/lockfile. Audit gate now required; see current CI result rather than treating a clean snapshot as permanent. |
| P1 | Release checks were manual, no protected promotion boundary | Read-only-token CI: lint, types, unit/negative tests, browser workflows, audit, Pages artifact and size/security checks. Official actions pinned by commit. No cloud credentials or automatic deployment. Repository branch protection/reviewer assignment still needs the repo owner. |
| P2 | Untrusted external URLs and browser execution policy | HTTPS-only source links without embedded credentials/control characters, explicit noreferrer/noopener. Built-page CSP disallows inline scripts, eval, objects and off-origin connections. Styles allow inline values used by the app; blob workers support Excel processing. Enterprise must add response headers including frame-ancestors/HSTS/nosniff/Permissions-Policy. |
| P2 | Exceptions could produce a blank app; document store can hang | Top-level recovery boundary, safe non-content error copy, bounded IndexedDB-open wait. No raw evidence/body logging added. Full observability is an enterprise integration. |
| P2 | Large initial bundle and monolithic UI | Spreadsheet parsing/writing is lazy-loaded; compressed JS budget is enforced. The large workspace component should be split by feature behind tested domain/service boundaries in the next backend tranche, not through an untested wholesale rewrite. |

The dependency scanner reports packages, not proven exploitability on GitHub Pages. The public deployment did not run the removed Node/Cloudflare server runtime. Removing it also prevents accidental promotion of a development starter as the enterprise backend.

## Current implemented stack

- Front end: React, TypeScript, Vite; static HTML prerendered during build, no live React Server Components or Node app server.
- State: validated localStorage metadata; IndexedDB document bytes. Same existing storage keys/data version for compatible workspaces.
- Testing: Node tests, TypeScript, ESLint, Playwright browser workflows and negative cases.
- Distribution: existing GitHub Pages artifact remains supported at `/ICEbreaker/`; no cloud dependency is introduced.
- Middleware/backend: **none** in the prototype. An empty database schema and unused ChatGPT-auth helper were removed; they did not constitute a backend or corporate sign-in.

## Proposed Azure target (EA approval required)

Preserve the UI. Add one application API and a small worker using the enterprise-supported runtime, not microservices by default. Container Apps or App Service are candidates; EA must assign subscription, region, ingress, DNS and runtime. Use Entra tenant-restricted identity, explicit application roles/scopes, Azure SQL for transactional control/execution records, private Blob storage or an approved governed evidence source, managed identities, and an approved secret store. A SQL outbox plus scheduled worker can support reminders initially.

Microsoft's [Container Apps authentication guidance](https://learn.microsoft.com/en-us/azure/container-apps/authentication) provides an entry mechanism, but explicitly distinguishes finer application authorization. Apply scope/ownership checks in the API on every operation and file download. Do not trust forwarded identity headers unless only the validated corporate ingress can supply them; alternatively validate Entra JWT signature, issuer, audience, tenant and expiry through approved middleware.

The current PDS hardening record is useful for governance and fail-closed behavior, **not an Azure approval**. PDS currently runs a GCP/IAP non-persistent pilot; ICEbreaker needs durable business records. Do not copy PDS resource names, roles, no-persistence design or access groups. Source reviewed: PDS `docs/HARDENING_PROGRESS_2026-09-24.md` and the shared enterprise delivery/checklist documents.

## Backend implementation contract

Separate framework definitions from scoped instances, and instances from period executions. Use immutable IDs rather than names/email as join keys. Minimum aggregates: control definitions; scoped instances; approved calendar periods; execution/acknowledgement records; users and scope grants; versioned procedures/evidence; reassignment requests; gaps; guidance threads; saved reports; append-only audit; notification outbox/delivery attempts.

| Operation | Required server behavior |
|---|---|
| List/search/report | Apply caller's scope before filtering/counting/pagination/export. Stable sort and bounded page size. No fetching all evidence to the browser. |
| Acknowledge / draft / certify | Caller is the assigned active Owner; authoritative period/requirements; exact booleans/enums; optimistic version; immutable certified snapshot. Certification validates evidence/procedure readiness inside the transaction. |
| Controller corrections / schedule changes | Explicit admin role plus region/unit scope; require reason; preserve prior version and completed certification; audit old/new values. |
| Reassignment | Handover/training confirmation plus Controller approval; new Owner acknowledges independently; certified historical ownership never overwritten. |
| Evidence | Authorize control + period + document on every request; upload to quarantine, verify size/type, malware scan, then publish clean version; server-generated opaque IDs and short-lived download authorization. No arbitrary server URL fetching. |
| Gap closure | Evidence and Controller approval checked server-side; external ServiceNow ID remains a reference, not implicit approval. |
| Import / backup | Stage, validate, preview and commit transactionally; reject invalid/duplicate scope keys; idempotency key; reconciliation report. Never trust prototype audit as enterprise user evidence. |
| Reminders | Durable outbox, recipient/day idempotency, approved sender/recipient policy, retries/backoff/dead-letter visibility, stop after certification, pause switch. Graph acceptance is not delivery confirmation. |

Use consistent request/response schemas, parameterized queries, maximum body sizes, cancellation/deadlines, validated sort/filter columns, 401/403/409/422/429 handling, request IDs, and no internal exception details. If cookie sessions are selected, add Secure/HttpOnly/SameSite cookies, CSRF validation and session expiry; if bearer tokens are selected, no long-lived tokens in localStorage. Do not implement two authentication patterns without a reason.

## Production blockers, owners and acceptance evidence

| Gate | Owner needed | Evidence before go-live |
|---|---|---|
| Landing zone and data classification | EA / Security / data owner | Approved host, residency, classification, retention/legal-hold, privacy/vendor/security reviews; named non-production and production resources. |
| Corporate identity and permissions | Identity / Controllership / API team | Wrong tenant, unauthenticated, disabled/leaver, Owner-to-admin and cross-unit direct API/file access are denied; permissions revocation tested. |
| Shared records and evidence | API / database / storage teams | Migrations, constraints, transactions, concurrency conflict handling; file scanning; private storage; linked document/version reconciliation. |
| Authoritative audit | Security / Controllership | Server identity/time, append-only writes, business-event retention, correction trace and tamper controls. |
| Real notifications | M365 / Platform / business | Approved sender and test allowlist; outbox/retries/idempotency; delivery-failure dashboard; correct calendar/time-zone; no duplicate real sends; global pause switch. |
| Calendar/deadline decisions | Controllership | Official dated Mars calendar including five-week P13 2026; PEC/YE anchor and proposed +7 calendar days approved; full-quarter/year scope communicated. |
| Operations and recovery | Central services / business champion | Health checks, redacted logs, alerts/owners, support hours, backups, restore and rollback rehearsals; RPO/RTO formally agreed. |
| Release governance | Repository/platform owner | Private enterprise source channel where required, protected main, required checks/reviews, secret scanning, deployment approvals, immutable artifact and SBOM; no personal credentials. |
| Assurance/UAT | Security / accessibility / business | Independent security test, performance/load/soak results, supported-browser/accessibility UAT and documented business acceptance. |

The current build guard rejects `ICEBREAKER_APP_MODE=enterprise` or `ICEBREAKER_DEPLOYMENT_TIER=production`. This prevents accidental labelled promotion only; it cannot make publicly hosted files private or replace enterprise release approval. Do not bypass it to meet a pilot date.

## Capacity and performance validation

Planning scenarios remain ~100 F&N pilot users and ~1,000 growth MAU. MAU is not concurrency. Obtain peak simultaneous users, controls per site, active instance count, file counts/sizes, retention and report complexity before sizing.

Current explicit prototype limits: 20 MiB/document, 150 MiB combined local documents, 5 MiB Excel archive, 40 MiB expanded Excel contents, 3,000 ZIP entries, 5,000 control rows, and 20 MiB per metadata JSON. Browser storage quotas can be substantially lower; these are rejection ceilings, **not supported business volume commitments**. Backup file maximum is 220 MiB; large browser exports may still be memory constrained.

`npm run perf:baseline` measures synthetic domain operations at 132/1,000/5,000 records; it does not measure a server, database, concurrent employees, scanning or mail. The output is `work/qa/performance-baseline.json`. CI enforces a 350 KiB compressed budget for all shipped JavaScript. No measured production SLA is claimed.

Local baseline measured 24 September 2026 on Windows, Node 24.15.0 (two warmups, seven samples): at 1,000 records, median schema validation 8.26 ms, filtering 0.04 ms, reminder grouping 2.43 ms; at 5,000 records, 33.87 ms / 0.10 ms / 9.32 ms respectively. These are isolated in-memory domain timings, not end-user response times or concurrent capacity. Repeat on the selected enterprise runtime with representative sanitized data.

Proposed enterprise test targets (to approve): p95 read/filter API <1 second; common interactive page usable <3 seconds on corporate network; p95 transactional save <2 seconds excluding file transfer/scanning. Run warm/cold tests, 10/25/100 concurrent-user scenarios, a 2-hour soak, 2x peak bursts, slow/failed SQL/storage/mail, large exports, and 5xx/retry behavior. Measure p95/p99, error rate, CPU/memory, SQL waits, job backlog, scan age and storage growth. Agree RPO/RTO and demonstrate a restore; do not derive availability from a local benchmark.

## Release / rollback instructions

1. Export current prototype test data and retain the previous Pages artifact/source before any authorized publish.
2. Run `npm ci --ignore-scripts`, `npm run check`, `npm run audit`, and the built-app browser tests. Build/verify `/ICEbreaker/` separately.
3. Review the exact source diff and CI artifact. Release metadata records source commit/build time; artifact SHA is in CI. No `.env`, server bundle or source maps belong in Pages.
4. Publish only with authorization. Prototype Pages publishing and enterprise production promotion are different processes.
5. Code rollback: redeploy the previous reviewed artifact/Pages commit. Never reset or clear browser data as part of rollback. If schema compatibility fails, preserve/export it and repair offline. Enterprise SQL/Blob rollback requires its own migration/restore plan.

Vite [preview is for local verification, not a production server](https://vite.dev/guide/static-deploy). This repository deliberately does not supply a pretend production backend/container. The enterprise team should host static assets through its approved ingress alongside the authenticated API, with response security headers and private data services.
