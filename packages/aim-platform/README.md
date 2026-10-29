# @bandha/aim-platform — Shared Frontend Platform (Phase 46.2)

This internal, private pnpm workspace package is the **one implementation source** for the browser-facing authentication session boundary, authenticated HTTP transport, read-only Asset Register presentation/adapter, and authorized read-state contract used by both `apps/web` and `apps/aim-next`.

**This package does not authenticate real users, issue tokens, authorize assets, run engineering calculations, or approve technical work.** A trusted identity provider and independently authorized backend are still required. The controlled API fixture remains test-only.

## Export groups

- `@bandha/aim-platform/auth/{authSession,authBootstrap,useAuthSession}` — session lifecycle, trusted identity-source wiring and React subscription.
- `@bandha/aim-platform/api/{apiClient,authenticatedApiClient}` — bounded decoded JSON requests, cancellation and session-bound token transport.
- `@bandha/aim-platform/assets/{AssetOverview,AssetRegister,ServerAssetRegister,assetRegisterAdapter,useServerAssetRegister}` — read-only presentation and decoded Asset Register pages.
- `@bandha/aim-platform/ui/{Button,Card,StatusBadge}` — foundation UI components retained for compatibility. Existing foundation CSS class names are unchanged.
- `@bandha/aim-platform/data/authorizedReadState` — Stage 45 request-state types and stale-response checks.
- `@bandha/aim-platform/config` — validated public same-origin API base path.

## Migration policy

`apps/web` retains thin `export *` compatibility files for old imports. They do not contain parallel implementations. AIM Next imports the package directly and no longer reaches into `apps/web/src` through relative paths. Reexports must be removed only after all consuming applications and tests have migrated.

Package `exports` resolve to TypeScript **source** for the pnpm/Vite workspace. It is not a separately published, built npm package. All three workspaces must be checked with Node 24/pnpm 12 and the repository's pinned TypeScript 7 toolchain.

## Supported gates

```bash
pnpm install --frozen-lockfile
node scripts/phase46-2-workspace-gate.cjs
pnpm --filter @bandha/aim-platform typecheck
pnpm --filter @bandha/aim-web typecheck
pnpm --filter @bandha/aim-web test
pnpm --filter @bandha/aim-web build
pnpm --filter @bandha/aim-next typecheck
pnpm --filter @bandha/aim-next test
pnpm --filter @bandha/aim-next build
```

For release and browser checks use `bash scripts/release-validation.sh`. Neither an offline smoke pass nor a successful Vite build proves authorization or engineering approval.
