# Future AAS–AIM · Frontend Phase 04 — DGM

**Architecture baseline:** Frozen AIM Master Architecture Specification v1.0, Artifacts 1, 2 and 6  
**Domain:** DGM — Degradation Mechanisms (DGM-001 through DGM-012)  
**Surfaces:** `SCR-DGM-001` and `SCR-DGM-002`  
**Implementation state:** Functional **frontend presentation and client-only interaction**; **not** a connected engineering service.

## Delivered screen surfaces

| Canonical surface | Frontend behavior | Authoritative integration still required |
| --- | --- | --- |
| SCR-DGM-001 Degradation Assessment Workspace | Assessment search/filter/select; applicability matrix; per-mechanism susceptibility and evidence/factor counts; linked evidence quality; barrier instance health and criterion references; COR/INS/IOW monitoring references; controlled basis/revision; volatile review notes | Assignment/applicability commands, evidence evaluation, barrier engineering, state machine, server-authorized approval and audit |
| SCR-DGM-002 Degradation Mechanism Library | Filter by text, category and recorded definition state; inspect mechanism revision and source; applicability factor definitions; inspection technique capability; navigate from assessment to mechanism and back | Controlled package editing, revisioning, activation, methodology approval, authorization and audits |

The two screens are embedded in `FutureAimApp` and linked to the frozen `screenRegistry.ts`, not independent shadow routes. No function IDs or screens were added to the canonical baseline.

## Snapshot contract

`FutureAimApp` optionally accepts `degradationSnapshot: unknown` and `degradationScopeKey: string`. The caller MUST verify principal, tenant, site and object-level authorization before supplying the snapshot. On any change to that context, it MUST change `degradationScopeKey` (or unmount the application) to destroy previous selection and volatile notes.

`parseDegradationSnapshot` requires an explicit complete shape with the following canonical DGM presentation collections:

- `mechanisms` — controlled mechanism definitions
- `assessments` — asset-linked assessment identities, revisions and recorded review states
- `evidence` — source-backed degradation observations and independent evidence quality
- `factors` — mechanism applicability factor definitions
- `applicability` — mechanism/assessment mappings and susceptibility classifications
- `techniques` — mechanism-specific inspection technique capabilities
- `barrierDefinitions` — source-backed degradation-barrier definitions
- `barrierCriteria` — named verification indicators and acceptance criteria
- `barrierInstances` — assessment-specific reported barrier health
- `monitoringLinks` — IOW, INS and COR object references

All collections are required, but may be empty. Inputs are bounded. Record IDs must be unique per collection; mechanism codes must be unique case-insensitively; applicability may only have one record for a given assessment/mechanism pair. Every inter-object reference must resolve within its corresponding supplied collection. Nested evidence and factor IDs must also match the same mechanism and assessment. Invalid data fails **as a whole**; no partially valid assessment is displayed.

The validator makes immutable copies rather than freezing caller-owned objects. Rejected data values are never reproduced in validation messages. It does not prove source authenticity or grant engineering authorization.

## Presentation and ownership invariants

1. `UNKNOWN` susceptibility, applicability and barrier health are visible states. Missing collections are **not** interpreted as `NOT_APPLICABLE`, `VALID`, `EFFECTIVE` or `LOW`.
2. Evidence `VALID` means a supplied evidence-quality classification; it does not demonstrate barrier effectiveness, technical acceptability or equipment fitness.
3. Library revisions are separate from assessment revisions. Approved assessments must include a recorded basis reference and timestamp. Asserted applicability/susceptibility and non-UNKNOWN barrier health also require a source-basis reference. This parser does not itself authenticate that approval.
4. Technique capability is a separate controlled datum; the frontend does not infer it from an NDT technique name.
5. IOW/INS/COR links are displayed as references. The frontend does not determine operating-limit exceedances or inspection due dates.
6. Review notes remain only in volatile React component state. **No save or approval button is enabled.**
7. Only DGM-owned data appears in DGM's presentation model. Inspection credit is INS-owned; corrosion calculations are COR-owned; RBI risk models are RBI-owned; authoritative audit and approval rights are GOV-controlled.
8. No fake assets, measurements, exposure, barrier health, calculations, approved outcomes or identity providers are included in production startup.

## Files changed

- `apps/aim-next/src/features/degradation/degradationModel.ts` — new runtime parser and model helpers
- `apps/aim-next/src/features/degradation/degradationModel.test.ts` — new pure-model regression suite
- `apps/aim-next/src/features/degradation/DegradationDomainWorkspace.tsx` — new two-screen interactive UI
- `apps/aim-next/src/features/degradation/DegradationDomainWorkspace.test.tsx` — new React Testing Library regression suite
- `apps/aim-next/src/FutureAimApp.tsx` — DGM route integration and scope-key props
- `apps/aim-next/src/styles.css` — DGM desktop and responsive design
- `docs/aim-next-frontend-phase-04-dgm.md` — this file

## Validation status and execution

- Isolated TypeScript 5.8.3 strict compilation, with temporary declarations in lieu of pinned dependencies: **passed**.
- Permanent pure-model test cases exercised using an isolated Vitest-compatible runner against the actual `degradationModel.ts`: **78/78 passed**.
- Permanent React component tests: authored and type-checked, **not run** (React, Vitest, jsdom absent in this environment).
- Official pinned Node 24+/TypeScript 7/Vite build and Vitest run: **pending**.

To verify locally on Arch Linux:

```bash
cd aas-aim
pnpm install
pnpm --filter @bandha/aim-next typecheck
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
pnpm --filter @bandha/aim-next dev
```

## Next planned tranche

**Phase 05 — COR, Corrosion & Thickness Management:** six canonical screens, 22 functions, CML/TML and measurement context, thickness-history visualization, controlled calculation-trace presentation, Tmin basis, staged import and governance-aware review. Any corrosion rate, remaining-life or inspection-due calculation must remain backend-authoritative; proposed due candidates do not replace the INS governing inspection date.
