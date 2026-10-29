# Phase 25 — Reproducible Dependency Bootstrap & Reviewable Release Prerequisites

**Release status: BLOCKED.** Source implementation and offline checks exist; no real Node 24, pnpm 12, locked install, TypeScript 7, Vitest 5, Vite 8 or mounted app E2E run is claimed on the build machine used for this archive.

## Purpose

Phase 24 could not produce a genuine `pnpm-lock.yaml` because the authoring container runs Node 22 and cannot resolve the npm registry. A fake or hand-written lockfile would damage provenance. Phase 25 creates a manual, **registry-backed GitHub Actions lockfile candidate workflow** so an authorized maintainer can run dependency resolution on a real CI runner, inspect the result and commit only after review.

This phase deliberately does not add fake engineering APIs, authorizations, or production capability claims. All canonical identities (190 functions, 15 domains, 78 screens) are preserved.

## What is added

1. `.github/workflows/aim-next-lockfile-candidate.yml`: **workflow_dispatch only**. Checkout and install pinned Node 24 / pnpm 12.14.0. Reject overwrite of an existing checked-in lockfile. Resolve dependencies using `pnpm install --lockfile-only --ignore-scripts`, then verify that a frozen lockfile-only install works. Attempt the entire existing release script (frozen install, token check, TypeScript, offline regression, Vitest, Vite build, preview startup and mounted 78-screen Chromium audit) on the UNREVIEWED candidate. A failing candidate gate does not hide the artifact: logs report failure and job ends red after artifact upload. The workflow cannot commit or approve anything (`contents: read`).
2. `scripts/lockfile-candidate-report.mjs`: creates review metadata with SHA-256 and a list of pinned *direct* dependencies. An artifact remains `CANDIDATE_AWAITING_HUMAN_REVIEW` even if non-browser checks pass. It never certifies transitive packages, vulnerabilities, licenses, code review or production compliance.
3. `scripts/lockfile-candidate-report.test.mjs`: four dependency-free Node unit tests for honest report labeling, file validation, manifest consistency, and failure behavior. **Tests use fake miniature buffers solely as unit-test inputs**; the package does **not** contain an invented production `pnpm-lock.yaml`.
4. `apps/aim-next/package.json`: makes the pnpm 12.14.0 pin consistent with `apps/web` and CI.
5. `scripts/release-preflight.mjs`: checks the exact pnpm version, both app packageManager pins, exact direct dependency versions, cross-workspace version parity, and strict peer/engine config, while preserving the Node and lockfile gates.
6. `scripts/release-validation.sh` and `.github/workflows/aim-next-ui.yml`: run the additional self-tests before the production build gate.

## Maintainer instructions — lockfile candidate through GitHub

1. Push/import this project into the intended GitHub repository. Confirm GitHub Actions is enabled; only authorized maintainers should run the manual workflow.
2. In **Actions → AIM Next lockfile candidate (manual, unreviewed) → Run workflow**, execute on a trusted branch that does not already contain a lockfile.
3. Inspect workflow logs, especially the candidate gate outcome. Download artifact `aas-aim-phase25-lockfile-UNREVIEWED`. It contains `pnpm-lock.yaml`, the SHA-256 inventory and review checklist. **The existence of an artifact does not mean tests passed.**
4. Inspect all resolved packages and changes, direct and transitive constraints, provenance, licenses, available advisories, and peer dependency resolution. Resolve any failing candidate gate. Recompute the SHA-256 and confirm the checked-in lockfile matches the reviewed file.
5. Submit the reviewed lockfile as a code-reviewed change. Run the normal `AIM Next UI quality` CI on the exact commit containing it. The normal CI must repeat the frozen install, real typecheck, Vitest, Vite build and mounted Chromium 78-screen route audit **on the reviewed commit**, even if candidate checks passed. Sign off only when the entire job passes.

## Local alternative (only with real registry access)

```sh
# From aas-aim repository root, on Node 24 and pnpm 12.14.0:
pnpm install --lockfile-only --ignore-scripts
node scripts/lockfile-candidate-report.mjs
# Review lockfile and QA candidate metadata before committing.
# Run the complete release gate after lockfile review / commit:
bash scripts/release-validation.sh
```

`pnpm` and Node must actually be installed; the local authoring container used for this phase lacks the supported versions and cannot reach npm. The report script does not magically resolve dependency metadata.

## Explicitly not passed or verified

- Actual registry resolution / production `pnpm-lock.yaml` creation
- React / jsdom interaction tests, pinned TypeScript typecheck, production Vite build
- Mounted Chromium audit of 78 screens and runtime keyboard/focus behavior
- Full WCAG accessibility conformance, backend authentication, data authorization, engineering approval or real services
- Running either of the GitHub Actions workflows

The Phase 25 offline tests check the candidate report's code, not the correctness of any real dependency lockfile. The report's test fixtures are synthetic and isolated from production artifacts.
