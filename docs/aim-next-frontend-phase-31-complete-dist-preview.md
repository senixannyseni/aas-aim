# AAS–AIM Phase 31 — Whole-Distribution Preview Integrity

## Objective

The Phase 30 guard proved that the production preview served the same `index.html` and HTML-referenced JavaScript and CSS entry assets as the new `dist/`. That did **not** prove parity for lazy-loaded chunks, web workers, downloaded fonts/images, or copied `public/` files that are not referenced in `index.html`. A preview with a broken lazy chunk could pass the earlier gate.

## Implementation

- `scripts/release-runtime-guards.mjs` now inventories every regular file recursively under `apps/aim-next/dist/`. It rejects symbolic links and nonregular file entries rather than following them, and rejects empty assets.
- Every emitted file other than `index.html` receives a SHA-256 digest and byte count. The preview gate requests **every** emitted path over HTTP and compares the exact body to the new build's digest and byte length.
- The guard continues to require an HTML React mount element, Vite-style HTML JavaScript/CSS entry paths, a byte-for-byte `index.html` match, and a fresh `dist/` deletion before build.
- Four permanent Node tests add a lazy module and a copied SVG not referenced from HTML. They verify a valid preview, lazy-chunk corruption (including equal-length tampering), missing lazy/static assets, empty extra files and symlink rejection.
- The release evidence trace is `qa/phase31-release-gates.json`, separate from Phase 30's historical failed trace. Both CI workflows retain the latest evidence when run.

## What Phase 31 does **not** prove

These are dependency-free HTTP fixture tests. They do not establish that React renders correctly, a lazy route actually imports successfully, browser accessibility is adequate, TypeScript 7 compiles, or a production Vite bundle has been built here. The mounted Chromium 78-route × four-width audit is already defined but remains **unexecuted** until an environment with supported toolchain and registry access is available. Nor do these checks prove that any engineering analysis backend is implemented.

## How to close the production gates

1. Publish the full workspace (including `.github/workflows/`) to an accessible GitHub repository with Actions enabled, or execute on a registry-connected Linux machine.
2. Run **AIM Next lockfile candidate (manual, unreviewed)** and review the downloaded `pnpm-lock.yaml` with its dependency inventory. Keep the candidate **unapproved** until independent review.
3. Commit the reviewed lockfile against the code being released. Confirm Node 24–26 and pnpm 12.14.0, plus the Python Playwright Chromium dependencies if running locally.
4. Run **AIM Next UI quality** on that exact commit, or run `bash scripts/release-validation.sh` at the workspace root. It attempts frozen installation, TypeScript 7, Vitest, fresh production build, complete distribution/preview byte equality, native focus semantics, and all 312 mounted route–viewport checks.
5. Review full CI logs and the `qa/phase31-release-gates.json` evidence from that same commit. Production approval and a security/dependency review are separate human decisions; the script never self-approves.

**Current environment:** Node v22.16.0, no pnpm 12.14.0, no authentic `pnpm-lock.yaml`, and DNS failure for registry.npmjs.org. Consequently the strict release gate fails at `toolchain_preflight` after successfully running its first two offline stages. No production test, React mounted-app test, TypeScript 7 typecheck, Vite build, or preview has been executed in this environment.

**Preservation:** The registry sources for 190 function identities, 15 domains, and 78 canonical screens are unchanged.
