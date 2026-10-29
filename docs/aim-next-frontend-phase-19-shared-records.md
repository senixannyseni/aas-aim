# AAS–AIM Future Frontend — Phase 19
## Shared Evidence, Revision & Record Navigation (Tranche 1)

**Baseline:** The frozen v1.0 function registry continues to define 190 active function IDs, 15 domains and 78 canonical screen IDs. No new engineering function or primary screen is introduced in Phase 19.

## Scope delivered

1. **Independently sourced shared-record dossier:** New `recordContextSnapshot` optional prop on `FutureAimApp`, scoped to the same `navigationScopeKey` used by the pre-authorized GOV-012 Universal Search result set. It is **not** constructed by joining the 15 domain snapshots in the browser. Missing data means *disconnected*, not *no evidence exists*.
2. **Reusable dossier panels:** Evidence references and classifications; named revision history with predecessor and review metadata; related engineering records constrained to the current, separately-authorized GOV-012 result set and active search filters.
3. **Exact-record navigation handoff:** Selecting **Open owning screen** from a search result navigates to the canonical owning screen and displays the selected record identity, source revision and state in a dismissible shell banner. No implicit selection or loading into the receiving domain workspace occurs.
4. **Source-integrity enforcement:** Atomic parsing, strict identity/revision/source checks, duplicate and cross-reference rejection, ordered revision links, invalid-data refusal, no download URLs, no approval actions, and validated mapping to known canonical domain screens.
5. **UI quality:** Accessible labeled sections, pressed states for dossier tabs, keyboard focus outlines, responsive single-column facts, explicit disconnected/error/empty states and a layout that never infers an acceptable condition from missing evidence.

## Input contract

`<FutureAimApp navigationScopeKey={trustedScope} discoverySnapshot={authorizedDiscovery} recordContextSnapshot={authorizedDossiers} />`

The new dossier source is a strictly validated object:

```ts
{
  scopeKey: string;
  records: Array<{
    id: string; objectRef: string; domain: DomainCode;
    screenId: string; title: string; revision: string;
    state: DiscoveryState; sourceRef: string; assetId?: string;
  }>;
  revisions: Array<{
    id: string; recordId: string; revision: string;
    changedAt: string; changeRef: string; sourceRef: string;
    reviewState: 'CONFIRMED'|'PENDING'|'UNKNOWN';
    priorRevisionId?: string; reviewerRef?: string; reviewedAt?: string;
  }>;
  evidence: Array<{
    id: string; recordId: string; revisionId: string;
    evidenceRef: string; sourceRef: string;
    kind: 'SOURCE'|'FIELD'|'CALCULATION'|'REVIEW'|'SUPPORTING';
    state: DiscoveryState; recordedAt: string; sha256?: string;
  }>;
  relations: Array<{
    id: string; fromRecordId: string; toRecordId: string;
    kind: 'SUPPORTS'|'DERIVES_FROM'|'RESULTS_IN'|'RELATED_TO'|'SUPERSEDES';
    basisRef: string; recordedAt: string;
  }>;
}
```

- The caller, **not** the browser, must authorize and scope both data sources. A string scope marker is a consistency key; it is **not an access-control mechanism**.
- Scope keys must match the trusted `navigationScopeKey`. Rotating that key remounts navigation and clears prior in-memory selection and handoff state.
- For a dossier to render alongside a search result, exact record ID, object reference, domain, canonical screen, title, revision, state, source reference, and asset reference must agree.
- Evidence must point to the matching dossier record and a specific existing revision. SHA-256 values, if supplied, are displayed as **claimed source metadata**, not independently checked hashes. No arbitrary URLs or file downloads are accepted.
- Revisions have valid ISO timestamps, current revision matches the record/source reference, predecessor records remain within the same object, and review metadata may never be used as a proxy for qualified engineering approval.
- All relationship endpoints must be part of the same validated authorized dossier, and linked navigation is displayed only when the linked target separately matches a current, authorized Universal Search result. A related target omitted from the search index or excluded by filters is **not** shown.
- The entire shared dataset is rejected if any row is invalid. No partial dossier is displayed. Search index records remain independently governed by Phase 18 validation.

## Integration and security boundaries

The shared viewer does **not** fetch files, calculate hash digests, edit record state, approve work, add evidence, write revision history, or execute asset transitions. It does not grant access to other records or perform tenant-global searches. It does not claim that metadata represents the complete evidence corpus. Review status is metadata, not authoritative engineering approval.

The shell record handoff does **not** deep-load the selected object into the receiving workspace. That integration requires an owning-domain record loader that validates scope, asset, object identity and exact revision; until then the record banner explicitly says that the owning screen was opened without selecting that object.

## Files changed

**Added:**
- `apps/aim-next/src/features/record-context/recordContextModel.ts`
- `apps/aim-next/src/features/record-context/SharedRecordDossier.tsx`
- `apps/aim-next/src/features/record-context/recordContextFixtures.test-utils.ts`
- `apps/aim-next/src/features/record-context/recordContextModel.test.ts`
- `apps/aim-next/src/features/record-context/SharedRecordDossier.test.tsx`
- `apps/aim-next/src/features/discovery/UniversalSearchWorkspace.phase19.test.tsx`
- `apps/aim-next/src/FutureAimApp.phase19.integration.test.tsx`
- `docs/aim-next-frontend-phase-19-shared-records.md`

**Updated:**
- `apps/aim-next/src/features/discovery/UniversalSearchWorkspace.tsx`
- `apps/aim-next/src/FutureAimApp.tsx`
- `apps/aim-next/src/styles.css`

## Validation

- 142 permanent Phase 19 model regression cases executed successfully in an isolated TypeScript-to-JavaScript runner. This is **not** an official Vitest run.
- Phase 19 React components and defined test files passed isolated strict TypeScript 5.8.3 checking using local dependency shims.
- All existing 171 generated design tokens passed the check command; CSS parsed with no top-level errors.
- The official `vitest run` and production Vite build remain unexecuted until the pinned Node >=24, pnpm >=12, TypeScript 7 and application dependencies are available.
- The exact prior Phase 18 archive serves as the release baseline; existing unrelated files are preserved without modification, and the cumulative ZIP is integrity-checked.

## Remaining next-stage work

- Run the actual Vitest/jsdom suites across all domains, fix runtime issues, and run the production Vite build under the pinned toolchain.
- Add real authenticated record loaders and exact-revision deep links through owned domain APIs.
- Implement an auditable, authority-controlled evidence service with signed fetches, file-byte digest checks, retention and legal holds.
- Standardize loading/error/unknown states and responsive/accessibility checks throughout all 15 domain screens.
- Keep offline Field Companion durability and every authoritative approval/engineering calculation in their owning systems, not in these read-only shared widgets.
