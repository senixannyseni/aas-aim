# AAS–AIM Future Frontend · Phase 09 — Recommendations (REC)

**Frozen baseline:** AIM Master Architecture Specification v1.0, Artifacts 1 and 6.  
**Canonical domain:** REC-001 through REC-010.  
**Screens:** SCR-REC-001 Recommendation Register; SCR-REC-002 Recommendation Workspace.  
**Authority:** Frontend read-only display and temporary local notes. No backend recommendation command, mutation, approval, verification, or closeout service is implemented.

## Delivered

- `apps/aim-next/src/features/recommendations/recommendationsModel.ts`: typed domain projection, whole-snapshot runtime validation, immutable parsed copies, cross-object consistency and search/context queries.
- `apps/aim-next/src/features/recommendations/RecommendationsDomainWorkspace.tsx`: two responsive screen experiences with source-backed states, review tabs, evidence/criteria, separate execution and closeout views, and disabled protected operations.
- `apps/aim-next/src/features/recommendations/recommendationsFixtures.test-utils.ts`: synthetic records solely for tests (never for production runtime).
- `apps/aim-next/src/features/recommendations/recommendationsModel.test.ts`: regression suite for identity, provenance, missing approvals, requirements, accountability, linked work, verification, independent closure and repeat reopening.
- `apps/aim-next/src/features/recommendations/RecommendationsDomainWorkspace.test.tsx`: permanent React/jsdom interaction tests; not executed in the current dependency-free environment.
- `FutureAimApp.tsx`, `styles.css`: integration and responsive styling. `recommendationsSnapshot?: unknown` defaults to disconnected, and `recommendationsScopeKey` remounts the UI on identity/tenant/authorized-scope changes. This is a UI invalidation aid, not tenant authorization.

## Screen-to-function mapping

- **SCR-REC-001**: REC-001, REC-003, REC-004, REC-007. Search by canonical identity and asset, filter by state/priority, inspect technical basis/accountability, navigate to the owning recommendation workspace.
- **SCR-REC-002**: REC-001–REC-010. Panels: BASIS, REQUIREMENTS, ACCOUNTABILITY, EXECUTION, FULFILLMENT, CLOSEOUT. Local unsaved closeout notes only. All authoritatively mutating actions disabled.

## Controlled object families

- `Recommendation`: identity, asset, approved source-domain basis, revision, state, priority, technical timing, approval provenance and supersession/withdrawal decision where applicable.
- `RecommendationRequirement`: separately identifiable acceptance criterion with source basis.
- `RecommendationAccountability`: owner, accountable authority and assignment timestamp.
- `RecommendationExecution`: linked internal action, CMMS job, inspection, assessment or other external execution status.
- `RecommendationFulfillment`: independent criterion-level technical verification, reviewer, basis and evidence.
- `RecommendationCloseout`: version-bound CLOSE/REOPEN decisions preserving chronological history.

## Engineering integrity rules

1. A `COMPLETED` work order or integrity action **does not grant** REC-009 technical fulfillment or REC-010 recommendation closure.
2. An APPROVED recommendation requires a recorded approval timestamp, approval basis, exact approved revision, at least one acceptance requirement and assigned accountability. A local validator can verify supplied record consistency but cannot verify cryptographic authenticity or the reviewer's actual authority.
3. A `VERIFIED` fulfillment record requires an explicit acceptance-criterion link, review basis, reviewer, evidence and verified timestamp. Unknown and pending are not verified.
4. Every CLOSED recommendation requires independently verified fulfillment for **every** acceptance criterion before an authorized, recorded, revision-bound CLOSE decision. REOPENED requires a preserved earlier CLOSE and later authorized REOPEN. Multiple alternating close/reopen cycles are supported and cannot be reordered.
5. SUPERSEDED and WITHDRAWN states require a recorded lifecycle decision and authority reference; UI state changes are not permitted.
6. Invalid input is rejected as a complete batch. No partial recommendation, artificial risk classification, due date, evidence, technical acceptance or approval is manufactured by the frontend.
7. `technicalDueAt` is the source-supplied technical recommendation timing; linked execution dates do not replace it. Governing inspection due dates remain owned by INS-016.
8. Approval, revision, fulfillment, closeout, authorization and immutable audit logs must be issued by future owning-domain services. Frontend navigation, labels and local notes do not create state transitions.

## Validation performed in the current environment

- 114/114 permanent model test cases executed against the actual TypeScript implementation using an isolated Vitest-compatible runner.
- Isolated strict TypeScript 5.8.3 project checking (temporary declarations for React / test runtime) passed. This is not equivalent to the pinned TypeScript 7 / React / Vitest stack.
- React test file is authored and type-checked, but the official Vitest/jsdom execution and pinned Vite build remain **pending**. Project dependencies were not installed here.
- CSS syntax, existing design token generator check and cumulative archive/byte-integrity verified before release.

## Next domain

**Phase 10 — ACT: Integrity Actions, Repairs & Deferrals**, 13 canonical functions / four screens. Maintain separation between temporary repair, permanent repair, compensating controls, deferral authorization, external work synchronization, and technical verification. Especially, an authorized deferral may alter an authorized execution deadline but never the INS-016 governing technical inspection due date.
