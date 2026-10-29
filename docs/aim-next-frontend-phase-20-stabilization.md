# Future AAS–AIM — Phase 20: Stabilization / QA Tranche 1

## Scope and release identity

This is **Phase 20**, built on the immutable Phase 19 cumulative archive. It is a stabilization increment: it does not add a domain, alter the frozen 190 active function IDs, change the 78 canonical screen IDs, or pretend that engineering backend workflows are operational.

### Changes made

1. **Shared function inspector accessibility.** The inspector is now an explicitly labeled modal `dialog`, with initial focus on its first enabled control, Escape dismissal, Tab/Shift+Tab wrap-around within the inspector, and return of focus to the triggering control when that control remains mounted.
2. **Mobile primary navigation.** A visible mobile backdrop closes the navigation, its menu button advertises `aria-controls` and `aria-expanded`, the opened rail takes initial keyboard focus, Escape dismisses it and returns focus to the menu button, and the hidden rail is no longer visually offscreen but keyboard reachable at the narrow viewport breakpoint.
3. **Small viewport support.** Updated the shell's minimum width to 320 px at <=420 px, and reduced panel/inspector horizontal padding; this is **not** a device-lab verification or proof every domain table fits without horizontal scrolling.
4. **Executable offline model/registry audit.** `apps/aim-next/scripts/offline-regression.cjs` loads and executes the permanent non-React `*Model.test.ts`, `capabilityRegistry.test.ts`, and `screenRouting.test.ts` suites with an intentionally small assertion compatibility layer. It uses installed TypeScript, or `TS_COMPILER_PATH`, or the globally installed TypeScript compiler. This **does not run Vitest**, browser components or the real Vite pipeline.
5. **Permanent React accessibility tests.** `FutureAimApp.phase20.accessibility.test.tsx` defines 10 Vitest/jsdom tests for skip navigation, modal focus, keyboard trapping, mobile dismissal, and shell's backend-disconnected claim.

### Verification actually executed in this environment

| Check | Evidence | Result |
|---|---|---|
| Offline model/registry regressions | 19 suites, 1,709 tests executed using TypeScript transpilation with a limited Vitest assertion adapter | **1,709 passed; 0 failed** |
| Strict isolated type checking | `tsc --project /tmp/aim-phase07-check/tsconfig.json --pretty false`, TypeScript 5.8.3 and local declaration stubs | **Pass** |
| CSS syntax | tinycss2 stylesheet parsing | **Pass** |
| Design tokens | `node scripts/generate-design-tokens.mjs --check` | **171 current** |
| Phase 19 source integrity | SHA-256 comparison of every unrelated prior archive member against source tree | To be verified as release is packaged |
| New React test source | Included and isolated TypeScript-checked | **10 defined; not executed** |
| Full React/jsdom suite | Project-pinned `vitest run` | **Not executed** |
| Production build / runtime | Pinned Node 24+/pnpm 12 and Vite 8 | **Not executed** |
| Automated axe/keyboard browser audit / visual screenshots | Browser with installed app dependencies | **Not executed** |

**Toolchain blocker:** the container has Node 22.16.0, while `@bandha/aim-next` declares Node >=24 <27, and fetching npm dependencies failed with `EAI_AGAIN` for registry.npmjs.org. No installed project-local pnpm, React, Vitest, jsdom or Vite dependencies are available. These results cannot be represented as successful official Vite/Vitest end-to-end testing.

### Run verification in a correctly provisioned environment

From workspace root (`aas-aim`), with a compatible Node runtime, pnpm and dependencies installed:

```bash
pnpm install
pnpm --filter @bandha/aim-next typecheck
pnpm --filter @bandha/aim-next test:model-offline
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
pnpm --filter @bandha/aim-next dev
```

To run only the new Phase 20 React tests:

```bash
pnpm --filter @bandha/aim-next test:phase20
```

### Further release gates

- Run the pinned real Vitest/jsdom suite and resolve actual runtime/UI failures; don't count isolated model tests as official Vitest successes.
- Verify focus management and keyboard navigation on a real browser at 320/375/768/1280-pixel widths; run a full WCAG 2.2 AA audit and address violations.
- Validate all 78 deep links, disconnected/invalid/authorized snapshot branches, record handoff and grant-rotation behaviors in the mounted frontend.
- Exercise real API contracts, per-record authorization, error/loading/retry states, and backend-owned audit/approval transitions.
- Verify no data survives identity/tenant/authorization changes; never send offline field drafts or engineering decisions without secure authoritative services.

## Unchanged engineering boundaries

Frontend snapshots are externally authorized; missing/stale data cannot imply safe status. The UI cannot calculate authoritative FFS/COR results, grant inspection credit, issue deferrals or engineering approvals, retrieve evidence bytes, synchronize offline field workpacks, or validate actual GIS/CAD/model content. The completed 190/190 statistic remains *interface-scope coverage*, not operational feature completion.
