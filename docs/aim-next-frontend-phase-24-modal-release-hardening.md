# AAS–AIM Phase 24 — Modal Isolation & Browser Release Gate Hardening

**Status: implementation candidate; production release remains BLOCKED.**

This phase follows the partially validated Phase 23 release candidate. It does **not** change the frozen 190-function registry, 15 domains or 78 canonical screen identities. No real backend integration, tenant authorization, engineering approval or trustworthy offline sync is introduced.

## Fixes delivered

1. **Modal background isolation:** opening the mobile navigation drawer now makes the main application body and skip link `inert`. Opening the function-inspector dialog also makes the sidebar `inert`. This improves alignment between `aria-modal="true"` and actual keyboard/pointer isolation.
2. **Backdrops removed from sequential Tab order:** both backdrop buttons use `tabIndex={-1}` while remaining clickable. Escape continues to close either modal; normal dismissal returns focus to the trigger.
3. **Body scroll lock:** open dialogs temporarily set `document.body.style.overflow = "hidden"`, restoring the prior inline value after dismissal/unmount.
4. **Inspector screen-navigation focus:** selecting a mapped screen from the inspector now focuses the destination `#next-main` after closing the dialog. This also applies if the route's ID does not change. Ordinary dismissal still returns to the invoking capability.
5. **Unique accessible close label:** the inspector backdrop is named "Dismiss function detail backdrop" rather than having the same "Close function detail" accessible name as the dialog's close button. The duplicate label would make existing `getByRole` assertions ambiguous.
6. **React regression coverage:** four Phase 24 tests defined for modal isolation, lock/restoration, focus trap and mapped-screen navigation. Earlier Phase 20–22 test queries were updated to use a captured menu element while that menu is intentionally inert, preventing dependence on whether the test accessibility-tree implementation exposes inert descendants.
7. **Mounted browser audit strengthened:** adds modal `inert` and scroll-lock checks, backdrop Tab exclusion, and function-inspector mapped-screen keyboard focus checks. These are **defined, not executed** against the built app.
8. **CI preview startup gate strengthened:** the Chromium job now verifies that its own Vite process announced the configured strict-port URL and remains alive before running browser tests, instead of relying solely on an HTTP response that might come from a different service.

## Executed here (offline evidence only)

- 1,814/1,814 offline registry/model/dispatch regressions; 20 suites loaded.
- 171/171 design tokens current.
- Chromium *stylesheet-fixture-only* smoke at 320, 375, 768 and 1280 CSS pixels.
- `tinycss2` top-level CSS parse: 0 errors.
- TypeScript 5.8.3 **parser** across 100 TS/TSX source and test files: 0 syntax errors. This is **not typechecking**.
- Playwright browser audit Python syntax: passes compilation; **not mounted-app execution**.
- Release bash script syntax: passed; CI YAML parsed.
- Strict release preflight: **BLOCKED (expected)** on Node v22.16.0 instead of >=24 <27, absent pnpm 12, absent `pnpm-lock.yaml`.
- npm registry DNS not reachable (`registry.npmjs.org`: cannot resolve host).

## Required external execution before release sign-off

On a clean machine with Node 24–26, network and pnpm 12:

```bash
cd aas-aim
npm install -g pnpm@12.14.0
pnpm install --lockfile-only
# Review generated pnpm-lock.yaml before committing it.
# Verify package availability, peer resolution, licenses, vulnerabilities, provenance.
pnpm install --frozen-lockfile
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
# Configure Playwright/Chromium and run the full gate:
AIM_CHROMIUM=/usr/bin/chromium bash scripts/release-validation.sh
```

Resolve every actual TS/Vitest/Vite/browser test failure in the real environment. The Phase 24 changes and all prior interaction tests remain **runtime-unverified** here. The existing offline-suite count is unchanged because these React tests were not executed.

No comprehensive WCAG/axe pass was performed, and adding `inert` does not by itself establish WCAG conformance. Authenticated data scopes, engineering approvals, server-side permissions and production integrations remain blocked on separately controlled backend work.
