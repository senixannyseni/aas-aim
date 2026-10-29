# Future AAS–AIM — Phase 07 / Risk-Based Inspection (RBI)

**Baseline:** Frozen AAS–AIM Master Architecture v1.0. **Domain functions:** RBI-001–019. **Canonical screens:** SCR-RBI-001–003. This is an implementation of validated frontend **read surfaces**, not a risk-calculation engine or engineering approval service.

## Implemented

| Screen | UX surfaces and guarded behavior |
| --- | --- |
| `SCR-RBI-001` RBI Assessment Register | Search by code, ID, asset, method and revision; filter by assessment lifecycle; inspect records; navigate to the assessment workspace. |
| `SCR-RBI-002` RBI Assessment Workspace | Basis/method, frozen inputs, data quality, PoF/damage factors, CoF, current/future risk, strategy, RBI due candidate, calculation trace and approval status; unsaved review note. |
| `SCR-RBI-003` RBI Scenario Workspace | Filter scenarios, view source-backed scenario inputs/results, clearly label `SCENARIO` / `NON-AUTHORITATIVE`, unsaved notes, navigate to controlled assessments. |

Function IDs are mapped through the frozen screen registry. The UI is not a claim that all 19 backend functions are implemented. Engineering calculations, frozen-set creation, method qualification, authorizations, persistence, scenario execution, and reassessment decisions require corresponding backend services.

## Read boundary

- `rbiModel.ts` accepts a complete externally supplied `RbiSnapshot` with `assessments`, `inputSets`, `results`, `strategies`, and `scenarios`.
- Entire snapshots are rejected on missing or unexpected fields, malformed dates, cross-assessment input/result links, duplicate IDs, invalid classifications, unsupported approval claims or inconsistent scenario base revisions.
- Approved assessments require recorded basis, timestamps, and a nonempty frozen input set. Previous approvals may remain historically visible on assessments requiring reassessment, but this is **not** renewed approval.
- Approved result and strategy labels require a previously approved, evidence-backed assessment and matching frozen input set. The frontend does not calculate or infer missing values.
- PoF, CoF and damage-factor display strings require nonnegative numeric values, while the RBI due candidate must be an RFC3339 date-time string. Units and technical interpretation remain authoritative-source responsibilities.
- Source objects are copied before freezing validated records; caller-owned input objects remain mutable.
- Result-state labels `CALCULATED`, `APPROVED`, `PROJECTED`, and scenario-only labels remain distinct.
- **`RBI-013` produces only an RBI due candidate. `INS-016` exclusively owns the governing technical inspection due date.** The frontend never selects a final due date from COR/RBI/FFS candidates.
- The future App takes `rbiSnapshot?: unknown` and `rbiScopeKey?: string`. Default startup supplies neither; UI is disconnected. The key must rotate on identity, tenant, authorization scope, or authorized snapshot changes to clear local selections/drafts.

## Engineering ownership and authority

The RBI assessment screens are passive viewers of authored risk and provenance. Approval (`RBI-018`) and all deterministic risk calculations (`RBI-005–011`) are disabled on the frontend. A what-if scenario (`RBI-016`) cannot be silently promoted to an approved risk record. Dashboards and simulations cannot mutate domain records or inspection technical due dates. All future authoritative transitions require backend capability/scope checks, exact record revisions and immutable audit logging.

## Permanent tests

- `rbiModel.test.ts` — 100 source-model cases with an isolated local Vitest-compatible runner; real model and synthetic test-only fixtures.
- `RbiDomainWorkspace.test.tsx` — 26 React/Testing Library cases defined, strict TSX checked; **not yet executed in official Vitest/jsdom**.
- Full pinned project `pnpm install`, `pnpm --filter @bandha/aim-next test`, typecheck, and Vite build remain to be executed on a compatible Node/pnpm environment.

## Continue

Next domain: **FND — Findings and Integrity Condition Cases** (11 functions, three screens). Follow with REC, ACT, IOW, FFS, GOV, INT, ANA, FLD and VIS. Keep the 190-function registry frozen and preserve all previous source files as project history.
