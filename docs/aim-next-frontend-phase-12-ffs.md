# Future AAS–AIM — Phase 12: Fitness-for-Service (FFS)

**Architecture:** Frozen AIM Master Architecture Specification v1.0, Artifact 1 + Artifact 6  
**Functions:** FFS-001–FFS-011 (11 active)  
**Screens:** SCR-FFS-001, SCR-FFS-002, SCR-FFS-003  
**Release:** Phase 12, builds on cumulative Phase 11 archive  
**Implementation status:** Frontend workspaces, read-only validated source projections and local-only notes. **Not** operational engineering execution or approval.

## Implemented surfaces

| Screen | Purpose | Functions represented |
| --- | --- | --- |
| SCR-FFS-001 | Fitness-for-Service Assessment Register: search, filter, inspect revisions and open controlled assessment | FFS-001, FFS-010, FFS-011 |
| SCR-FFS-002 | FFS Assessment Workspace: procedure/level, flaw characterization, frozen inputs, input quality, fitness, FFS remaining life, envelope, conditions, trace, approval display and reassessment | FFS-001 through FFS-011 |
| SCR-FFS-003 | Non-authoritative FFS Scenario / Sensitivity: inspect what-if inputs and results, local notes and navigate back | FFS-008 |

Screen routes are inherited from `screenRegistry.ts` and `screenRouting.ts`. This phase **does not change canonical function identities or counts**.

## Frontend contract

`FutureAimApp` now accepts optional `ffsSnapshot?: unknown` and `ffsScopeKey?: string`. When the authorized user/tenant/site/resource scope changes, the integrating trusted application must rotate `ffsScopeKey` and replace/remove `ffsSnapshot`. The default application passes neither, so FFS remains disconnected. These props do not provide authentication or authorization; the trusted upstream must ensure scope before supplying the data.

`parseFfsSnapshot()` ingests six complete collections, rejecting the entire batch if any record, reference or revision is inconsistent:

1. `assessments`: FFS level, methodology, procedure, review and reassessment basis.
2. `inputSets`: exact-revision inputs, input quality and frozen timestamp.
3. `flaws`: source-backed flaw characterizations from a matching FLAW input.
4. `results`: fitness/remaining life/envelope/inspection constraint with exact input linkage and calculation trace.
5. `conditions`: requirements linked to real source results, with separate monitoring/due-candidate references.
6. `scenarios`: separate `SCENARIO`-only results, never combined with approved results.

Approved assessments require frozen non-empty qualified input sets, a fitness conclusion, a reviewer, approval reference and timestamp. Draft records cannot masquerade as approved. A reassessment-required assessment may display `HISTORICAL_APPROVED` results but **must not call them a current approved FFS conclusion**. The validator checks internal coherence only; it cannot authenticate the source or validate engineering adequacy.

## Non-negotiable architecture rules

- **No browser FFS calculation:** FFS-005, FFS-006 and any deterministic evaluation belong to controlled engineering services, not UI logic. Display strings are sourced, never calculated in browser.
- **COR remaining life differs from FFS remaining life:** no conflation or automatic substitution; results are explicitly owned by FFS.
- **Due ownership:** FFS inspection constraints feed the inspection process; **INS-016** exclusively determines governing technical inspection due. No frontend promotion of FFS candidate to final due.
- **Scenario isolation:** sensitivity scenarios and their results are always labeled `SCENARIO` and non-authoritative; scenario display cannot approve any assessment.
- **Review authority:** FFS-010 approval and FFS-011 reassessment initiation require backend-scoped authorization, exact revision binding and immutable server audit. Buttons remain disabled.
- **Input quality:** unknown, missing, suspect or stale inputs are never interpreted as adequate evidence. A missing FFS record is not evidence that equipment is fit.
- **Identity:** all records use externally governed asset and source references. The UI does not invent identifiers or read asset content from an unrelated domain.
- **Atomic rejection:** malformed/untrusted snapshots display an error and expose no partial engineering values.
- **Ephemeral drafts:** review notes are local component state, cleared on selection changes; they are not written or submitted.

## Delivered implementation

```text
apps/aim-next/src/features/ffs/
  ffsModel.ts
  ffsModel.test.ts
  ffsFixtures.test-utils.ts
  FfsDomainWorkspace.tsx
  FfsDomainWorkspace.test.tsx
apps/aim-next/src/FutureAimApp.tsx           (updated)
apps/aim-next/src/styles.css                (updated)
docs/aim-next-frontend-phase-12-ffs.md        (new)
```

## Verification and limitations

- Permanent model suite: 116 tests passed against compiled TypeScript with an isolated Vitest-compatible test runner.
- Isolated strict TypeScript 5.8.3 checking: passed using temporary React/Vitest declarations.
- Design token generator: all 171 tokens current.
- React interaction tests: defined and type-checked, **not executed** here because installed React, Vitest and jsdom dependencies are unavailable.
- Full project build (`pnpm --filter @bandha/aim-next build`): **not executed** in this environment.

No real FFS data, authentication, API endpoints, calculation engines, model standards packages, numerical checks, human approval, or persisted results are connected. Source-provided approval labels remain unverified assertions until backed by trusted identity and domain services.

## Future integration dependencies

Implement and independently review backend FFS contracts for input freeze, engineering calculation, methodology applicability, scenario evaluation, approval authority, audit/revisions, reassessment and downstream INS constraints. Then add authenticated transport, real record fetching and end-to-end tests in a pinned project toolchain. A frontend-only preview **must not be used for plant integrity or fitness decisions**.
