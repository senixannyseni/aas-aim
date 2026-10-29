# Future AAS–AIM — Frontend Phase 05: COR

**Product baseline:** Frozen AIM Master Architecture Specification v1.0 · 190 active functions · 15 domains.

**Scope:** COR-001–COR-022, mapped to the six canonical surfaces in Artifact 6. This is a **presentation and local-staging frontend**, not an operational corrosion engineering calculation service.

## Delivered screens

| Screen | Name | UI capabilities and ownership |
|---|---|---|
| SCR-COR-001 | Corrosion Loop & Circuit Workspace | Loop context, circuit register, tag/state filtering, selection, related-screen navigation. COR-001, COR-002, COR-021. |
| SCR-COR-002 | Monitoring Locations / CML / MP | CML/TML location register, circuit filters, source-backed measurement-point details. COR-003, COR-004, COR-019. |
| SCR-COR-003 | Thickness History | Recorded thickness table (mm), quality filtering, chronological point history, anomaly/disposition visibility. COR-005, COR-007–009, COR-019. |
| SCR-COR-004 | Corrosion Calculation Workspace | Supplied long/short/regression/governing/assumed/aggregate rate results, remaining-life presentation, due candidate, trace, revision and approval basis. COR-010–018, COR-021–022. |
| SCR-COR-005 | Tmin Management | Controlled Tmin register, revision/effectivity detail; no local Tmin activation. COR-020. |
| SCR-COR-006 | Corrosion Bulk Import | Local CSV staging/preview, source context matching, duplicate/invalid rows rejected as a batch; cannot promote/import. COR-006, COR-007, INT-008. |

## Data integration contract

`CorrosionDomainWorkspace` accepts `snapshot?: unknown` from an **already-authorized upstream source**, plus `screenId` and `onNavigate`. The app supports `corrosionSnapshot` and `corrosionScopeKey`, with no default records. Rotate `corrosionScopeKey` on user, tenant or authorization-scope changes to discard UI state. Authorization, data scoping, and ownership are backend responsibilities; frontend validation is not a security boundary.

`parseCorrosionSnapshot()` requires exactly ten collections: `loops`, `circuits`, `locations`, `points`, `sets`, `readings`, `anomalies`, `tmins`, `calculations`, `rates`. It validates:

- required field presence, primitive types, allowed enum states and calendar-valid ISO timestamps;
- immutable copies of accepted objects; no freezing of caller-owned records;
- unique IDs within collections, cross-reference integrity and circuit consistency between reading set and measurement point;
- finite positive thickness and finite nonnegative source-supplied corrosion rate values;
- controlled Tmin effectivity and recorded approval timestamps for approved calculation sets;
- duplicate input measurement references, and rejection of the **entire** invalid snapshot rather than showing a partial result.

Invalid field values never appear in validation issue strings. Validated source data is displayed as supplied. The browser **does not calculate** LT/ST/regression/governing corrosion rates, remaining life, inspection due candidates or Tmin. `0 mm/year` appears only if the source explicitly supplies that value; absent values never default to zero.

## Cross-domain ownership rules

- COR-015 produces a **COR-based inspection due candidate**, not the final due date. **INS-016** determines the governing technical inspection due date.
- COR-014 remaining life and FFS-006 remaining life must remain differentiated; no automatic substitution.
- Calculations and rate values have their own basis and input-reading references. `APPROVED` is a recorded upstream status, not an approval granted by the UI.
- COR-018 review/approval cannot be triggered in this frontend; all controlled transitions require authoritative service-side authorization, revision binding and audit logging.
- Measurement anomalies and `SUSPECT` / `UNKNOWN` quality remain visible and are not silently promoted to validated source evidence.
- Staged CSV results are previews only; no backend write, import confirmation, or local persistence is implemented.

## CSV staging contract

Header: `pointId,setId,measuredAt,thicknessMm,sourceReference`. Values are expressed in **millimetres** for `thicknessMm`. Quote escaping is supported within a row. The preview requires point/set references to the same circuit and rejects duplicate `(setId, pointId, measuredAt)` tuples. It rejects all rows if any row is malformed. File attachments, multiline CSV fields, data migration, deduplication against *server* source and audit are not implemented. Staged rows cannot become native evidence until an authorized backend command succeeds.

## Files

- `apps/aim-next/src/features/corrosion/corrosionModel.ts`
- `apps/aim-next/src/features/corrosion/corrosionModel.test.ts`
- `apps/aim-next/src/features/corrosion/CorrosionDomainWorkspace.tsx`
- `apps/aim-next/src/features/corrosion/CorrosionDomainWorkspace.test.tsx`
- Integration updates: `FutureAimApp.tsx` and `styles.css`.

## Validation performed

- **85/85** permanent pure-model regression cases executed using isolated TypeScript transpilation and a minimal Vitest-compatible assertion runner.
- Isolated strict TypeScript 5.8.3 type-check of the complete future app with temporary React/Vitest declarations.
- CSS syntax and source-reference checks; all 171 existing foundation design tokens remain unchanged.
- ZIP integrity and byte-identical preservation of every previous Phase 04 file except two intentional frontend updates.

The official pinned TypeScript 7, React Testing Library/jsdom and Vite build have **not** been run in this environment. The new React tests are included for execution after dependency installation.

## Next phase

**INS — Inspection Management:** Inspection Requirements, Workpack, planning, event/result capture, achieved effectiveness and credit, technical review and governing due dates. COR due candidates will be carried into the INS UI only as candidate references—not as final commitments.
