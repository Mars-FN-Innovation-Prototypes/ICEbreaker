# Security and release boundary

ICEbreaker is a **public, browser-local prototype**, not an approved enterprise system. Use synthetic/non-sensitive data only. The demo account/role switch is not authentication; UI restrictions are not authorization. Browser evidence and audit history are editable by anyone with access to that browser profile.

Do not enter real evidence, employee data, credentials or production exports. Do not publish a security report containing them in a public issue. Send suspected vulnerabilities privately to the repository owner/business sponsor through the agreed internal channel. Do not assume a dedicated security mailbox or response SLA exists yet.

The current build rejects explicit enterprise/production configuration. This is a release guardrail, not access control: a static artifact is still publicly accessible if hosted publicly. Do not treat `noindex` as privacy.

See `docs/ENTERPRISE_READINESS.md` for the threat review, implemented safeguards, remaining architecture gates and acceptance criteria. Dependencies must pass the current audit gate; a clean audit is not a penetration test or a guarantee of no vulnerabilities.
