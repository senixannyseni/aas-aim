#!/usr/bin/env bash
# One command on a compatible machine: canonical release + reviewable evidence ZIP.
# Does not soften, bypass, or reorder any existing release gate.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ -L qa/runtime || -L qa/runtime/phase46-36-mounted-visuals ]]; then
  echo 'Refusing symlinked qa/runtime evidence path' >&2
  exit 2
fi
mkdir -p qa/runtime
log="qa/runtime/phase46-39-release-validation.log"
out="qa/runtime/AAS-AIM-Phase46_39-Runtime-Evidence.zip"
# Stale screenshots must never survive a failed/incomplete release attempt.
rm -rf -- qa/runtime/phase46-36-mounted-visuals
rm -f -- qa/runtime/phase32-release-gates.json "$out"
printf 'AAS–AIM consolidated runtime check\n'
printf 'Node: '; node --version || true
printf 'pnpm: '; if command -v pnpm >/dev/null 2>&1; then pnpm --version; else echo 'NOT INSTALLED'; fi
printf 'Python: '; python3 --version
printf 'Canonical release command: bash scripts/release-validation.sh\n'
set +e
bash scripts/release-validation.sh 2>&1 | tee "$log"
release_code=${PIPESTATUS[0]}
set -e
python3 scripts/phase46-39-collect-evidence.py --root "$PWD" \
  --log "$log" --output "$out" --exit-code "$release_code"
if (( release_code != 0 )); then
  echo 'The release did not pass. The ZIP contains the gate failure for diagnosis.' >&2
  exit "$release_code"
fi
echo 'Runtime gates completed, pending human review. This is not engineering approval.'
