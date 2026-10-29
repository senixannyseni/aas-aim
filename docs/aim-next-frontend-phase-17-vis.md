# AAS–AIM Future Frontend — Phase 17: Visualization & Context

**Architectural basis:** Frozen AIM Structural Architecture Baseline v1.0, Artifact 1 (190 active functions, VIS-001/002 retired), Artifact 6 (78 canonical screen IDs including HOME / global shell).  
**Release:** Phase 17; builds on Phase 16 FLD; applies only to the **future** `@bandha/aim-next` frontend.

## Delivered canonical screens

| Screen | Active function | Frontend interactions |
|---|---|---|
| SCR-VIS-001 P&ID Viewer | VIS-003 (+ VIS-007, 008) | Source revision selection, verified visual object lookup, normalized coordinate preview, linked engineering overlays |
| SCR-VIS-002 2D Drawing Viewer | VIS-004 (+ VIS-007, 008) | Source drawing selection, mapping inspection, coordinate preview where supplied |
| SCR-VIS-003 3D Model Viewer | VIS-005 (+ VIS-007, 008) | Model source and revision browser, verified alignment state, mapping / overlay inspection; no fabricated 3D geometry |
| SCR-VIS-004 GIS / Map Viewer | VIS-006 (+ VIS-007, 008) | GIS source and alignment browser, source-authored normalized point preview (not a basemap or GIS computation) |
| SCR-VIS-005 Overlay Controls | VIS-007 | Independent filters for APPROVED, PROJECTED, SCENARIO, UNKNOWN and STALE; source + engineering record provenance |
| SCR-VIS-006 Visual Mapping & Alignment Admin | VIS-008 | Mapping verification / ambiguity / invalidation inspection; independent review record; source revision and spatial alignment |

**Caution:** A point displayed at normalized 0–100 coordinates is *source-provided context*, not a P&ID, physical drawing, model geometry, geographic basemap or measurement. No geometry or locations are synthesized from source references. A future trusted renderer needs controlled document/model/layer binaries, transformation metadata, identity/scope checks and source revision agreements.

## Snapshot integration contract

The `FutureAimApp` accepts `visualSnapshot?: unknown` and `visualScopeKey?: string`. Identity, tenant, site, access-scope and source-authorization changes must rotate `visualScopeKey` to remount the workspace and drop local selection/filter/notes. On missing data, the app explicitly states UNKNOWN/disconnected. Synthetic data resides **only** in `visualizationFixtures.test-utils.ts`, not production app startup.

`parseVisSnapshot()` requires exactly six bounded collections:

- `sources` — controlled source kind, revision, identifier and availability
- `assets` — scope-filtered identity references (visual data does not own equipment identity)
- `mappings` — source-owned external object references to authorized AIR asset IDs, optional normalized plot coordinates, recorded verification/ambiguity/invalidation
- `overlays` — source-backed engineering readouts with source domain, revision, classified engineering state and evidence
- `alignments` — spatial alignment state and separately referenced verification provenance
- `reviews` — human mapping review records with explicit independent decision

The validator performs schema exactness, finite/bounded coordinate checks, ISO timestamps, source-revision and cross-collection reference consistency, single-tenant checks, distinct approvals for mapping and engineering overlays, and spatial alignment requirements for GIS/3D overlays. Invalid input is rejected **atomically** (no partial visual records).

## Governance guarantees

1. `VIS-001` and `VIS-002` remain retired and receive no active implementation.
2. Verified mappings require an exact current visual-source revision, an authorized asset reference and matching review decision. PENDING/AMBIGUOUS do not become verified through visualization.
3. Geometry alignment does not modify AIR asset identity or COR/RBI engineering records.
4. Approved engineering readouts require engineering-domain provenance, a basis reference and approval evidence. PROJECTED, SCENARIO, UNKNOWN and STALE have distinct display states; local filters do not modify their classification.
5. Overlay presentation requires a current verified mapping, and GIS/3D overlays additionally require a verified alignment. Unknown or unavailable sources are never treated as healthy.
6. Verification, invalidation, engineering approval, snapshot attachment, live renderer and server mutations remain unavailable without the owning authoritative backend.
7. Source URL/model binaries and third-party map tiles are **not loaded**; there are no invented coordinates or instrument readings.

## Verification

- 100/100 permanent model regression tests executed against actual TypeScript implementation using an isolated local runner.
- 32 React interaction test cases defined and typechecked; **not executed with official Vitest/jsdom** in this environment.
- Strict isolated TypeScript 5.8.3 typechecking passed for the future frontend, using temporary React/Vitest declarations in place of unavailable pinned dependencies.
- CSS parsed, existing design-token generation checked, and cumulative archive entries verified against Phase 16.

## What remains

- Real SSO and authorization-bound VIS API, data fetching/refresh/cancellation and tenant-scoped backends.
- Actual document rendering (P&ID/2D), controlled geometry and 3D engine, GIS map tiles/transformation controls; no current source binaries are accessible.
- Provenance-backed annotations/snapshot creation as GOV-013 EvidenceArtifact, external EDMS integration INT-003, spatial alignment command services, mapping verification authorization.
- Official pinned-toolchain `pnpm install`, Vitest/jsdom, accessible keyboard and screen-reader QA, Vite build, Playwright responsive/browser testing.
- Cross-domain navigation deep links from AIR/COR/RBI/FFS screens and record-to-context integration with real contract responses.

**Milestone:** All 15 domains (190/190 function IDs) now have dedicated read-only/interactable UI surface coverage across 78 canonical screen IDs. This is **frontend scope coverage**, not operational completion of the 190 authoritative engineering capabilities.
