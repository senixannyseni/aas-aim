# Future AAS–AIM · Frontend Phase 13 · Governance & Control Plane

**Baseline:** AIM Master Architecture Specification v1.0 (frozen)  
**Domain:** GOV-001–GOV-014 · 14 active functions  
**Canonical surfaces:** SCR-GOV-001–012, with SCR-GLB-001 already supplied by the application shell  
**Status:** Interactive, read-only frontend; authoritative identity, permissions, audit, retention, approval, evidence storage, and AI execution services **NOT CONNECTED**.

## Screen delivery

| Screen | Rendered records and interactions | Authority boundary |
|---|---|---|
| SCR-GOV-001 | Human/service principals and tenant references; search, inspect | No browser-side login or provisioning |
| SCR-GOV-002 | Access profiles, capabilities, scoped grants | Displayed grants never enable actions |
| SCR-GOV-003 | Principal/profile/scope grants | Backend owns enforcement of all grants |
| SCR-GOV-004 | Engineering approval authorities and bounded delegations | Human authority independent of administrative role |
| SCR-GOV-005 | Controlled workflow/state policies | Cannot activate a state transition |
| SCR-GOV-006 | Server-provided audit events, outcomes and integrity references | UI does not append or cryptographically attest audit |
| SCR-GOV-007 | Controlled revision chains and historical references | Historical revisions remain read-only |
| SCR-GOV-008 | Controlled methodology/configuration package provenance | Exact-revision approval/activation unavailable |
| SCR-GOV-009 | Notification routing and escalation rules | Preview does not deliver a notification |
| SCR-GOV-010 | Governed evidence artifact metadata, SHA-256 reference and retention | No file bytes, signature validation or upload |
| SCR-GOV-011 | Retention policies and separate legal holds | Preview cannot release holds or delete data |
| SCR-GOV-012 | AI policy, allowed tools, prohibited transitions and execution provenance | No AI authority to approve engineering state |

The existing `SCR-GLB-001` application shell remains a composition and navigation surface; it has not been connected to a real IdP. `GOV-012` Universal Search appears in `SCR-HOM-003` as an existing shared architectural target, not an operational cross-domain search service. `GOV-001` Authentication/SSO remains a separate real-identity-provider integration milestone. `GOV-006` immutable audit logging remains a backend milestone.

## Snapshot contract

- `FutureAimApp` accepts `governanceSnapshot?: unknown` and `governanceScopeKey?: string`.
- The caller must authorize and filter governance records to the current principal/tenant/site **before** providing a snapshot. The frontend cannot verify that authorization.
- The scope key must change when the authenticated identity, tenant or access scope changes, clearing UI selections and local notes.
- The model requires a complete 16-collection object with strict per-record fields and bounded collection sizes: tenants, principals, profiles, grants, authorities, delegations, policies, auditEvents, revisions, packages, notificationRules, evidence, retentionPolicies, holds, aiPolicies, aiExecutions.
- IDs are unique per collection; invalid timestamps, unexpected fields, control characters, duplicate capabilities, nonexistent or cross-tenant references, and structurally invalid approvals fail the **entire** batch.
- Human-only engineering authority: neither a service principal nor a tenant administrator automatically has discipline-specific engineering authority. Delegations must have proper principals, scope, source authority and effective intervals.
- Active workflow policies, packages and AI policies require a known active human approver in their tenant; historical revision chains must be consistent. Historical audit actor references and AI source audit references may remain external because archives may be partitioned.
- Evidence SHA-256 is validated as a 64-digit hexadecimal metadata field, **not** verified against bytes in the browser. Retention and legal hold records remain distinct.
- AI output types are advisory (`EXPLANATION`, `DRAFT`, `ASSISTIVE_ANALYSIS`). They cannot represent an approved engineering decision.
- Parsed records are copied and frozen. Supplied caller objects are not mutated or frozen. Missing snapshots are shown as disconnected; valid zero-record snapshots are empty; invalid snapshots are rejected without displaying partial records.

## Files

- `src/features/governance/governanceModel.ts`
- `src/features/governance/GovernanceDomainWorkspace.tsx`
- `src/features/governance/governanceModel.test.ts`
- `src/features/governance/GovernanceDomainWorkspace.test.tsx`
- `src/features/governance/governanceFixtures.test-utils.ts` (synthetic tests only)
- `src/FutureAimApp.tsx` (integrated GOV snapshot and scope-key props)
- `src/styles.css` (scoped GOV presentation styles)

## Verification

89/89 model regression cases executed in a local isolated TypeScript runner against the production parser and actual frozen screen registry. Strict isolated TypeScript 5.8.3 checking across the frontend passed. React/jsdom interaction tests are defined but not executed with official Vitest here; pinned TypeScript 7 / Node >=24 / pnpm12 and a real browser build require project dependencies and a compatible toolchain. All 171 foundation design tokens continue to pass their generation check.

## Remaining authoritative integrations

Actual SSO/IdP, capability and resource-scope enforcement, protected command endpoints and revision binding, immutable cryptographically secured audit, evidence binary storage and verification, legal hold controls, notification execution, methodology package approval, and AI-policy enforcement. Never derive UI authorization from this snapshot or from an administrative role. Pending backend integrations are not implied completed by rendering GOV screens.
