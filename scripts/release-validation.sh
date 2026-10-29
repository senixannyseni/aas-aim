#!/usr/bin/env bash
# Phase 32: one fail-closed release gate, including fresh-build and HTTP preview proof.
# The trace records ACTUAL command execution and never means release approval.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
reporter=(node scripts/release-evidence.mjs)
"${reporter[@]}" start
current_gate=''
preview_pid=''
preview_log=''
finalize() {
  local exit_code=$?
  trap - EXIT
  if [[ -n "$preview_pid" ]]; then
    kill "$preview_pid" 2>/dev/null || true
    wait "$preview_pid" 2>/dev/null || true
  fi
  if [[ -n "$preview_log" && -f "$preview_log" ]]; then echo "Preview log: $preview_log"; fi
  if (( exit_code != 0 )); then
    "${reporter[@]}" fail "${current_gate}" "$exit_code" || true
    echo "FAIL: Phase 32 gate '${current_gate:-UNKNOWN}' exited ${exit_code}; see qa/runtime/phase32-release-gates.json" >&2
  fi
}
trap finalize EXIT
run_gate() {
  current_gate="$1"; shift
  "${reporter[@]}" enter "$current_gate"
  "$@"
  "${reporter[@]}" pass "$current_gate"
  current_gate=''
}
start_preview_and_wait() {
  preview_log="$(mktemp -t aim-next-preview.XXXXXX)"
  local probe_log
  probe_log="$(mktemp -t aim-next-preview-probe.XXXXXX)"
  pnpm --filter @bandha/aim-next preview >"$preview_log" 2>&1 &
  preview_pid=$!
  local ready=0
  for ((attempt=0;attempt<40;attempt++)); do
    # Probe the HTTP response directly. Vite console formatting, host aliases,
    # or buffering must not veto a healthy preview. The probe still requires
    # exact HTML and SHA-256 matches for every file emitted by this build.
    if node scripts/release-runtime-guards.mjs probe-preview http://127.0.0.1:4174 >"$probe_log" 2>&1; then
      ready=1; break
    fi
    if ! kill -0 "$preview_pid" 2>/dev/null; then break; fi
    sleep 0.5
  done
  if [[ "$ready" != 1 ]] || ! kill -0 "$preview_pid" 2>/dev/null; then
    echo 'Preview process output:' >&2
    cat "$preview_log" >&2
    echo 'Last HTTP preview probe result:' >&2
    cat "$probe_log" >&2
    rm -f "$probe_log"
    echo 'FAIL: preview did not serve this build and all entry assets' >&2
    return 1
  fi
  cat "$probe_log"
  rm -f "$probe_log"
}
browser_args=(--base-url http://127.0.0.1:4174)
focus_args=()
if [[ -n "${AIM_CHROMIUM:-}" ]]; then
  browser_args+=(--chromium "$AIM_CHROMIUM")
  focus_args+=(--chromium "$AIM_CHROMIUM")
fi
run_gate offline_evidence_unit_tests node --test scripts/lockfile-candidate-report.test.mjs scripts/release-evidence.test.mjs scripts/release-runtime-guards.test.mjs scripts/github-private-bootstrap.test.mjs apps/aim-next/scripts/offline-regression-compiler.nodecheck.cjs scripts/phase46-6-bundle-audit.test.cjs scripts/phase46-7-entry-graph.test.cjs scripts/phase46-10-integrity-gate.test.mjs
run_gate offline_browser_matrix_contract python3 -m unittest discover -s apps/aim-next/scripts -p 'test_browser_*.py'
run_gate toolchain_preflight node scripts/release-preflight.mjs --strict
run_gate frozen_dependency_install pnpm install --frozen-lockfile
run_gate design_token_check node scripts/generate-design-tokens.mjs --check
# Stage 46.1: revalidate the Asset Detail/Evidence identity contract using real
# frontend decoders and a controlled transport before the complete Vitest suite.
run_gate phase46_1_asset_contract node scripts/phase46-1-contract-gate.cjs
run_gate phase46_2_platform_exports node scripts/phase46-2-workspace-gate.cjs
run_gate phase46_3_source_graph node scripts/phase46-3-source-graph-gate.cjs
run_gate phase46_4_source_boundary node scripts/phase46-4-offline-contract.cjs
run_gate phase46_5_evidence_boundary node scripts/phase46-5-offline-evidence.cjs
run_gate phase46_6_ui_contract node scripts/phase46-6-offline-ui.cjs
run_gate phase46_7_lazy_boundary node scripts/phase46-7-lazy-contract.cjs
run_gate phase46_8_navigation_boundary node scripts/phase46-8-navigation-contract.cjs
run_gate phase46_9_integrated_models node scripts/phase46-9-integration-gate.cjs
run_gate phase46_11_workspace_discovery node scripts/phase46-11-workspace-contract.cjs
run_gate phase46_12_workflow_guidance node scripts/phase46-12-workflow-contract.cjs
run_gate phase46_13_evidence_comparison node scripts/phase46-13-evidence-comparison.cjs
run_gate phase46_14_evidence_chronology node scripts/phase46-14-chronology-contract.cjs
run_gate phase46_15_evidence_consistency node scripts/phase46-15-consistency-contract.cjs
run_gate phase46_16_investigation_summary node scripts/phase46-16-summary-contract.cjs
run_gate phase46_17_evidence_trace node scripts/phase46-17-trace-contract.cjs
run_gate phase46_18_temporary_case node scripts/phase46-18-case-contract.cjs
run_gate phase46_19_review_preparation node scripts/phase46-19-review-contract.cjs
run_gate phase46_20_working_material node scripts/phase46-20-working-material-contract.cjs
run_gate phase46_21_investigation_focus node scripts/phase46-21-layout-contract.cjs
run_gate phase46_22_evidence_handoff node scripts/phase46-22-handoff-contract.cjs
run_gate phase46_23_case_desk node scripts/phase46-23-case-desk-contract.cjs
run_gate phase46_24_origin_boundary node scripts/phase46-24-origin-contract.cjs
run_gate phase46_25_indexed_quick_find node scripts/phase46-25-quick-find-contract.cjs
run_gate phase46_26_unified_journey node scripts/phase46-26-journey-contract.cjs
run_gate phase46_27_keyboard_focus node scripts/phase46-27-keyboard-contract.cjs
run_gate phase46_28_visual_hierarchy node scripts/phase46-28-visual-contract.cjs
run_gate phase46_29_information_priority node scripts/phase46-29-priority-contract.cjs
run_gate phase46_30_workflow_consolidation node scripts/phase46-30-consolidation-contract.cjs
run_gate phase46_31_draft_revision node scripts/phase46-31-draft-revision-contract.cjs
run_gate phase46_32_bandha_brand node scripts/phase46-32-bandha-brand-contract.cjs
run_gate phase46_33_two_atmospheres node scripts/phase46-33-two-atmospheres-contract.cjs
run_gate phase46_34_v18_palette node scripts/phase46-34-v18-palette-contract.cjs
run_gate phase46_35_visual_composition node scripts/phase46-35-composition-contract.cjs
run_gate phase46_36_mounted_proof_contract node scripts/phase46-36-mounted-proof-contract.cjs
run_gate phase46_37_visual_attestation_contract node scripts/phase46-37-attestation-contract.cjs
run_gate phase46_38_build_identity_contract node scripts/phase46-38-build-identity-contract.cjs
run_gate platform_typecheck pnpm --filter @bandha/aim-platform typecheck
run_gate foundation_typecheck pnpm --filter @bandha/aim-web typecheck
run_gate foundation_vitest_suite pnpm --filter @bandha/aim-web test
run_gate foundation_build pnpm --filter @bandha/aim-web build
run_gate typescript_typecheck pnpm --filter @bandha/aim-next typecheck
run_gate offline_registry_regressions pnpm --filter @bandha/aim-next test:model-offline
run_gate react_vitest_suite pnpm --filter @bandha/aim-next test
# Eliminate the possibility that an old dist/ makes the artifact gate green.
run_gate clear_previous_build node scripts/release-runtime-guards.mjs clear-dist
run_gate vite_production_build pnpm --filter @bandha/aim-next build
run_gate production_artifact_check node scripts/release-runtime-guards.mjs assert-dist
run_gate phase46_7_entry_graph node scripts/phase46-7-entry-graph.cjs
run_gate vite_preview_ready start_preview_and_wait
run_gate native_chromium_focus_fixture python3 apps/aim-next/scripts/browser-focus-semantics.py "${focus_args[@]}"
run_gate mounted_chromium_78x4_audit python3 apps/aim-next/scripts/browser-route-audit.py "${browser_args[@]}"
run_gate mounted_chromium_lazy_chunks python3 apps/aim-next/scripts/browser-lazy-chunks.py "${browser_args[@]}"
run_gate mounted_chromium_navigation_journey python3 apps/aim-next/scripts/browser-phase46-9-journey.py "${browser_args[@]}"
run_gate mounted_chromium_visual_proof python3 apps/aim-next/scripts/browser-phase46-36-visual-proof.py "${browser_args[@]}"
run_gate mounted_chromium_visual_attestation python3 apps/aim-next/scripts/verify-phase46-37-mounted-evidence.py
run_gate mounted_chromium_build_identity python3 apps/aim-next/scripts/verify-phase46-38-build-identity.py
run_gate phase46_10_release_integrity node scripts/phase46-10-integrity-gate.mjs
"${reporter[@]}" complete
echo 'PASS: release runtime gates executed; lockfile human review and production approval remain separate.'
