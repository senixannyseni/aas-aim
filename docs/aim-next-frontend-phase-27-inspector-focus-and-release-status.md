# AAS–AIM Phase 27 — Inspector focus correctness and release-gate status

**Delivery class:** Source patch and offline-verified release candidate — **NOT production-validated**.

## Scope

This phase does **not** add functions, rename domains, change screen identity, or connect backend engineering authority. The complete Phase 26 archive is retained; the 190 canonical function IDs, 15 domains, and 78 canonical screens remain unchanged.

### Changes

1. **Function inspector focus-order correction.** Previously, `FunctionInspector` used the cleanup of its `useEffect` to focus the previously active element. During a React modal teardown, the rest of the app can still be `inert`; Chromium rejects focusing an inert element. `ScopedFutureAimApp` now records the actual invoking capability button at click time. On dismissal, its parent `useLayoutEffect` runs after React commits removal of the inert state, and then restores focus to that button (or to main content if it was removed).
2. **Inspector navigation retains focus priority.** Clicking a mapped screen target closes the inspector, updates the hash route, and focuses the destination main region *after* inert removal rather than refocusing the original capability. Hash-driven navigation that closes an open inspector follows the same focus-to-main rule.
3. **Permanent regression definitions.** Five new Vitest cases in `FutureAimApp.phase27.inspector-focus.test.tsx` cover Escape, Close, backdrop, navigation focus order, and removed-trigger fallback. These are **authored but not executed** on this host.
4. **Mounted-browser audit expansion.** `browser-route-audit.py` gains two assertions for Close and backdrop focus restoration in a built, mounted React app. The audit remains **not executed** because the production dependencies and build are unavailable.

## Executed verification (October 28, 2026)

| Check | Evidence | Limitation |
|---|---|---|
| Offline model/registry regressions | 1,814/1,814 PASS | NOT official React/Vitest |
| Lockfile inventory Node unit tests | 4/4 PASS | Uses synthetic test data; no real lockfile |
| Design token check | 171/171 PASS | Not a runtime check |
| CSS syntax | 1 CSS file parsed, zero top-level syntax errors | Not semantic/a11y validation |
| CSS-only Chromium smoke | 320/375/768/1280 px PASS | React app not mounted |
| Chromium native inert semantics | PASS with `/usr/bin/chromium` | Isolated DOM fixture, not mounted React |
| TypeScript syntax | 150 distinct TS/TSX files parsed, zero syntax diagnostics with TypeScript 5.8.3 | Not strict typecheck; declared production compiler is 7.0.2 |
| Workflow YAML and shell parsing | Both GitHub Actions YAML documents parse; shell syntax PASS | Not CI execution |
| Canonical production release script | Exit 1, blocked as designed | Node 22.16.0 (requires 24+); pnpm 12.14.0 not installed; no genuine `pnpm-lock.yaml` |

**Prohibited claims:** This report is not evidence that Vitest, the strict production typecheck, Vite build, the 78-screen mounted Chromium audit, WCAG compliance, or backend integration passed.

## Close Phase 27 release gates on a trusted environment

1. Import the exact Phase 27 ZIP contents into a trusted version-controlled repository that runs GitHub Actions, or into another Node 24+ host with access to the npm registry.
2. Run the *existing* manual `AIM Next lockfile candidate (manual, unreviewed)` workflow. It resolves a real `pnpm-lock.yaml` with scripts disabled and uploads an unreviewed dependency inventory. The presence of an uploaded artifact is **not** a passing check.
3. Inspect dependency provenance, transitive packages, licenses, notices, advisories, and complete candidate logs. Commit the reviewed lockfile through a normal code review; do not generate a synthetic offline substitute.
4. Run the *existing* `AIM Next UI quality` workflow on the reviewed commit. It executes `scripts/release-validation.sh`: frozen installation, design tokens, production compiler, offline models, all Vitest tests, Vite build, real Chromium inert fixture, and mounted 78-screen browser audit.
5. Fix any actual failures; rerun on the same reviewed commit. Only then consider production approval. Authorization, engineering services, tenant scope and authoritative backend decisions remain separate future release gates.

## Runtime provenance

- Local Node: v22.16.0; pnpm: unavailable; registry: DNS unreachable.
- Local syntax parser: TypeScript 5.8.3; not the pinned TypeScript 7.0.2.
- Local Python: 3.13.5; local Chromium: 144.0.7559.96.
- `pnpm-lock.yaml`: intentionally **absent**. No simulated dependency resolution is provided.

The evidence snapshot is `qa/phase27-verification-evidence.json`. No GitHub CI job or package registry install was executed in this environment.
