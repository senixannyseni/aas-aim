#!/usr/bin/env bash
# AAS–AIM frontend foundation verification.
# Run from anywhere: bash scripts/verify-foundation.sh
# This is a verification gate, not a deployment script.
# It never creates a lockfile or changes the declared package versions.
set -Eeuo pipefail

readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

step() {
  printf '\n==> %s\n' "$*"
}

step 'Checking required project files'
for required in \
  'pnpm-workspace.yaml' \
  'apps/web/package.json' \
  'apps/web/index.html' \
  'apps/web/tsconfig.json' \
  'apps/web/vite.config.ts' \
  'apps/web/src/main.tsx' \
  'apps/web/src/app/App.tsx' \
  'apps/web/src/shared/lib/formatEvidence.test.ts' \
  'apps/web/src/shared/lib/formatQuantity.test.ts' \
  'design-system/tokens.json' \
  'scripts/generate-design-tokens.mjs' \
  'apps/web/src/shared/styles/tokens.generated.css'; do
  [[ -f "$required" ]] || fail "Required file missing: $required"
done

command -v node >/dev/null 2>&1 || fail 'Node.js is missing; install Node.js 24 or 26.'

step 'Checking package manifest and entry-point consistency'
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const manifest = JSON.parse(readFileSync('apps/web/package.json', 'utf8'));
const html = readFileSync('apps/web/index.html', 'utf8');
const entry = readFileSync('apps/web/src/main.tsx', 'utf8');
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
assert.equal(manifest.name, '@bandha/aim-web');
assert.equal(manifest.packageManager, 'pnpm@12.14.0');
for (const script of ['dev', 'typecheck', 'test', 'build', 'tokens:generate', 'tokens:check']) {
  assert.equal(typeof manifest.scripts?.[script], 'string', `Missing script: ${script}`);
}
assert.match(html, /<div\s+id="root"\s*><\/div>/);
assert.match(html, /src="\/src\/main\.tsx"/);
assert.match(entry, /getElementById\(["']root["']\)/);
assert.match(workspace, /^\s*-\s*["']?apps\/web["']?\s*$/m);
console.log('Manifest, HTML entry point, and workspace are consistent.');
JS

step 'Checking that generated design-token CSS matches the source'
node scripts/generate-design-tokens.mjs --check

step 'Checking required runtime versions'
node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if ! [[ "$node_major" =~ ^[0-9]+$ ]] || (( node_major < 24 || node_major >= 27 )); then
  fail "Node.js $(node --version) is outside the declared >=24 <27 range. Install Node.js 24 or 26."
fi
command -v pnpm >/dev/null 2>&1 || fail 'pnpm is missing; install pnpm 12.14.0.'
pnpm_version="$(pnpm --version)"
[[ "$pnpm_version" == '12.14.0' ]] || fail "Expected pnpm 12.14.0; found $pnpm_version."

step 'Checking dependency lockfile'
if [[ ! -f 'pnpm-lock.yaml' ]]; then
  fail 'No pnpm-lock.yaml. From the repository root, run "pnpm install" with registry access, review and commit the generated lockfile, then rerun this script.'
fi

step 'Installing from the unchanged lockfile'
pnpm install --frozen-lockfile

step 'Running strict TypeScript checks'
pnpm --filter @bandha/aim-web run typecheck

step 'Running permanent Vitest regression suites'
pnpm --filter @bandha/aim-web run test

step 'Building production browser assets'
pnpm --filter @bandha/aim-web run build

step 'Checking build artifacts'
[[ -s 'apps/web/dist/index.html' ]] || fail 'Vite did not create a nonempty dist/index.html.'
shopt -s nullglob
bundles=(apps/web/dist/assets/*.js)
((${#bundles[@]} > 0)) || fail 'Vite did not create a JavaScript asset in dist/assets.'

printf '\nPASS: typecheck, tests, production build, and output-artifact checks succeeded.\n'
printf 'This verifies the browser build only; it does not prove API connectivity, authorization, or engineering correctness.\n'
