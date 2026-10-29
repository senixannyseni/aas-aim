# Future AAS–AIM — Phase 11: Integrity Operating Windows (IOW)

**Baseline:** Frozen AIM Master Architecture Specification v1.0  
**Domain:** IOW — 11 active functions, 4 canonical screens  
**App:** `apps/aim-next` (separate from the foundation Asset Register prototype)

## Shipped frontend surfaces

| Screen ID | Surface | Canonical function ownership |
|---|---|---|
| SCR-IOW-001 | IOW Register | IOW-001, IOW-009, IOW-010 |
| SCR-IOW-002 | IOW Definition Workspace | IOW-001–005, IOW-009 |
| SCR-IOW-003 | IOW Monitoring / Excursions | IOW-006, IOW-008, IOW-010 |
| SCR-IOW-004 | IOW Excursion Review | IOW-007, IOW-011 |

Capabilities: filtering and inspection of source-backed IOW definitions; controlled thresholds with explicit units and revision; historian/manual/derived source mapping and quality assessment; links to AIR assets, DGM mechanisms and barriers; observation and excursion histories; separate process recovery and engineering disposition; externally recorded FND/INS/DGM/ACT/REC/RBI/FFS follow-up references. Local, unsaved review notes can be edited and cleared. Cross-screen navigation uses canonical `SCR-IOW` IDs.

## Runtime boundary

The React `FutureAimApp` accepts the optional `iowSnapshot` and `iowScopeKey` props. The application does not create operational sample data; the default is `null`/disconnected. A future authoritative, scope-enforcing integration must provide these props and rotate the scope key whenever the authenticated user, tenant, site or accessible monitoring dataset changes. The scope key is a React remount identity—not an authorization mechanism.

`parseIowSnapshot(unknown)` rejects the **entire batch** on malformed or inconsistent object records. No partial data is surfaced. It requires typed identities, controlled timestamp syntax, immutable revision-matched IOW definitions and limits, correct source-to-variable and source-to-asset links, explicit missingness on samples, unique current source-quality records, and independent exact-revision technical dispositions. It checks the coherence of received data; it does **not** prove that the source is authenticated, physically correct, suitably current or authorized.

This frontend does **not** calculate exceedances, derived variables, excursions or IOW compliance from numeric observations. A `VALID` sample is an upstream quality label, not a pass/fail classification. A disconnected, stale or missing historian source is never interpreted as compliant. A `PROCESS_RECOVERED` event is not an engineering disposition. An upstream `DISPOSITIONED` record requires a separate source-backed, evidence-bearing reviewer decision on the same excursion revision.

No frontend controls can approve an IOW definition (IOW-009), dispose an excursion (IOW-007), or initiate authoritative follow-up (IOW-011). Buttons are disabled until verified backend capability, tenant/site scope authorization, exact-revision transitions and immutable audit events exist.

## Validation and tests

- New model tests: **97 cases executed / 97 passed** with an isolated Node runner loading the real compiled TypeScript model and its permanent tests.
- New React interaction tests: **28 cases defined**, isolated strict TypeScript-checked, **not executed** in official Vitest/jsdom in this environment.
- Strict isolated TypeScript 5.8.3, CSS syntax, generated design tokens, and ZIP-file integrity validated separately.
- No operational historian, calculation engine, Java backend, permissions service or approved methodology is connected.
- Official `pnpm --filter @bandha/aim-next test`, typecheck and production build must run in the pinned Node >=24, pnpm >=12 environment. Isolated checking is not a substitute.

## Next scope

Phase 12 — FFS: FFS Assessment Register, assessment workspace (basis, flaw characterization, frozen inputs, engineering result trace, approved envelope and remaining life), and non-authoritative scenario/sensitivity screen. COR remaining life must remain visibly distinct from FFS remaining life.
