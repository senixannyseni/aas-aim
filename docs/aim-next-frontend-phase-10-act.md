# AAS–AIM Future Frontend · Phase 10 — Integrity Actions, Repairs & Deferrals (ACT)

**Frozen baseline:** AIM Master Architecture Specification v1.0 (Artifacts 1 and 6).  
**Function scope:** ACT-001–ACT-013, all 13 canonical ACT functions.  
**Screens:** SCR-ACT-001 through SCR-ACT-004.  
**Status:** Interactive **read-only frontend with validated external snapshots**; no operational ACT backend, action approval, field submission, technical verification, CMMS synchronization or deferral authorization service is connected.

## Implemented screen ownership

| Canonical screen | Mapped functions | UI interactions |
| --- | --- | --- |
| SCR-ACT-001 Integrity Actions Register | ACT-001–004, ACT-009, ACT-012–013 | Filter/search action identity, state and type; inspect basis and owner; navigate to workspace |
| SCR-ACT-002 Integrity Action Workspace | ACT-001–004, ACT-008–013 | Inspect exact revisions, MOC reference, temporary/permanent repairs, controls, expiry, execution plan, evidence, CMMS work, technical verification; local-only review note |
| SCR-ACT-003 Deferral Register | ACT-005–007, ACT-009 | Search/filter deferrals and display original technical due, requested extension and authorized deadline as **three separate values** |
| SCR-ACT-004 Deferral Assessment & Approval | ACT-005–007 | Inspect risk assessment, compensating measures, assessment provenance, independent exact-revision authorization or rejection; local-only assessment note |

## Controlled projection

Source: `apps/aim-next/src/features/actions/actionsModel.ts`; input is `unknown`, which must be validated as **one coherent batch** prior to display. Source projections: `IntegrityAction`, `IntegrityRepair`, `TemporaryControl`, `ExecutionPlan`, `ExecutionEvidence`, `ActionVerification`, `ExternalWorkReference`, `DeferralRequest`, `DeferralAssessment`, `DeferralDecision`. Caller-owned source objects are not frozen or mutated; accepted snapshots are immutable copies and rejected batches expose no partial records. Empty / disconnected does **not** mean safe or compliant.

The future app accepts `actionsSnapshot?: unknown` and `actionsScopeKey?: string`; a trusted upstream identity/tenant/data-scope change must rotate the latter to clear local state. The React UI scope key does not enforce authorization. Authority and tenant filtering remain server responsibilities.

## Engineering invariants

1. `WORK_COMPLETE` needs a released execution plan and source-backed work-completion evidence. It is not an accepted technical verification. `VERIFIED` or `CLOSED` additionally requires an independently reviewed, evidenced `ACCEPTED` ActionVerification matching the exact owning action, plan and verified timestamp.
2. The `COMPLETED` state of a referenced CMMS Work Order is context only. No CMMS record can directly grant ACT-010 verification, close REC-010 recommendations or close FND-011 condition cases.
3. Temporary repairs carry a source specification, operating limitations and an expiry date. Temporary controls maintain their monitoring reference, explicit effectiveness (including `UNKNOWN`), and expiry. The frontend never treats `UNKNOWN` as effective and does not compute safety decisions from the current clock.
4. Released execution plans must carry explicit release authority, basis and timestamp. Evidence and verification must reference the same action and released plan.
5. The original `technicalDueAt` on a deferral request is distinct from `requestedUntil` and `authorizedUntil`. If the owning action supplies a technical due date, it must match the deferral's original technical date; no ACT record may rewrite the INS-016 governing technical inspection due.
6. An `AUTHORIZED`/`EXPIRED` deferral requires an independently assessed risk basis with compensating measures and a separate AUTHORIZE decision, exact deferral revision, authority and basis. An authorized deadline cannot extend beyond the requested deadline or precede the original due. A `REJECTED` deferral needs an explicit REJECT decision. A request on its own grants no extension.
7. Assessment and decision timestamps must be ordered; approved state is never inferred from an ordinary text label, work status or scenario date. Validation tests **internal coherence** and is not a substitute for authenticated provenance, actual reviewer authority or server audit trails.
8. All mutation buttons (ACT-001, ACT-007, ACT-010, ACT-011, ACT-013) remain disabled. Browser review notes are not persisted or submitted. No synthetic fixture is imported into production runtime.

## Source changes

- `src/features/actions/actionsModel.ts` — data contract, validation, immutable parsing and selectors
- `src/features/actions/ActionsDomainWorkspace.tsx` — four interactive screens
- `src/features/actions/actionsFixtures.test-utils.ts` — synthetic data for tests only
- `src/features/actions/actionsModel.test.ts` — 104 permanent model regression cases
- `src/features/actions/ActionsDomainWorkspace.test.tsx` — permanent React/jsdom interaction cases (must be run in actual toolchain)
- `src/FutureAimApp.tsx`, `src/styles.css` — new ACT routing and responsive styles

## Verification and limits

- 104/104 model test cases executed using an isolated TypeScript-transpiled Vitest-compatible assertion runner.
- Strict isolated TypeScript 5.8.3 checks passed with temporary React/Vitest declarations. These are not a substitute for the pinned TypeScript 7 / React / Vitest toolchain.
- Permanent React interaction tests were authored and typechecked, but **were not executed in Vitest/jsdom** because project dependencies are not installed in this environment.
- CSS parsing, existing design tokens and cumulative ZIP integrity validated at release.

**Next:** Phase 11 — IOW Integrity Operating Windows (11 functions, four canonical screens). Preserve historian availability versus limit compliance, UNKNOWN / STALE source quality, excursions versus governed disposition, and barrier/asset monitoring links.
