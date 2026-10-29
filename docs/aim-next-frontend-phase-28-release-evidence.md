# AAS–AIM — Phase 28: Release Evidence and 78 × 4 Browser Audit

**Release state: runtime validation remains blocked.**

## Scope and non-goals

Phase 28 does **not** change the 190 canonical function identities, 15 domains,
78 canonical screens, or the engineering authority boundary. It fixes two
verification gaps without implying those checks have run:

1. The mounted Chromium route audit used to run each screen only at desktop
   width, with a single route at each responsive breakpoint. The planned audit
   now mounts every canonical screen at 320, 375, 768 and 1280 pixels, checking
   heading, screen ID, and document horizontal overflow for **312 combinations**.
   Other existing keyboard/focus/backdrop tests remain in place.
2. The release script previously emitted only stdout/stderr. It now writes
   `qa/phase28-release-gates.json`, recording each completed command, where a
   failure occurred, the Node version, real lockfile SHA-256 if present, and
   Git commit/CI run identifiers when available. There are 13 ordered gates.

A passing trace has status `RUNTIME_GATES_PASSED_AWAITING_REVIEW`, **never**
`releaseApproved=true`. Local reports are mutable logs, *not* signed CI
attestations. Only CI provenance, human dependency review, real runtime test
results, accessibility findings and separate release approval can close the
release gate.

## Source changes

- `package.json`: private workspace root with exact pnpm 12.14.0 and Node 24–26.
- `apps/aim-next/scripts/browser_audit_matrix.py`: pure canonical route/viewports matrix.
- `apps/aim-next/scripts/test_browser_audit_matrix.py`: three offline matrix assertions.
- `apps/aim-next/scripts/browser-route-audit.py`: 312 actual route–viewport
  assertions when later run with a built mounted app.
- `scripts/release-evidence.mjs`: fail-closed execution record and state machine.
- `scripts/release-evidence.test.mjs`: five new local transition tests.
- `scripts/release-validation.sh`: emits report before/after each mandatory gate,
  records failure on exit, and preserves preview cleanup.
- CI workflows: preserve gate JSON in artifacts; reviewed-commit workflow is
  triggered when release-evidence scripts or root manifest change.
- `scripts/release-preflight.mjs`: confirms root package engine and pnpm pins.

## Actual local checks executed in the packaging environment

| Check | Result | Limitation |
|---|---|---|
| Offline registry/model/dispatch | 1,814 / 1,814 PASS | Not React/Vitest |
| Lockfile-review inventory Node tests | 4 / 4 PASS | No lockfile generated |
| Release-evidence state-machine Node tests | 5 / 5 PASS | Does not execute build |
| Responsive matrix contract Python tests | 3 / 3 PASS | Matrix *definition* only |
| Generated design tokens | 171 PASS | No mounted app |
| Chromium CSS viewport fixture | 320/375/768/1280 PASS | CSS fixture, not React |
| Chromium native inert/focus fixture | PASS | DOM fixture, not React |
| TypeScript/TSX syntax parser | 150 files, 0 parse errors | Not strict TS 7 typecheck |
| CI YAML parse & bash syntax | PASS | Actions not run |
| `bash scripts/release-validation.sh` | EXIT 1 at `toolchain_preflight` | Node 22.16.0, no pnpm 12.14.0, no lockfile |

A real network-backed install, frozen dependency verification, official
React/Vitest suite, TypeScript 7.0.2 typecheck, production Vite build, preview,
and 312-combination mounted Chromium audit have **not** been executed here.

## Reproducible closure procedure

On a reviewable GitHub repository containing this complete workspace:

1. Run **AIM Next lockfile candidate (manual, unreviewed)** with registry access.
   The workflow must resolve a genuine lockfile; it never pushes commits or
   declares approval. If the candidate gate fails, inspect the logs, not just
   the presence of the candidate artifact.
2. Review *every* change in the resolved direct/transitive graph, licenses,
   advisories, source integrity, peer dependencies and build-script approval
   policy. The pnpm default may intentionally fail on unapproved dependency
   build scripts; avoid a broad `dangerouslyAllowAllBuilds` override.
3. Add the reviewed `pnpm-lock.yaml` to a normal branch/PR and merge only after
   review. Run **AIM Next UI quality** against the exact reviewed commit.
4. Inspect `qa/phase28-release-gates.json` *from CI*, the full CI job log,
   actual React test results, Vite artifacts, and 312-combination browser output.
   Fix any failures in source or dependency approval, re-run on the reviewed
   commit, and keep `releaseApproved=false` pending an explicit decision.

**No GitHub repository/run was available to execute for this artifact.**
The supplied ZIP is a source snapshot, not evidence of a passing GitHub job.
