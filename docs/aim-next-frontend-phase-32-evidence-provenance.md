# AAS–AIM Phase 32 — Fresh release evidence and CI closure

## What changed

Phase 32 addresses a false-evidence risk: a previous run's JSON gate report may be
shipped with the source. A later CI failure before initializing a new report
should never cause the previously successful JSON to be uploaded as current proof.

1. All new runtime gate reports go into `qa/runtime/phase32-release-gates.json`.
   This directory is Git-ignored, so CI checkout does not contain a prior result.
2. Starting a new run unlinks the previous runtime report before writing a new
   `IN_PROGRESS` trace through an atomic file replacement. A failed initialization
   cannot leave an old success visible.
3. Both GitHub Actions workflows attach the new **runtime** report path. Missing
   runtime evidence is not manufactured from old packaged source JSON.
4. Unit tests cover stale-success replacement, initialization failure, atomic
   write and CI wiring. The trace remains an informational log, not an attestation.

## Required production closure — exact sequence

The uploaded ZIP is an **offline validation candidate**, not an Actions-enabled
repository. The connected GitHub account currently does not expose a repository
containing this AAS–AIM workspace. No workflow was triggered here.

1. Publish the **contents of the `aas-aim/` folder** to the root of an appropriate
   GitHub repository with Actions enabled. Avoid committing runtime reports,
   generated dist files, secrets or node_modules. Keep source version control.
2. Run **Actions → AIM Next lockfile candidate (manual, unreviewed) → Run workflow**.
   On a registry-connected runner it creates a genuine `pnpm-lock.yaml` and an
   unreviewed dependency-report artifact. If any checks fail, inspect the logs
   and fix failures before proceeding.
3. Review the candidate lockfile (transitive dependencies, integrity, versions,
   install/build scripts, licenses and security findings). Commit it through
   normal human code review. Do **not** copy a fabricated lockfile or accept
   an offline hash as provenance.
4. Allow **AIM Next UI quality** to run on that reviewed commit. Check that the
   release script finishes every gate and that the generated
   `qa/runtime/phase32-release-gates.json` source SHA, lock SHA and CI run ID
   match the intended build. Inspect CI logs in addition to the JSON.
5. Verify real TypeScript 7, Vitest, fresh Vite build, full-output exact-byte
   preview and all 312 mounted route/viewport combinations in Chromium.
6. Do not declare production approval until human release/engineering review
   explicitly accepts the evidence. No backend-authorized engineering commands
   or approved calculations are enabled in this frontend baseline.

### Local equivalent (only where the registry is reachable)

Use Node.js 24–26 and pnpm 12.14.0. Run from the workspace root:

```bash
node --version
pnpm --version
python3 -m pip install playwright==1.57.0
python3 -m playwright install chromium
bash scripts/release-validation.sh
cat qa/runtime/phase32-release-gates.json
```

The project must have a **real reviewed** `pnpm-lock.yaml` for strict release
validation. Local execution does not create or approve a release automatically.
