# AAS–AIM Future Frontend (190 active functions)

A separate frontend for the frozen **AIM Master Architecture Specification v1.0**. Does not replace the existing `apps/web` foundation.

```bash
cd aas-aim
pnpm install
pnpm --filter @bandha/aim-next dev
```

The Vite dev server is configured for port 5174. `#/screens/SCR-INS-006` and similar static hash routes select individual screens.

Phase 02: 15 domain groups; 190 frozen active function IDs; **78 canonical screen IDs** consisting of 74 domain screens, three HOME surfaces, and one global shell. Each screen lists mapped functions, object-family references and protected transitions. Displaying these links does **not** constitute working engineering functions. See `docs/aim-next-frontend-phase-02.md` for limitations and planned work.

No data or approved results are fabricated in the frontend. Authentication, approvals, engineering calculations and governing data remain authoritative backend responsibilities.

## Phase 32: Real release verification and fresh CI evidence

The repository root now has a private workspace `package.json` and pins pnpm
12.14.0 and Node.js 24–26. A **reviewed, genuine** `pnpm-lock.yaml` must be
committed before the release script can run successfully.

```bash
# At the workspace root on a supported runner with registry access:
bash scripts/release-validation.sh
cat qa/runtime/phase32-release-gates.json
```

The release script runs a frozen install, strict TypeScript, actual React/Vitest,
Vite production compilation and a mounted-app Chromium audit. Its browser audit
covers **all 78 canonical screen routes at all four widths** (320, 375, 768,
1280 pixels), not just the stylesheet fixture. It also checks keyboard/focus
behavior and fails on uncaught page errors. It writes a *machine-readable gate
trace* even if a step fails. A passing trace is **not** human lockfile review,
WCAG certification, backend integration, or production approval.

For a first lockfile on a networked GitHub runner, execute the **manual**
`AIM Next lockfile candidate (manual, unreviewed)` workflow, download its
artifact, independently review the dependency tree/build-script permissions,
commit the reviewed lockfile, then run `AIM Next UI quality` on the reviewed
commit. CI job logs and `qa/runtime/phase32-release-gates.json` must both be inspected.
See `docs/aim-next-frontend-phase-32-evidence-provenance.md`.

Phase 31 additionally verifies that the preview serves every emitted distribution file—not only the HTML entry JavaScript and CSS, but also lazy chunks, workers and copied static assets—using exact byte checks and SHA-256. This guard has fixture coverage; the actual production build and preview require CI.

Phase 32 prevents an old successful release trace from being reused. Gate evidence is
written exclusively to untracked `qa/runtime/phase32-release-gates.json`, and a
new run clears previous evidence before generating its own trace. This does
**not** solve the missing Node 24, pnpm 12.14.0, registry and lockfile prerequisites.

## Phase 33: Publishing to private GitHub for first real CI execution

The cumulative ZIP is **not** a Git repository, so GitHub Actions cannot run
until the extracted `aas-aim/` folder becomes a repository root. From that
folder on a computer with Internet access and authenticated GitHub CLI:

```bash
bash scripts/github-private-bootstrap.sh --check # no side effects
bash scripts/github-private-bootstrap.sh --publish YOUR_GITHUB_USERNAME/aas-aim
```

The publish command is **opt-in**, creates a **new private repository only**,
and refuses an existing `.git` directory/remote. It does not install packages
or bypass the lockfile-review process. See
`docs/aim-next-frontend-phase-33-github-ci-onboarding.md` for exact follow-up
commands and production-release limits.
