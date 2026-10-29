# AAS–AIM Future Frontend — Coverage Baseline v0.1

**Scope correction:** This is the **future 190-function AAS–AIM** (15 domains), not a continuation of only the smaller authenticated Asset Register prototype. The frozen AIM Master Architecture Specification v1.0 (Artifacts 1 and 6) governs function IDs and screen inventory.

## Frozen domain and screen inventory

| Domain | Functions | Primary domain screens | Initial frontend scope |
| --- | ---: | ---: | --- |
| AIR — Asset Integrity Registry | 11 | 6 | Hierarchy, equipment, attributes, relationships and integrity timeline |
| DGM — Degradation Mechanisms | 12 | 2 | Susceptibility, barriers and review |
| COR — Corrosion & Thickness | 22 | 6 | Circuits, CML/TML, readings, rates, projections and due candidates |
| INS — Inspection Management | 20 | 6 | Requirements, plans, workpacks, events, evidence and credit |
| RBI — Risk-Based Inspection | 19 | 3 | Risk input, uncertainty, calculation trace, scenarios and approval |
| FND — Findings & Integrity Condition Cases | 11 | 3 | Findings, ICC, triage and condition disposition |
| REC — Recommendations | 10 | 2 | Controlled technical recommendations, execution and verification |
| ACT — Actions, Repairs & Deferrals | 13 | 4 | Repair actions, controls, deferrals, authorization and closeout |
| IOW — Integrity Operating Windows | 11 | 4 | Operating limits, excursion monitoring, disposition and reassessment |
| FFS — Fitness-for-Service | 11 | 3 | Flaw input, method, calculation trace, approval and reassessment |
| GOV — Governance | 14 | 12 + SCR-GLB-001 | Authentication, capability scopes, approval authorities, evidence, revisions and audit |
| INT — Integrations | 11 | 6 | CMMS/ERP, historians, EDMS, APIs, mapping and reconciliation |
| ANA — Analytics & Decision Support | 10 | 6 + SCR-HOM-001–003 | Approved versus projected metrics, trends, queries and completeness |
| FLD — Field Companion | 9 | 5 | Offline workpacks, measurements, checklists, findings and sync |
| VIS — Visualization & Context | 6 | 6 | P&ID, 2D, 3D, GIS, overlays and object mapping |
| **Total** | **190** | **78** | **All IDs represented in the UI inventory** |

`VIS-001` and `VIS-002` remain retired/reserved. `SCR-HOM-001` through `SCR-HOM-003` and `SCR-GLB-001` are shared surfaces, not domain functions.

## Phase 01–02 implemented frontend structure

- Frontend-only navigation among 15 domains and 74 domain primary screen targets.
- Architecture home page with frozen function/surface counts and the cross-domain assurance chain.
- Searchable registry containing each canonical active function ID and exact title, with domain filtering.
- Function detail inspector that displays the authority boundary and blocks backend operations.
- Artifact 6 labels and verified screen-function links for the 74 domain screens, with explicit empty/UNKNOWN states and safeguards.
- Separate responsive industrial design; no seed engineering data or fake completion metrics.
- Existing `apps/web` foundation preserved in parallel.

## What is NOT yet implemented

The 78 screen targets are **shells**, not 76 completed production features. Artifact 6 links are now imported in Phase 02; full canonical Artifact 2 object schemas and API integration are still required. No engineering record CRUD, approval, calculation, evidence upload, offline synchronization, data visualization, authenticated service or Java backend integration is claimed.

## Subsequent frontend tranches

1. [Phase 02: implemented] Import Artifact 6 Screen–Function–Object links and the canonical deep-link route inventory. See `docs/aim-next-frontend-phase-02.md`.
2. Build fully functional read-only domain screens, detail drawers, status/evidence provenance and revision history from validated APIs.
3. Build input surfaces and draft validation for AIR/DGM/COR/INS/RBI/FND/REC/ACT/IOW/FFS, preserving domain ownership and state gates.
4. Add role-aware review/revision/approval UI gated by authoritative GOV policies and backend authorization.
5. Implement contextual experiences in ANA/VIS/FLD/INT, including analytics provenance and offline conflict resolution; no mobile engineering approval.
6. Per-function acceptance: keyboard accessibility, entity relationships, contract conformance, error/unknown states, race and session isolation, and traceability tests.

**Domain invariants:** Inspection owns governing technical due dates; COR and RBI supply candidates. FFS and COR remaining life are distinct. An authoritative engineering approval requires a server-authorized transition and immutable audit event. AI is advisory only and cannot approve. Unknown evidence is not valid evidence. The screen is not the owner of the domain's record.
