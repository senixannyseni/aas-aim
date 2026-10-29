# AAS–AIM Phase 26 — Real-browser focus-order repair and release-gate convergence

**Delivery classification:** implemented source + partial offline/browser-fixture verification. **Not a production-validated release.**

## What Phase 26 changes

1. **Mobile drawer focus timing** (`FutureAimApp.tsx`): the Escape and backdrop close handlers no longer call `.focus()` on a menu button while its ancestor is `inert`. A `useLayoutEffect` restores menu focus **after** React commits the removal of `inert` from `.next-body`. This addresses a browser behavior that jsdom alone does not model accurately.
2. **Responsive modal safety** (`FutureAimApp.tsx`): a resize crossing to desktop width (>800 CSS px) dismisses an open mobile modal and focuses the visible main workspace. Without this, a hidden mobile modal could leave desktop controls inert after orientation change.
3. **Regression coverage** (`FutureAimApp.phase26.focus-order.test.tsx`): three new Vitest test cases assert that focus restoration runs only after the `inert` attribute is removed, for both Escape and backdrop dismissal, and that mobile-to-desktop resizing releases the modal and focuses the workspace. **Defined, not executed here** due to missing production dependencies.
4. **Mounted-app browser audit** (`browser-route-audit.py`): adds the 375→1280→375 px live resize transition to the pending 78-route audit. No changes to canonical route inventory.
5. **Real Chromium fixture** (`browser-focus-semantics.py`): uses a tiny standalone DOM to confirm that Chromium rejects focus on a node inside an `inert` ancestor and accepts it after removing `inert`. This fixture is **not a mounted React test**.
6. **CI convergence** (`aim-next-ui.yml` and `release-validation.sh`): reviewed-commit CI and the manual lockfile-candidate workflow use the same canonical release shell script for frozen installation, tokens, TypeScript, regressions, Vitest, Vite, preview startup and mounted Chromium 78-route audit. The shell script also executes the focus-semantics fixture. Reviewed-commit CI preserves a log artifact even if validation fails and is triggered by changes in `apps/web/package.json`.

## Checks actually executed during Phase 26

| Test | Actual result | Important scope limit |
|---|---|---|
| Offline registry/model/dispatch regression | **1,814 / 1,814 passed; 20 / 20 suites** | Not Vitest or mounted app |
| Design tokens | **171 / 171 verified** | CSS design tokens only |
| Existing Node lockfile report unit tests | **4 / 4 passed** | No real resolved lockfile |
| JS/TS/TSX syntax parsing | **149 TS/TSX files parsed with zero diagnostics** | TypeScript 5.8.3 parser, not pinned TypeScript 7 typechecking |
| CSS top-level syntax | **0 parser errors** | Not all CSS semantics or visual regressions |
| CSS-only Chromium viewport fixtures | **4 / 4 passed** | 320, 375, 768, 1280 px; not React |
| Native Chromium inert-focus DOM fixture | **Passed in installed `/usr/bin/chromium`** | Confirms browser semantics only |
| Python browser-audit script | **Compiled without Python syntax errors** | Did not execute mounted app |
| GitHub Actions workflow YAML | **Both parsed successfully** | Workflows not run by GitHub |
| Release script shell syntax | **Passed** | Not actual production execution |
| `bash scripts/release-validation.sh` | **Exit 1, intentionally blocked by preflight** | Node 22.16.0, missing pnpm 12.14.0, absent `pnpm-lock.yaml` |

## Still unverified / blocked

- **New React/Vitest tests** (3 defined, no dependency installation available).
- **Pinned TypeScript 7 typecheck**, **production Vite 8 build**, preview startup, and **78-screen mounted Chromium audit**.
- **Genuine `pnpm-lock.yaml` resolution and review**, frozen dependency install, real CI pass and final release approval.
- WCAG conformance, backend identity/scope, domain integrations and engineering computation remain **outside this phase**.

## Reproduce with a trusted CI runner

1. If a reviewed lockfile does not exist, use **Actions → AIM Next lockfile candidate (manual, unreviewed) → Run workflow** (see Phase 25 documentation). This will generate a real candidate from npm on Node 24 and pnpm 12.14.0. Review it before committing; a candidate artifact is not approval.
2. Commit the approved lockfile as `pnpm-lock.yaml` under normal review.
3. Run **Actions → AIM Next UI quality** on the reviewed commit. This now runs `bash scripts/release-validation.sh` instead of a second drifting copy of the gates.
4. Inspect the job outcome and `aas-aim-reviewed-commit-release-log` artifact. Successful execution of the script on the reviewed commit is required before marking Phase 26 production-verified.

For local execution after supported Node, pnpm, Python Playwright and Chromium are installed:

```bash
cd aas-aim
bash scripts/release-validation.sh
```

The native browser-semantics check can also be run independently with an installed Chromium executable:

```bash
python3 apps/aim-next/scripts/browser-focus-semantics.py --chromium /usr/bin/chromium
```

## Architecture freeze

Canonical `capabilityRegistry.ts` and `screenRegistry.ts` remain byte-for-byte identical to Phase 25. There is no invented domain API, approval authority or production data. The baseline continues to define 190 functions, 15 domains and 78 canonical screens; identity coverage is not a claim of live engineering implementation.
