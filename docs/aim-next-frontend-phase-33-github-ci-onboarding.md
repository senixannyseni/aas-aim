# AAS–AIM Phase 33 — Private GitHub CI onboarding

**Baseline:** Phase 32 ZIP, 190 function identities, 15 domain identities, 78 canonical screens.  
**Purpose:** Make the existing release workflows actionable on an external CI runner. This phase does **not** claim that any official runtime gate passed.

## What prevents real production verification today

The offline execution environment only has Node 22.16.0, not required Node 24–26, and lacks pnpm 12.14.0 and npm registry DNS access. There is no authentic `pnpm-lock.yaml`. The connected GitHub account did not expose a repository containing this AAS–AIM source. These constraints cannot be fixed by another assertion in an offline fixture. The next successful action must occur in a registry-connected CI environment.

## One-time repository bootstrap (on your workstation)

1. Install GitHub CLI and Git if needed. On Arch Linux: `sudo pacman -S --needed github-cli git unzip`.
2. Extract the Phase 33 ZIP. **Change into its `aas-aim/` directory**, not its parent directory. GitHub Actions expects the workspace files (`package.json`, `.github/`, `apps/`, `scripts/`) at repository root.
3. Run `gh auth login` and authenticate to the account or organization that will own the repository; ensure you are permitted to create private repositories and run Actions.
4. Set Git author details if needed (`git config --global user.name 'Your Name'` and `git config --global user.email 'you@example.com'`). These are Git commit metadata only; they do not authenticate GitHub.
5. Run `bash scripts/github-private-bootstrap.sh --check` to inspect the workspace without changing local files or publishing anything.
6. Review repository content for business confidentiality and credentials **before** publication, including data and fixtures. The bootstrap script refuses obvious credential files but is not a full secrets scanner.
7. To publish **only when authorized**, run `bash scripts/github-private-bootstrap.sh --publish YOUR_GITHUB_USERNAME/aas-aim`. Replace the placeholder with a real account. The command initializes a new local Git repository, commits the workspace and requests a **private** GitHub repository; it does not work on existing `.git` histories or pre-existing repositories. It requires a working GitHub API connection. It may leave a local initial commit if the remote operation fails; troubleshoot rather than rerun blindly.
8. In the GitHub repository, enable Actions if disabled by repository or organization policy.

**Do not publish this archive into `KAP-OS` or another existing application repository.** Avoid pushing an unreviewed lockfile or user data. Publication is an explicit user action; it was not performed in the offline Phase 33 run.

## Execute CI: lockfile candidate (not approval)

From a terminal authenticated with `gh`:

```bash
gh workflow run aim-next-lockfile-candidate.yml --repo YOUR_GITHUB_USERNAME/aas-aim --ref main
gh run list --repo YOUR_GITHUB_USERNAME/aas-aim --workflow aim-next-lockfile-candidate.yml
# After choosing the concrete RUN_ID displayed by GitHub:
gh run view RUN_ID --repo YOUR_GITHUB_USERNAME/aas-aim --log
mkdir -p candidate-review
gh run download RUN_ID --repo YOUR_GITHUB_USERNAME/aas-aim \
  --name aas-aim-phase25-lockfile-UNREVIEWED --dir candidate-review
```

The candidate workflow generates a real `pnpm-lock.yaml` using Node 24 and pnpm 12.14.0. It attempts the complete release script (install, TypeScript, React/Vitest, Vite build, Chromium audit) and uploads a candidate lockfile report. The job may be red if the application has real build defects. **Inspect the CI job log; an artifact does not equal a test pass.** If the job failed before the lockfile report was produced, fix the precise failure; no artifact is guaranteed.

Review dependency versions, transitive changes, integrity entries, package scripts, licenses, security advisories and the generated report. Confirm that `candidate-review/pnpm-lock.yaml` is the actual produced lockfile. Once approved, copy it to the **workspace root** and commit via ordinary code review:

```bash
cp candidate-review/pnpm-lock.yaml ./pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m 'Review and pin AAS–AIM pnpm dependency graph'
git push origin main
```

**The copy and commit commands must only be run after human review.** Do not auto-commit or fake this lockfile.

## Execute reviewed-commit CI

```bash
gh workflow run aim-next-ui.yml --repo YOUR_GITHUB_USERNAME/aas-aim --ref main
gh run list --repo YOUR_GITHUB_USERNAME/aas-aim --workflow aim-next-ui.yml
gh run view RUN_ID --repo YOUR_GITHUB_USERNAME/aas-aim --log
```

Release evidence is uploaded from `qa/runtime/phase32-release-gates.json` on each CI run. It must correspond to the same **commit SHA** and **lockfile SHA-256** as the reviewed source. Review the real Vitest results, TypeScript semantic check, fresh Vite output, exact-byte preview checks, native Chromium focus check, and mounted **78 × 4 = 312** screen–viewport audit. Fix failures; do not waive failing tests solely to obtain a green badge.

Even successful CI verifies the frontend candidate, **not** 190 deployed backend-integrated engineering functions, engineering correctness, tenant authorization, production privacy controls, accessibility conformance or approval of regulated engineering decisions.

## Phase 33 offline evidence summary

- `scripts/github-private-bootstrap.sh --check`: passed; **read only**.
- Five bootstrap self-tests: passed, including private-only publication contract and invalid target rejection.
- No GitHub repository was created and no workflow was dispatched in this environment.
- Local Node 22/npm DNS/toolchain restrictions remain; production sign-off must be withheld.
