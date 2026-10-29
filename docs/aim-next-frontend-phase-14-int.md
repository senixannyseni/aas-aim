# AAS–AIM Future Frontend — Phase 14: Integration (INT)

**Architecture authority:** AIM Master Architecture Specification v1.0 (frozen). 190 active functions / 15 domains / 78 screens. This release covers **INT-001–011** across all six canonical INT screen IDs. INT is a platform data-exchange domain, not an owner of engineering approval, decision, or protected state.

## Delivered source

| Screen | Canonical functions | Frontend evidence |
|---|---|---|
| SCR-INT-001 Systems & Connectors | INT-001–005 | Systems, connector modes and configuration revisions; distinction between configured connector and healthy connection. |
| SCR-INT-002 API & Event Integration | INT-006–007 | API schemas, directions, event/webhook subscriptions and independent transport state. |
| SCR-INT-003 Bulk Exchange / Migration | INT-008 | Import/export jobs, row counts, source manifests, staging status, rejected rows and dead letters. |
| SCR-INT-004 Integration Contracts & Mapping | INT-009 | Contract revision and activated state; field ownership, direction, identities, and independent mapping verification. |
| SCR-INT-005 Sync / Reconciliation | INT-010 | Reconciliation totals, exceptions, conflicts, checkpoints and dead-letter queue. |
| SCR-INT-006 Integration Health & Lineage | INT-011 | Separate connection, authentication, processing, freshness, backlog and reconciliation observations with event-level lineage references. |

## Validation and security boundary

`parseIntegrationSnapshot()` requires all 13 documented collections (empty arrays are valid), strict field whitelists, record identities, valid timestamps, tenant-consistent foreign keys, and non-contradictory statuses. Unknown fields—including inline access tokens, shared secrets, and opaque extra payloads—reject the entire snapshot. A rejected snapshot renders **no partial records**. Returned records are copied and frozen; the caller's data is never frozen.

- No bootstrap identity is derived from the INT dataset. The `integrationSnapshot` prop must be supplied by an authenticated, tenant- and scope-filtered source. `integrationScopeKey` must change on identity, tenant or authorization-scope rotation.
- A configured connector does not mean it is authenticated, online, fresh, reconciled or successful. Missing health dimensions remain UNKNOWN.
- Inbound mappings asserting AIM field ownership or targeting protected state are rejected. This structural check is a frontend precaution, **not** a complete backend field-authorization policy.
- Source import validation is not AIM approval. `PROMOTED` is shown only with a separate promotion reference and clean, fully validated rows, but still does not create approved engineering state.
- Conflicts cannot close without a separate recorded reviewer and resolution basis. A source `SUCCEEDED` reconciliation cannot conceal exceptions. Dead-letter status is separate from reconciliation status.
- Lineage transport/reference records do not establish approval. A source-provided domain-command reference may be shown only in a reconciled record; its authority must be verified by the owning server domain.
- All mutation, replay, connector configuration, policy activation and approval buttons remain **disabled**. Review notes are local, transient and explicitly unsaved.

## New and updated files

- `apps/aim-next/src/features/integrations/integrationsModel.ts`
- `apps/aim-next/src/features/integrations/IntegrationsDomainWorkspace.tsx`
- `apps/aim-next/src/features/integrations/integrationsFixtures.test-utils.ts` (synthetic, tests only)
- `apps/aim-next/src/features/integrations/integrationsModel.test.ts`
- `apps/aim-next/src/features/integrations/IntegrationsDomainWorkspace.test.tsx`
- `apps/aim-next/src/FutureAimApp.tsx` (integration and scope-aware remount)
- `apps/aim-next/src/styles.css` (responsive INT UI)
- `docs/aim-next-frontend-phase-14-int.md`

## Verification and remaining work

Permanent model regression tests can be executed in an isolated local runner using the real model source. Strict TypeScript checking uses local shims because package installation is unavailable. Official Vitest/jsdom React interaction tests, dependency-pinned Vite production build, performance testing, real identity provider, authorization, connector runtime, secrets vault, transactional imports, audit logging and server-side idempotency remain unverified/not integrated.

The user-facing app is **disconnected by default**. No synthetic external systems or false integration-health values are loaded in production. The test fixtures are never imported by runtime application code.

## Next

Phase 15: Analytics & Decision Support (ANA-001–010) across six analytics screens and three HOME surfaces, with explicit projection provenance and a strict separation between COR and FFS remaining-life values.
