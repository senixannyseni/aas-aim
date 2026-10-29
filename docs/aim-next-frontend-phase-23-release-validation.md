# Future AAS–AIM — Phase 23: Executable release validation (blocked pending runtime)

**Status: partially implemented; NOT a validated production release.**

Phase 23 uses the Phase 22 cumulative source archive (191 files), preserving the frozen 190 function IDs, 15 domain boundaries and 78 screen identities. In the current environment the official React/Vitest, production Vite and mounted Chromium checks **cannot be executed**. Do not promote the release on the basis of offline tests.

## Engineering changes in this phase

1. Fixed an actual hash-navigation accessibility defect in `FutureAimApp.tsx`: activating “Skip to main content” previously navigated to `#next-main`, and the hash route listener treated that as an invalid route and returned to architecture overview. The link now prevents the conflicting fragment navigation and directly focuses the existing `#next-main` region. Two React regression tests have been **defined but not executed**.
2. Expanded the existing Playwright mounted-app audit to explicitly cover keyboard Tab/Shift+Tab wrapping in the mobile navigation drawer, dismissal by backdrop and Escape, function-inspector Escape/focus return, and skip-link preservation of the canonical route. It continues to cover all 78 canonical routes, invalid-route denial, disconnected-state honesty, 320/375/768/1280 px layout widths and uncaught page errors. This is **executable source, not a passed E2E run**.
3. Added `scripts/release-preflight.mjs`, a non-mutating preflight that checks the Node and pnpm major versions, presence of a workspace lockfile, exact dependency versions and declared engine policies. `--strict` exits with error when prerequisites are absent. Presence of a lockfile does not establish that it has been human-reviewed.
4. Added `scripts/release-validation.sh` to enforce preflight, frozen installation, design-token consistency, real TypeScript checks, offline regressions, actual Vitest, actual Vite build, built HTML output and the mounted-app Chromium audit. The script fails closed: it cannot print final success until every step passes. `AIM_CHROMIUM=/path/to/chromium` can select a system binary.
5. Hardened `.github/workflows/aim-next-ui.yml`: pinned pnpm action version, requires release preflight and `pnpm install --frozen-lockfile`, and watches release-script changes. The workflow will deliberately fail on the missing lockfile until one has been generated and reviewed. **No GitHub Actions run has been executed here.**

## Checks actually performed here

| Check | Result |
|---|---|
| ZIP Phase 22 input | Valid; all files readable |
| Offline registry/model/UI-dispatch regression | **1,814/1,814 passed**, 20 suites |
| Generated design tokens | **171 current** |
| Chromium CSS-only fixture at 320, 375, 768, 1280 px | **Passed**; NOT the mounted React app |
| tinycss2 stylesheet top-level syntax parse | **0 errors** |
| New and edited TSX source parsing via globally installed TypeScript 5.8.3 | **Passed**; not typechecking, not pinned TypeScript 7.0.2 |
| Expanded browser-audit Python syntax | **Compiled**; not executed against mounted app |
| Release validation shell syntax | **Passed** |
| CI YAML parse | **Passed** |
| Strict release preflight | **Blocked as intended**: Node v22.16.0, pnpm unavailable, workspace lockfile absent |
| Dependency registry | `npm view react version` failed with `EAI_AGAIN` resolving registry.npmjs.org |

## Not performed; required before release sign-off

- The real, pinned TypeScript 7.0.2 `pnpm --filter @bandha/aim-next typecheck` invocation.
- The full `pnpm --filter @bandha/aim-next test` run, including two Phase 23 tests and the Phase 22/earlier UI tests.
- A real `pnpm --filter @bandha/aim-next build` production bundle.
- Playwright's 78-route mounted React audit, including focus, dialogs, overflow and error checks.
- Any comprehensive WCAG/axe accessibility assessment. The Playwright keyboard checks are **not** a substitute for that review.
- Review of a generated workspace lockfile and package supply-chain risks.
- Authenticated backend, tenant isolation, approved engineering commands, authoritative data service integrations, and secure offline field synchronization.

## Completing the release on a compatible machine

From `aas-aim/`, with Node.js 24–26 and network access:

```bash
npm install --global pnpm@12.14.0
pnpm install --lockfile-only
# Review and commit pnpm-lock.yaml; check all transitive package changes.
# Before sign-off, inspect vulnerable dependencies, licenses, integrity and provenance.
bash scripts/release-validation.sh
```

For a system-managed Chromium installation:

```bash
AIM_CHROMIUM=/usr/bin/chromium bash scripts/release-validation.sh
```

The mounted audit requires Python 3.13, Playwright 1.57.0 and a compatible Chromium. Install them separately using the steps in the CI workflow. Run the validation script in a clean environment, retain the complete output and investigate any failures. Only a passing real release run with the reviewed committed lockfile justifies a validated release claim. Do not rely on prior offline harness success or source-compilation success.

## Preservation

The Phase 22 archive contained 191 files. Compared by content hash, Phase 23 preserves **188 files byte-for-byte**, modifies 3 files (`FutureAimApp.tsx`, browser audit, CI workflow), and adds 5 (`phase23.skip-link.test.tsx`, preflight script, release script, this report and QA JSON). The resulting cumulative release archive contains **196 files**. No canonical registry or domain implementation was modified.
