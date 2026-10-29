# Future AAS–AIM — Phase 22: Runtime verification gates and mobile navigation

## Scope and result

Phase 22 builds on the Phase 21 **187-file** cumulative archive. The 190 active function IDs, 15 domains and 78 screen IDs remain frozen. No authoritative data or engineering workflow was added.

**Implemented:**

1. Mobile navigation is exposed as an explicitly named modal dialog only while open. Focus enters the drawer, Tab/Shift+Tab wrap between its controls, and Escape and backdrop dismissal restore focus to the menu button. Selecting a workspace from the mobile drawer instead moves keyboard focus to the new main content region.
2. Twelve permanent React/jsdom regression tests cover this focus behavior. They have been written and type-checked but **not executed** with Vitest.
3. A real Chromium E2E audit, `apps/aim-next/scripts/browser-route-audit.py`, is now included. **When run against a built and served frontend** it checks all 78 canonical routes, unknown-route rejection, explicit backend-disconnected state, four actual viewport widths (320 / 375 / 768 / 1280), mobile modal dismissal, keyboard focus handoff, and uncaught browser errors. This script is **not** the Phase 21 stylesheet fixture.
4. `.github/workflows/aim-next-ui.yml` now has an additional mandatory browser gate after TypeScript, model tests, Vitest and production Vite build: set up Python 3.13, install Playwright 1.57.0/Chromium, start built-app preview, and execute the audit. Browser failure fails CI.
5. `apps/aim-next/package.json` defines `test:phase22` and `test:browser-e2e` commands. The browser command needs a separately running preview server.

## Checks actually executed in this environment

| Check | Actual result |
|---|---|
| Offline model/registry/dispatch regression runner | 1,814/1,814 passed, 20/20 suites loaded |
| Strict isolated TypeScript 5.8.3, with local dependency type shims | Passed (not the pinned TypeScript 7.0.2 check) |
| Generated design tokens | 171/171 current |
| CSS tinycss2 syntax parse | 0 errors |
| Real Chromium **stylesheet-only fixture** | 320, 375, 768 and 1280 px passed (not a mounted React app) |
| Browser audit source | Python syntax compiled; registry contained 78 unique rows |
| Source archive comparison | Verified against Phase 21 by SHA-256; see release manifest |

### Explicitly **not** executed here

- Official React/Vitest/jsdom tests, including twelve new Phase 22 interaction tests.
- Vite production compilation or serving the React application.
- Live Chromium 78-screen navigation E2E. The new script is ready for use but its *success has not been established*.

The installed runtime is Node 22.16.0 while the project declares Node >=24 <27. `pnpm` and pinned React/Vite/Vitest/jsdom packages are absent; npm registry access returned `EAI_AGAIN`. The offline TypeScript shims and stylesheet fixture are not substitutes for a real production build.

## Running the full release gate

From the repository root **in a Node 24, pnpm 12 environment with registry access**:

```sh
pnpm install --no-frozen-lockfile
node scripts/generate-design-tokens.mjs --check
pnpm --filter @bandha/aim-next typecheck
pnpm --filter @bandha/aim-next test:model-offline
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
python -m pip install playwright==1.57.0
python -m playwright install chromium
pnpm --filter @bandha/aim-next preview
```

In a second terminal:

```sh
python apps/aim-next/scripts/browser-route-audit.py --base-url http://127.0.0.1:4174
```

The GitHub Actions workflow executes these stages in order when run on a supported runner. It has not been run as part of this release.

## Remaining release blockers

- A reviewed `pnpm-lock.yaml` must be generated and committed for reproducible transitive dependency resolution; CI currently uses `--no-frozen-lockfile` and cannot be called fully reproducible.
- Resolve any actual Vitest and mounted React browser failures after running the new gates; do not infer success from source typechecking.
- Follow with authorized API/identity integration, exact record selection in owning domains, protected engineering commands, and durable encrypted field capture.
