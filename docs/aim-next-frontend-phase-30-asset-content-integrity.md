# AAS–AIM Phase 30 — Fresh Bundle Content Integrity

## Scope

Phase 30 closes a false-positive in the production-preview gate. Phase 29 verified that `dist/index.html` was current and preview asset URLs returned HTTP 200 with nonempty bodies, but did not compare the bytes at those URLs with the fresh local build. A responding server could therefore serve an old or modified JS/CSS asset without failing the release gate.

**Implemented**: For each built HTML entry asset, `inspectBuiltDist` records its byte count and SHA-256 digest. `probePreview` requires those fingerprints, fetches the served asset bytes, and rejects size or digest mismatches. The HTML equality check, restricted asset paths, fresh `dist/` deletion before build, and preview startup checks remain active.

The new tests verify true matches, the wrong HTML, missing assets, tampered JS/CSS responses, same-length tampering, and fingerprint absence. The tests use a local HTTP fixture and are not a substitute for an actual Vite production build or mounted React browser audit.

## Evidence lifecycle

`qa/phase30-release-gates.json` is written by `scripts/release-validation.sh`. This Phase 30 version of the release trace is deliberately separate from prior Phase 29 evidence. Both CI workflows preserve its failure or success state. No local test result automatically grants production approval or human lockfile approval.

## Release closure (registry-connected CI / Linux)

1. Put this project in an accessible GitHub repository. Run the manual `AIM Next lockfile candidate (manual, unreviewed)` workflow using Node 24 and pnpm 12.14.0. Download the unreviewed artifact. Do not treat its presence as approval.
2. Inspect the generated `pnpm-lock.yaml`, dependency graph and integrity values; commit the reviewed lockfile to the identical source revision under review. Confirm no unrelated package changes.
3. Execute `AIM Next UI quality` on the reviewed commit or run `bash scripts/release-validation.sh` with Node 24, pnpm 12.14.0 and Playwright Chromium available. The frozen install, TypeScript 7 typecheck, official Vitest tests, fresh Vite build, exact asset preview check, native focus fixture and mounted 78×4 Chromium matrix must **all** pass.
4. Review the CI logs and `qa/phase30-release-gates.json` from that exact run. Record human dependency and security review separately. No approval should be inferred solely from the local execution trace.

## This environment

The available runner has Node 22.16.0, no pnpm 12.14.0, no genuine workspace lockfile and cannot resolve `registry.npmjs.org`. Thus the strict release gate stops at `toolchain_preflight`. It did **not** run the official Vitest suite, TypeScript 7 typecheck, Vite production build or mounted 78-screen × four-width browser audit.

The 190 functions, 15 domains and 78 canonical screens are unchanged from Phase 29. No engineering computation backend was connected by Phase 30.
