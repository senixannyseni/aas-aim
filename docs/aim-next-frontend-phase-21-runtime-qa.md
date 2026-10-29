# Future AAS–AIM — Phase 21: Runtime Integration and UI Quality (Tranche 1)

## Release identity

Increment from Phase 20's 180-file archive. The frozen 190 active function IDs, 15 domains, 78 canonical screen IDs, and two retired VIS function IDs remain unchanged. No API permissions, engineering calculations or approvals were connected.

## What was improved

1. **Single rendering-owner resolver.** `src/workspaceResolver.ts` maps each canonical screen to exactly one frontend presentation path. The three HOME surfaces resolve explicitly to the Analytics dashboards or Universal Search. The global shell resolves to a non-engineering `SHELL` fallback. Unknown/retired IDs return `null`; they never silently receive an engineering workspace. `FutureAimApp.tsx` now uses this resolver to choose its domain components rather than separately interpreting shared screen IDs across its render expression.
2. **Browser-route state cleanup.** Hash-based navigation now dismisses an open function inspector and closes the mobile sidebar, preventing stale modal/navigation layers after browser Back, Forward or manually entered canonical links.
3. **Permanent route checks.** `workspaceResolver.test.ts` adds 105 offline-executable cases checking registered screen coverage, 78 exact screen render mappings, shared ownership, 15 domain paths and rejection of malformed route identities. `FutureAimApp.phase21.routes.test.tsx` defines 84 official Vitest/jsdom cases, including one initial-navigation smoke per registered screen, invalid routes and browser navigation transitions.
4. **Optional browser CSS smoke.** `scripts/viewport-css-smoke.py` mounts a minimal structural HTML fixture with the actual application stylesheet in installed Chromium at 320/375/768/1280 px. It checks viewport overflow and mobile/desktop navigation visibility. This verifies CSS layout behavior in the fixture; it does **not** execute the React bundle, engineering domain components or Vite.
5. **Real-toolchain CI specification.** `.github/workflows/aim-next-ui.yml` is a proposed GitHub Actions workflow running Node 24 + pnpm 12, design-token validation, official typecheck, offline model checks, the real Vitest/jsdom suite and Vite production build. It is only **configured**, not executed. A reviewed workspace lockfile is still needed for reproducible frozen installation.

## Checks actually executed

| Check | Result | Meaning |
|---|---|---|
| Offline regression model + registry + workspace routing | **1,814/1,814 passed; 20/20 suites loaded** | Actual source transpiled by installed TypeScript and run using the documented limited assertion adapter; NOT Vitest |
| Strict isolated TypeScript | **Passed** | All current app and React-test TS/TSX sources checked with locally supplied React/testing-module declaration stubs and installed TypeScript; NOT the pinned TS 7 toolchain |
| CSS parser | **Passed** | tinycss2 parses stylesheet; not proof of visual correctness |
| Design tokens | **171 current** | Token generator check |
| Chromium CSS structural fixture | **4/4 viewports passed** | Tests shell style/layout at 320, 375, 768, and 1280 px; not mounted React or full domain layout |
| Phase 20 source preservation / ZIP integrity | **Verified during packaging** | Unrelated original files unchanged |

## Checks **not** executed

The environment has Node 22.16, does not have the project's pinned Node 24+/pnpm 12 dependencies (`react`, `react-dom`, `vitest`, `jsdom`, `vite`, `@testing-library/react`), and `registry.npmjs.org` cannot be reached (`EAI_AGAIN`). Consequently **official React tests, the Vite production build, actual 78-screen browser navigation, end-to-end authentication and accessibility testing remain open**. The 84 new React tests are only defined and typechecked in the isolated environment.

## Commands for the user's pinned development/CI environment

```bash
cd aas-aim
pnpm install --no-frozen-lockfile  # temporary until a reviewed pnpm-lock.yaml is committed
pnpm --filter @bandha/aim-next typecheck
pnpm --filter @bandha/aim-next test:model-offline
pnpm --filter @bandha/aim-next test:phase21
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
```

Optional fixture test when Python Playwright and Chromium are installed:

```bash
python apps/aim-next/scripts/viewport-css-smoke.py
```

## Remaining release gates

- Execute official Vitest/jsdom and resolve any real React runtime failures. Run the 78 canonical screen-route tests in mounted React, not only source/pure-function checks.
- Run the pinned `vite build` and smoke the served bundle at 320, 375, 768 and 1280 px using Playwright across representative data states.
- Audit WCAG 2.2 AA keyboard focus, dialogs, tables, skip navigation, and contrast in the actual application, not just in a CSS fixture.
- Generate, review and commit a pinned `pnpm-lock.yaml` and require `--frozen-lockfile` before treating CI installs as reproducible.
- Implement authenticated, authorized API services, authoritative engineering commands, audit logs, and durable field storage separately. Read-only frontend displays cannot grant engineering approval.
