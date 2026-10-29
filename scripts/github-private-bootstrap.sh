#!/usr/bin/env bash
# Phase 33: opt-in publish of this EXISTING workspace into a NEW PRIVATE GitHub repository.
# Default is read-only. This script never generates a lockfile or approves a release.
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
usage() {
  cat <<'HELP'
Usage:
  bash scripts/github-private-bootstrap.sh --check
  bash scripts/github-private-bootstrap.sh --publish OWNER/REPOSITORY

--check: read-only workspace / GitHub CI readiness audit (default).
--publish: explicitly create a NEW PRIVATE GitHub repository, initialize this
           extracted workspace as git root, commit, and push to main.
           Requires authenticated GitHub CLI (gh), git, and working Internet.
           Refuses existing .git histories/remotes and pre-existing target repos.

Publication is NOT production approval. After pushing, run the manual
'AIM Next lockfile candidate (manual, unreviewed)' workflow, review the artifact,
then commit an accepted pnpm-lock.yaml and run 'AIM Next UI quality'.
HELP
}
mode="${1:---check}"
if [[ "$mode" == '--help' || "$mode" == '-h' ]]; then usage; exit 0; fi
if [[ "$mode" != '--check' && "$mode" != '--publish' ]]; then usage >&2; exit 2; fi
if [[ "$mode" == '--check' && $# -ne 1 && $# -ne 0 ]]; then usage >&2; exit 2; fi
if [[ "$mode" == '--publish' && $# -ne 2 ]]; then usage >&2; exit 2; fi
if [[ "$mode" == '--publish' ]]; then
  TARGET="$2"
  if [[ ! "$TARGET" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
    echo 'BLOCK: supply OWNER/REPOSITORY; do not use a URL or a bare repository name.' >&2
    exit 2
  fi
fi
for file in package.json pnpm-workspace.yaml \
  apps/aim-next/package.json apps/aim-next/src/capabilityRegistry.ts \
  apps/aim-next/src/screenRegistry.ts \
  .github/workflows/aim-next-lockfile-candidate.yml \
  .github/workflows/aim-next-ui.yml \
  scripts/release-validation.sh .gitignore; do
  if [[ ! -f "$file" ]]; then echo "BLOCK: project root is missing $file" >&2; exit 1; fi
done
# Never quietly publish an already-versioned workspace as a new unrelated repo.
if [[ -e .git ]]; then
  if [[ "$mode" == '--publish' ]]; then
    echo 'BLOCK: .git already exists. Inspect the existing repository and remote manually.' >&2
    exit 1
  fi
  echo 'INFO: Existing git metadata detected; --publish would refuse this workspace.'
fi
# Disallow likely credentials even though the repo must be private. Templates are safe.
while IFS= read -r -d '' file; do
  case "$file" in
    */.env.example|*/.env.*.example|*/.env.template|*/.env.*.template|./.env.example|./.env.template) continue;;
  esac
  case "$file" in
    */.env|*/.env.*|./.env|./.env.*|*.pem|*.p12|*.pfx|*.key)
      echo "BLOCK: possible credential in source tree: $file (move it outside the workspace)" >&2
      exit 1;;
  esac
done < <(find . -path './.git' -prune -o -path './node_modules' -prune -o -path './.pnpm-store' -prune -o -type f -print0)
if [[ -e pnpm-lock.yaml ]]; then
  echo 'INFO: pnpm-lock.yaml exists; this script cannot certify its origin or human review.'
else
  echo 'INFO: pnpm-lock.yaml is absent. First CI push will not pass reviewed-commit release gates.'
fi
printf 'READY: AAS–AIM GitHub CI source files present; mode=%s\n' "$mode"
if [[ "$mode" == '--check' ]]; then
  echo 'READ ONLY: No GitHub repository, commit, workflow run, or release approval was created.'
  exit 0
fi
for command in git gh; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "BLOCK: '$command' is not installed. No local changes made." >&2
    exit 1
  fi
done
if ! gh auth status >/dev/null 2>&1; then
  echo 'BLOCK: run gh auth login first. No local changes made.' >&2
  exit 1
fi
if [[ -z "$(git config user.name || true)" || -z "$(git config user.email || true)" ]]; then
  echo 'BLOCK: set git user.name and user.email first. No local changes made.' >&2
  exit 1
fi
if gh repo view "$TARGET" >/dev/null 2>&1; then
  echo "BLOCK: repository $TARGET already exists. Refusing to overwrite/push to an existing repository." >&2
  exit 1
fi
# Fail before side effects if the CLI cannot access the authenticated account.
if ! gh api user --jq .login >/dev/null 2>&1; then
  echo 'BLOCK: cannot reach the GitHub API. No local changes made.' >&2
  exit 1
fi
# Publication requires the user to run --publish with a concrete owner/repo.
git init -b main
git add --all
# A last-stage check catches obvious secrets staged in case ignored files were altered.
while IFS= read -r file; do
  case "$file" in
    .env|*/.env|.env.*|*/.env.*|*.pem|*.p12|*.pfx|*.key)
      case "$file" in *.example|*.template) :;; *) echo "BLOCK: refusing to commit credential-like file $file" >&2; exit 1;; esac;;
  esac
done < <(git diff --cached --name-only)
git commit -m 'Import AAS–AIM frontend Phase 33 validation candidate'
gh repo create "$TARGET" --private --source . --remote origin --push
cat <<NEXT
PUSH REQUESTED: $TARGET (PRIVATE). Check the repository on GitHub to confirm.
NEXT ACTIONS:
  1. gh workflow run aim-next-lockfile-candidate.yml --repo $TARGET --ref main
  2. Review its job log and download the UNREVIEWED lockfile artifact.
  3. Have a maintainer review the dependency resolution; commit the accepted pnpm-lock.yaml.
  4. gh workflow run aim-next-ui.yml --repo $TARGET --ref main
  5. Inspect CI logs and runtime trace for the exact approved commit.
NEVER interpret workflow configuration or an artifact upload as a production pass.
NEXT
