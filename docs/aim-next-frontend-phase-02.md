# AAS–AIM Future Frontend — Phase 02 / Artifact 6 Traceability

**Baseline:** AIM Master Architecture Specification v1.0, frozen Artifact 1 (Canonical Function Registry) and Artifact 6 (Complete Screen–Function–Object Matrix).

**Correction to Phase 01:** Phase 01 modeled `SCR-HOM` and `SCR-GLB` as one screen each, resulting in 76. Artifact 6 actually declares `SCR-HOM-001`, `SCR-HOM-002`, `SCR-HOM-003` and `SCR-GLB-001`, alongside 74 domain screens. The correct **documented screen inventory is 78**. These are primary screen IDs, **not 78 implemented production features**.

## Phase 02 delivered

- Screen metadata for all 74 domain and 4 shared targets, using exact frozen screen IDs and Artifact 6 labels.
- Explicit function IDs on each screen; 190/190 active Artifact 1 capabilities map to at least one screen. `VIS-001` and `VIS-002` remain retired and unmapped.
- Linked object-family references and explicit protected-transition IDs. Some object-family display labels are convenient summaries when Artifact 6 describes a reference rather than a named object type; they are not claimed to be the full Artifact 2 canonical object schema.
- Hash deep links: `#/screens/SCR-INS-006`, `#/screens/SCR-RBI-002`, `#/screens/SCR-HOM-003`, etc. Invalid and retired URLs fail closed to the architecture view.
- All domain screen tabs navigate to their canonical screen; the three HOME screens and the global shell are separately reachable.
- Function inspector links each function to every mapped UI surface, including shared screens.
- Screen views display documented object families, linked function entries and protected decision gates, with disabled authoritative actions.
- Pure routing and structural coverage tests, including domain counts, 190-function coverage, key due-date rules, retired IDs, and protected transitions.

## Engineering boundaries preserved

1. `COR-015` and `RBI-013` publish due candidates; `INS-016` owns the governing technical due date.
2. Field capture completion never grants inspection approval or credit.
3. Risk and evidence validity are separate dimensions; UNKNOWN/MISSING/STALE are not silently equated with acceptable status.
4. Analytics, contextual overlays, integration monitoring, and field companion views have **no protected engineering transitions**.
5. The frontend screen map is **presentation traceability only**. Domain data ownership, permission checks, engineering calculations, approval, auditable state changes, and tenancy enforcement remain server authority.
6. Real asset records are not supplied, simulated, or silently invented in the future product.

## Status and next work

This is frontend architecture development, not full feature completion. The next tranche should build real, typed, read-only surfaces against validated contracts, beginning with AIR asset hierarchy/asset workspace and linked degradation and inspection views; followed by draft entry interfaces with explicit non-persistence, uncertainty, validation, and revision semantics. Subsequent phases deliver the specialized COR, RBI, FFS and INS calculation/review experiences and other domains.

No Java backend, SSO identity provider, server authorization, or live engineering calculation has been connected to `apps/aim-next`.

## Local checks

Run on the pinned Node/pnpm toolchain (Node 24+, pnpm 12+):

```bash
cd aas-aim
pnpm install
pnpm --filter @bandha/aim-next typecheck
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
```

Note: isolated TypeScript/Node structural checks may pass in this authoring environment without demonstrating that the official Vite/Vitest suite ran.
