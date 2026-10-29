# Future AAS–AIM — Phase 16: Field Companion (FLD)

**Frozen architecture:** AIM Structural Baseline v1.0. **Functions:** FLD-001–009 (9 active). **Screens:** SCR-FLD-001–005 (5). **Implementation:** scoped, read-only source projection and ephemeral local draft interactions; not a production offline application.

## Canonical screen implementation

| Screen | Delivered UI | Still requires operational services |
| --- | --- | --- |
| SCR-FLD-001 My Field Work | Source-backed assigned workpack register, search, inspection, issue and revision details | Authenticated package download, durable encrypted cache, package withdrawal alerts |
| SCR-FLD-002 Field Workpack Context | Offline asset hierarchy/reference projection, CML locations, immutable package revision and recorded identity confirmation | Verified device identity, barcode/QR scan, signed package source |
| SCR-FLD-003 Field Capture | Measurement history, checklist records and local-only staging for measurement, checklist answer, evidence annotation and field finding | Native measurement-device capture, real photo/file storage, full checklist execution, transactionally persisted drafts |
| SCR-FLD-004 Field Sync Status | Source-reported sync batches and item acknowledgements/rejections/conflicts | Background durable item-level sync, idempotency, retry/backoff, server reconciliation |
| SCR-FLD-005 Field Conflict Resolution | Paired local/server revision references, independent resolution provenance and unsaved notes | Controlled conflict resolution service, review authority, immutable audit trail |

The new `FieldDomainWorkspace` is mounted via `FutureAimApp({fieldSnapshot, fieldScopeKey})`. Both inputs are optional and absent by default. `fieldScopeKey` must rotate whenever authenticated principal, tenant, authorized site/workpack or device-session identity changes; remount clears temporary selections and drafts. The caller must verify scope and server data. The frontend is **not an authorization enforcement point**.

## Input contract

`parseFieldSnapshot` validates eleven explicit arrays: `workpacks`, `assets`, `locations`, `confirmations`, `measurements`, `checklists`, `evidence`, `findings`, `syncBatches`, `syncItems`, `conflicts`.

- All records have unique per-collection IDs, a consistent tenant ID, known record shapes, bounded references and ISO timestamps. Unknown fields, non-finite measurements and inconsistent references fail the **entire** supplied snapshot, never just individual rows.
- Workpack assets are revisioned and scoped. A location belongs to the same asset/workpack. A field identity confirmation must match the workpack revision, observed equipment tag and optional measurement location revision.
- Measurements match a confirmed location, unit and recorded timestamp; field checklists reference frozen template revisions. ACKNOWLEDGED capture and sync item states require consistent server record references. These are read-only projections, not promises of persistence.
- Findings retain independent evidence IDs; a finding is not a validated condition case. A conflict requires a corresponding sync item and independent decision evidence when marked resolved. Batch completion requires all items to be acknowledged.
- Snapshot validation creates independent frozen copies of accepted records. The source snapshot remains owned by the caller.

The synthetic fixture file is named `fieldFixtures.test-utils.ts`; it is test-only and is not imported by production screens or application bootstrap.

## Local-only draft limits

The field capture interface can stage *ephemeral React-memory drafts* when the user selects an externally supplied downloaded/offline workpack, a measurement location, and a matching recorded identity confirmation. A measurement requires a finite numeric value; a checklist answer additionally selects a source-backed template and revision. The EVIDENCE option stages an annotation only, not image or file bytes.

Drafts disappear on component unmount/reload, are not encrypted or cached, and do not survive offline page closure. They are **not field work submissions**. There is no simulated sync button, fake acknowledgement, service worker, IndexedDB schema, or claimed local persistence. Full offline durability is a separate implementation milestone.

## Assurance and permissions

- FLD-001–009 cannot release inspection workpacks, approve inspection records, grant INS-012 inspection credit, authorize findings/FFS/deferrals, or modify a protected source-domain record.
- Workpack assignment, offline availability, device context and actual server acknowledgements are distinct.
- Technical closure, source-of-truth reconciliation and server-side audit remain backend-owned.
- Mobile capture is purpose-specific, not the desktop engineering approval UI in a narrow viewport.
- An externally returned `ACKNOWLEDGED` sync item only proves an acknowledgement reference was supplied, **not** engineering acceptance.

## Verification status

- 74/74 permanent field-model tests passed in a local transpiled TypeScript runner.
- Strict isolated TypeScript 5.8.3 checking passed using ambient React/Vitest module shims; pinned dependencies are not installed here.
- Permanent React interaction tests are authored and type-checked, but not run in the official Vitest/jsdom environment.
- CSS parsing, cumulative ZIP SHA comparison and baseline design token check are separately verified during the release build.

## Next

Phase 17 — VIS-003–008 Visualization & Context (six active functions and six dedicated UI screens, retaining retired IDs VIS-001 and VIS-002). Thereafter, complete full frontend integration and design/QA before claims of production readiness.
