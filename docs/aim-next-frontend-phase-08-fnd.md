# Future AAS–AIM — Frontend Phase 08 / Findings and Integrity Condition Cases

**Architecture:** Frozen AIM Master Architecture Specification v1.0 (Artifacts 1, 2 and 6).  
**Domain:** FND-001–011 (11 canonical function identities).  
**Canonical screens:** SCR-FND-001 through SCR-FND-003.  
**Implementation type:** Fail-closed, source-backed frontend presentation and local-only draft interactions; **no authoritative domain commands**.

## Implemented surfaces

| Screen | Interactive frontend behavior | Primary function mapping |
| --- | --- | --- |
| `SCR-FND-001` Findings Register | Search code, asset, location and observation narrative; filter recorded validation state and severity; inspect a finding and navigate to triage. | FND-001–004 |
| `SCR-FND-002` Finding Triage | Inspect observation context, source record, linked evidence and validation basis; view linked ICCs; enter/clear **unsaved** review notes. Protected validation and case creation are disabled. | FND-002–005 |
| `SCR-FND-003` Integrity Condition Case Workspace | Select case; view technical assessment, linked evidence, authorized disposition, monitoring, external work and independent closure/reopen record. Local-only closure notes; protected approvals, dispositions and close/reopen disabled. | FND-005–011 |

## Presentation-data boundary

`findingsModel.ts` accepts only a complete authorized `FindingsSnapshot` with `findings`, `cases`, `assessments`, `dispositions`, and `monitoring`. Input is `unknown`; no partial records pass the parser on error. Every record has stable identity and source provenance. Parser diagnostics name record positions or issue categories but do not echo arbitrary untrusted field values. All parsed records and nested array data are defensive copies and immutable; **caller-owned objects are not frozen**.

- Observations may have `UNKNOWN` severity, `TRIAGE_PENDING`, missing evidence, or lack a validation basis; none imply acceptance.
- A finding explicitly labeled `VALIDATED` requires an evidence reference, validation basis and validation timestamp.
- A case may only link a **validated**, same-asset finding; case/finding/assessment/disposition IDs are not interchangeable.
- Approved or superseded assessments require approval timestamp, approval basis, and source-backed evidence; an approved assessment must link to evidence on an associated finding.
- Authorized dispositions require an approved assessment and an authorization timestamp; an external repair or CMMS work order cannot authorize a disposition.
- A `CLOSED` case must contain an approved assessment, authorized disposition and **independent closure** with decision date, technical basis, reviewer reference and verification reference. Closure cannot predate disposition authorization.
- A `REOPENED` case retains historical closure and requires a later reopening timestamp and recorded reopening basis.
- Linked recommendations and integrity actions remain **references only**. Their external completion cannot transition or close the FND case.
- Monitoring source references and `REASSESSMENT_REQUIRED` remain explicit; absence of monitoring is not evidence of stability.

The frontend enforces presentation consistency and refuses unsupported labels; this does **not** grant or verify true engineering authorization, record origin, tenant scope or audit validity. Those are responsibilities of the future backend.

## Frontend integration

- `FutureAimApp.tsx` includes `findingsSnapshot?: unknown` and `findingsScopeKey?: string`, then renders `FindingsDomainWorkspace` for all three canonical FND routes.
- No source connected (default) means an empty register with a conspicuous disconnected-state notice — never synthetic production data.
- Rotate `findingsScopeKey` on user, tenant, authorized scope or source-data context changes to clear selected records and unsaved notes.
- New `.fnd-*` styles are scoped, responsive, keyboard navigable, and respect standard accessible form labels, table headers, regions, tabs and alert/status roles.
- All test fixtures are in `findingsFixtures.test-utils.ts`; production code never imports them.

## Tests and current verification limit

- `findingsModel.test.ts`: 110 parameter-expanded permanent test cases passed against the actual compiled parser in a local Vitest-compatible runner.
- `FindingsDomainWorkspace.test.tsx`: 29 permanent React Testing Library interaction cases authored and isolated strict-TypeScript checked. **The actual React/Vitest/jsdom run is still pending.**
- Isolated TypeScript 5.8.3 and CSS parsing were run here, without installed project dependencies.
- The project's pinned Node >=24, pnpm >=12, TypeScript 7.0.2, React, Vitest and jsdom build/test suite must still be run locally before considering the frontend validated end to end.

## Engineering authority remains unavailable

`FND-004` finding validation, `FND-009` condition assessment approval, `FND-011` ICC close/reopen, and other controlled FND transitions must be implemented by the owning Java domain service with scoped capability checks, exact revision binding, immutable audit records and review evidence. None are browser mutations or simulated engineering calculations.

## Continue

Phase 09: `REC` — Recommendations, 10 functions across `SCR-REC-001` Recommendation Register and `SCR-REC-002` Recommendation Workspace. Preserve the distinction between recommendation acceptance criteria, actual action completion, independent technical fulfillment verification, and backend-controlled close/reopen.
