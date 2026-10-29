# Future AAS–AIM — Frontend Phase 06: Inspection Management (INS)

**Baseline:** Frozen AIM Structural Architecture v1.0 / Artifacts 1 and 6  
**Canonical coverage:** INS-001–INS-020, six screens (`SCR-INS-001`–`SCR-INS-006`)  
**Status:** Interactive presentation frontend with externally injected, validated read snapshot; NO operational backend, approval command, engineering due calculation, or field credit adjudication.

## Implemented screens

| ID | Surface | Frontend behavior | Protected ownership |
| --- | --- | --- | --- |
| SCR-INS-001 | Inspection Requirements List | Search/filter, inspect requirement, view recorded INS technical due | INS-017 unavailable |
| SCR-INS-002 | Requirement Workspace | Basis, scope, technique, coverage, effectiveness, upstream due candidates, INS due decision, recurrence, unsaved review notes | INS-016 due determination / INS-017 approval not performed |
| SCR-INS-003 | Planning Board | Search/inspect supplied execution plans, show linked requirements and original technical due separately | Planning never changes INS technical due |
| SCR-INS-004 | Workpack Workspace | Inspect scope, assignment, qualifications, source-backed release time, link to execution | INS-018 release unavailable |
| SCR-INS-005 | Inspection Events | Browse supplied events, event result, evidence references and actual field completion, link to technical review | INS-014 finalization unavailable; completion ≠ credit |
| SCR-INS-006 | Inspection Technical Review | Achieved scope, effectiveness, review basis, inspection credit, residual obligation, unsaved note | INS-012 credit and INS-020 approval unavailable |

## Data boundary

`InspectionDomainWorkspace` accepts only `inspectionSnapshot?: unknown` passed by the owning app. It uses `parseInspectionSnapshot` with **all-or-nothing validation** across seven separately authoritative object sets:

1. InspectionRequirement
2. DueCandidate (COR/RBI/FFS)
3. GoverningInspectionDue (INS-016)
4. InspectionPlan
5. InspectionWorkpack
6. InspectionEvent
7. InspectionTechnicalReview

Missing input shows a disconnected screen; invalid input yields an error and zero rendered records. Parsed objects are immutable **copies** of the input, never frozen source objects. Identity and reference checks reject duplicates, incorrect plan/workpack/requirement chains, and mismatched event-review links. The parser rejects unsupported enums, impossible timestamps, invalid coverage percentages, unreferenced approval and release states, and unsupported credit grants.

The future app also accepts `inspectionScopeKey?:string` to remount and clear local INS UI state on authorized session/tenant/scope rotation. The actual trusted integration must rotate this key whenever access scope changes. No client-side authorization is presumed.

## Engineering authority rules

- COR-015 / RBI-013 / FFS provide **due candidates**, never the final technical inspection due. The separately stored INS-016 decision is displayed only when externally supplied, with basis and determined-at reference.
- A planning window cannot re-date a governing technical due. A deferral belongs to ACT and does not rewrite INS dates.
- Field work complete is not a technical review, achieved coverage, approved inspection record or an INS-012 granted credit.
- Inspection credit appears as granted/partial only where an explicitly **APPROVED** technical review includes achieved coverage, credit basis and grant time. Missing credit stays ungranted.
- A review's residual inspection obligation is retained independently of the credit state.
- No browser-side inspection calculations, approval workflow commands, uploads or persistence are implemented. All protected buttons are disabled.
- A source snapshot is presentation input, **not proof of tenant authorization, provenance authenticity or completeness**; these require the owning Java backend and integration tests.

## Test evidence and limits

- `inspectionModel.test.ts`: 94 permanent cases executed against the actual model using a local Vitest-compatible runner (passed).
- `InspectionDomainWorkspace.test.tsx`: React Testing Library cases authored and strictly type-checked, **not executed with official jsdom/Vitest in this environment**.
- Strict isolated TypeScript 5.8.3 check against all `apps/aim-next/src` passed using temporary React/Vitest declaration stubs. This is not the pinned TypeScript 7 build.
- CSS parsed and existing design-token check passed.
- No real backend service or operational data source was used.

## Run on Arch Linux

```bash
cd aas-aim
pnpm install
pnpm --filter @bandha/aim-next typecheck
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
pnpm --filter @bandha/aim-next dev
```

Default dev server: `http://127.0.0.1:5174/`. An authorized upstream source can inject `inspectionSnapshot` and a rotated `inspectionScopeKey` into `FutureAimApp`. The app does not synthesize records for the disconnected case.

## Subsequent phase

**Phase 07 — RBI: Risk-Based Inspection (19 functions, three canonical screens).** Assessments, frozen input references, data quality, risk drivers, current/future risk views, scenarios, approval review and RBI due candidates. INS remains owner of the governing technical date. The frontend must display source-backed deterministic results without recomputing them.
