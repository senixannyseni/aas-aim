# Future AAS–AIM — Phase 15: Analytics & Decision Support (ANA)

**Structural baseline:** AIM v1.0, 190 active functions. **Phase:** 15. **Domain:** ANA-001–010.

## Delivered frontend surfaces

| Screen | Source-backed interactions and contracts |
| --- | --- |
| SCR-HOM-001 Enterprise Overview | Supplied enterprise metrics, value provenance and quality distinctions; data quality breakdown; never infers unknown metric values. |
| SCR-HOM-002 My Work / Team Attention | Domain-owned work items and obligation references; source-domain navigation; no dashboard-level approvals. |
| SCR-ANA-001 Risk Analytics | Current/future risk, methodology + result-state comparability groups, calculation-source references. |
| SCR-ANA-002 Corrosion & Remaining-Life | COR/FFS remaining life separately identified, corrosion trend records, technical provenance. |
| SCR-ANA-003 Obligation / Performance | Original technical dues, separately authorized execution deadlines, method-versioned bad-actor records. |
| SCR-ANA-004 Data Confidence | Per-domain quality, completeness, freshness, UNKNOWN/MISSING/STALE, evidence references. |
| SCR-ANA-005 Forward Exposure & Workload | Horizon-scoped projected workloads and confidence, source forecasts vs approved plans. |
| SCR-ANA-006 Reports / Query Builder | Governed semantic-model definitions and execution provenance. No arbitrary SQL, export or execution without backend authorization. |

SCR-HOM-003 Universal Search belongs to GOV-012; a separate globally scoped search contract must implement it. No redesign of Artifact 6 screen IDs or functions is introduced.

## Inputs and validation

`FutureAimApp` accepts `analyticsSnapshot?: unknown` plus `analyticsScopeKey?: string`. If no snapshot is provided, the ANA/HOM surfaces show disconnected/UNKNOWN. The caller is responsible for authenticating, server-scope filtering, and rotating scope key when tenant, principal, site or authorization changes. The browser validates but does not authorize access.

`analyticsModel.ts` exports `parseAnalyticsSnapshot`, `analyticsRows`, `remainingLifeByDomain`, `comparableRiskGroups`, and a canonical empty projection. It validates 11 arrays: metrics, workItems, risks, corrosion, remainingLife, obligations, badActors, quality, forecasts, reports and executions. It checks exact fields, strict identity, bounded collections, single-tenant snapshots, finite numeric values, timestamps, immutable copies, quality references, exact report execution linkage, and source provenance. The validator returns an error for the entire batch when any row is invalid; partial successes are not rendered.

Synthetic source records are in `analyticsFixtures.test-utils.ts` and imported only by test files, never by application startup.

## Engineering authority and assurance constraints

- Missing, stale and UNKNOWN records never become zero, safe or acceptable metric values.
- RBI comparability is scoped to methodology revision, period and authority state. The client never calculates or approves PoF, CoF or risk.
- COR and FFS remaining life remain separate series and independent evidence families.
- An authorized execution extension does **not** overwrite the technical due date maintained by INS.
- Work-queue navigation opens owning domain; no approval executes inside HOME.
- Forecast counts do not imply technical schedule authorizations and cannot adjust INS due dates.
- Ranking carries a methodology revision, source window and contributing source references.
- Reports use reference-only governed semantic models; arbitrary SQL is unavailable.
- Backend services still need scoped query execution, aggregation, analytics projections, persistence and authorization. No operational backend is connected.

## Verification

- 139/139 permanent analytics model cases passed in an isolated transpiled TypeScript test runner.
- Strict isolated TypeScript checking completed with local ambient shims because exact pinned React/Vitest modules are not installed.
- Permanent React/jsdom interaction tests are included but not yet executed with the project-pinned dependencies.
- Confirm official `pnpm --filter @bandha/aim-next typecheck`, `test`, `build` in a supported Node >=24 / pnpm >=12 environment.

## Next

Phase 16: FLD Field Companion (9 functions / 5 screens), then Phase 17: VIS Visualization & Context (6 active functions / 6 screens). After domain coverage, complete full frontend design/QA, real API binding and backend-governed transitions.
