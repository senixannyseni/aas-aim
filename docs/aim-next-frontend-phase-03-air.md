# Future AAS–AIM · Frontend Phase 03 — AIR

**Architecture baseline:** Frozen AIM Master Architecture Specification v1.0, Artifacts 1 and 6  
**Domain:** AIR — Asset Integrity Registry (AIR-001 through AIR-011)  
**Surfaces:** SCR-AIR-001 through SCR-AIR-006  
**Status:** Frontend-only interaction tranche; **not an operational AIM domain service**.

## Delivered

| Canonical screen | Frontend implementation | Remaining authoritative integration |
| --- | --- | --- |
| SCR-AIR-001 Asset Register | Filter, search, sort, browse, local pagination, explicit empty/invalid states | Authorized server-side search, pagination, saved views, permissions |
| SCR-AIR-002 Asset Hierarchy | Expand/collapse explicit physical parents; switch to system and functional-location groupings | Hierarchy commands, revision history, ownership and access scope |
| SCR-AIR-003 Asset Workspace | Inspect identity, classification, material/design metadata, child objects, explicit links, referenced history | Cross-domain detail tabs and authoritative data services |
| SCR-AIR-004 Asset Master Edit | Edit/reset a volatile local master-data draft; never persist it | Domain commands, exact revision checks, permission and audit |
| SCR-AIR-005 Asset Import & Validation | Paste/validate CSV, preview good candidates, reject entire invalid batches and duplicates | File storage, mapping, source reconciliation, approval, commit transaction |
| SCR-AIR-006 Relationship Explorer | Browse explicit provenance-backed links and navigate to endpoints | Graph service, access-controlled traversal, versioned relationship commands |

## Frontend boundaries

1. `FutureAimApp` accepts optional `assetSnapshot` and `assetScopeKey` props. Production startup provides neither; no accounts, fake equipment, or authorizations are created.
2. The consumer MUST verify identity and tenant/site access before passing a snapshot. `parseAssetSnapshot` checks structural integrity only; it does not grant authorization.
3. When identity, tenant or authorized scope changes, the caller MUST change `assetScopeKey`, or unmount the app. This resets selection, drafts, import text and filtered browser state, preventing reuse across scopes.
4. Every provided record requires explicit kind and lifecycle state. `UNKNOWN` is a first-class state. No missing state is silently interpreted as active or safe.
5. The runtime parser rejects duplicate IDs/tags, missing parents, cycles, dangling relationships, invalid source references, bad dates, unexpected properties and malformed batches **as a whole**.
6. Local pagination uses only the provided snapshot and is labeled accordingly. These counts are not database totals. Official server-side pagination remains to be built for this future product.
7. CSV staging has strict column definitions, an input size limit, a row limit and identity validation. Rows are **never** saved or automatically promoted; the UI's import commit button is disabled.
8. The edit screen preserves original IDs, tags, classification and state; a draft is held in React memory only. Source record replacement cannot overwrite existing identity.
9. Asset history, hierarchy and relationships are explicit input records, not inferred from UI coordinates or visual overlap.
10. AIR does not own COR, INS, RBI, FND, REC, ACT, IOW or FFS engineering records. Their future tabs must navigate or request their owning-domain services.

## Runtime types

Input shape for authorized presentation snapshots:

```ts
{
  assets: AssetRecord[],
  relationships: AssetRelation[],
  history: AssetHistory[]
}
```

These objects are intentionally smaller than the future authoritative AIR database contract. The model is a read-only presentation projection, not a persistence schema or an OpenAPI contract. Test fixtures are contained in test files only.

## Tests and tooling

- Permanent `assetModel.test.ts`: **39 test cases** executed using local TypeScript transpilation and a Vitest-compatible assertion runner against the actual model implementation.
- Permanent `AssetDomainWorkspace.test.tsx`: **12 React Testing Library cases** defined, not executed in the local environment (React/Vitest/jsdom dependencies unavailable).
- Source and test TSX passed isolated strict TypeScript 5.8.3 compilation with temporary ambient stubs. Official pinned TypeScript 7/Vite/Vitest compilation remains pending.
- All 190 functions and 78 screen targets from Phase 02 remain in the archive, with the two retired VIS IDs excluded.

## Run the future frontend

```bash
cd aas-aim
pnpm install
pnpm --filter @bandha/aim-next typecheck
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
pnpm --filter @bandha/aim-next dev
```

Local dev address: <http://127.0.0.1:5174>. Browse the AIR domain's six screen tabs. The default frontend is intentionally disconnected; real records will appear only when supplied by an appropriate verified upstream integration.

## Next frontend tranche

**Phase 04: DGM — Degradation Mechanisms.** Build two dedicated domain workspaces for 12 frozen functions: mechanism library, applicability factors, evidence references, barriers, verification criteria and controlled-review previews. Engineering approvals remain protected backend gates.
