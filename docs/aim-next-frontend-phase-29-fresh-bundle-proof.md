# AAS–AIM — Phase 29: Fresh-Bundle and Preview-Serving Proof

**State: source implementation complete; real release toolchain still BLOCKED.**

## Why this phase exists

A successful Vite command and the mere presence of `dist/index.html` are not
sufficient to prove that the inspected file belongs to the current attempt.
A preview process that printed a listening URL is also not proof that the
correct built app and its entry assets are available over HTTP.

Phase 29 makes those two assumptions explicit verification gates. It does
**not** claim to close the existing missing-dependency and runtime blockers.

## Changes

- `scripts/release-runtime-guards.mjs` adds dependency-free CLI commands:
  - `clear-dist`: remove only `apps/aim-next/dist` before the Vite production build.
  - `assert-dist`: verify nonempty built `index.html`, React root, emitted
    JavaScript entry, and every referenced JavaScript/CSS entry file.
    Reject source development paths, off-site URLs, and traversal paths.
  - `probe-preview <url>`: verify HTTP serves the **exact** generated index
    and that each referenced emitted entry asset returns nonempty content.
- `scripts/release-runtime-guards.test.mjs` tests valid output and failure
  conditions with disposable local fixtures and an ephemeral HTTP server.
  This does **not** use Vite or imply the production preview has run.
- `scripts/release-validation.sh` performs `clear_previous_build` before
  `vite_production_build` and uses `assert-dist` and the new preview HTTP probe.
- `scripts/release-evidence.mjs` tracks 14 required ordered gates and writes
  a new `qa/phase29-release-gates.json` instead of rewriting the earlier
  Phase 28 trace. CI uploads this Phase 29 trace and triggers on guard changes.
- Existing release approval remains separate: all gates passing would be
  `RUNTIME_GATES_PASSED_AWAITING_REVIEW`, not production approval.

## Evidence from this environment

| Check | Actual result | Scope |
|---|---|---|
| Offline registry/model regressions | **1,814 / 1,814 passed** | Not Vitest |
| Node.js release + lockfile + runtime-guard tests | **16 tests passed** | No production dependency install |
| Browser matrix definition | **3 / 3 passed** | 78 × 4 audit *defined*, not executed |
| Design tokens | **171 checked** | Offline |
| CSS viewport fixture | **4 / 4 passed** | Only CSS fixture |
| Chromium native focus semantics | **Passed with /usr/bin/chromium** | Only standalone DOM fixture |
| TS/TSX parse with TypeScript 5.8.3 | **150 files; zero errors** | Syntax only, not TS 7 typecheck |
| Workflow YAML and shell syntax | **Passed** | Workflow not executed |
| `bash scripts/release-validation.sh` | **FAIL at toolchain_preflight (expected)** | Node 22.16, no pnpm 12.14, no pnpm-lock.yaml |
| Vite build / official Vitest / mounted 312 checks | **NOT EXECUTED** | Blocked on registry-backed toolchain |

The CLI's probe is designed for the real Vite build and preview, but only
its ephemeral HTTP **test fixture** was exercised here. Its ability to find
incompatible real Vite output remains unverified until a real run.

## Scope preserved

The two canonical registries (`src/capabilityRegistry.ts` and
`src/screenRegistry.ts`) were byte-for-byte unchanged from Phase 28:
**190 function identities, 15 domains, 78 canonical screens**.
No engineering backend integration or domain calculations were added.

## How to close the production blockers

1. Place this complete workspace in an accessible reviewable GitHub repo.
2. Run `AIM Next lockfile candidate (manual, unreviewed)` in Actions.
   Review the generated dependency graph, security, integrity, licenses,
   peer dependencies and approved build scripts; do not treat artifacts
   as automatic permission to commit a lockfile.
3. Add the reviewed `pnpm-lock.yaml` via PR and run `AIM Next UI quality`
   on the exact reviewed commit. Confirm the recorded 14 gates, including
   fresh bundle proof, real Vitest, strict TS 7, Vite build, preview and
   78 × 4 browser audit.
4. Fix genuine test/runtime failures before production sign-off. CI success
   itself is not approval for production use or engineering authority.

**The provided source archive has not undergone a production dependency
install, build, real mounted-app audit, or release sign-off.**
