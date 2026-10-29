import { useSyncExternalStore } from "react";

import type { AuthSessionBoundary, AuthSessionSnapshot } from "@bandha/aim-platform/auth/authSession";

/**
 * File 50 — read-only React bridge to the authentication session boundary.
 *
 * The boundary is owned by a trusted identity integration, NOT by this hook.
 * Supply null until such an integration is available. The hook never logs in,
 * persists credentials, constructs an API client, or infers authorization.
 *
 * useSyncExternalStore reads snapshots during render and re-subscribes when
 * the boundary instance changes. Do not copy the client into independent
 * component state: pass snapshot.client directly to a data controller so that
 * sign-out, revocation, or tenant/identity replacement invalidates old data.
 *
 * On the server, always render a signed-out snapshot. Authentication context
 * and API clients must not be serialized into SSR HTML or shared across users.
 */

const DISCONNECTED_SNAPSHOT: AuthSessionSnapshot = Object.freeze({
  phase: "signed-out",
  revision: 0,
  client: null,
});

function getDisconnectedSnapshot(): AuthSessionSnapshot {
  // Stable identity is required by useSyncExternalStore to avoid update loops.
  return DISCONNECTED_SNAPSHOT;
}

function subscribeDisconnected(): () => void {
  // A disconnected application must not subscribe to a previous session.
  return () => undefined;
}

/**
 * Observe an authenticated session WITHOUT becoming an identity provider.
 *
 * - null boundary: stable, inert signed-out state; no network or credentials.
 * - active boundary: exact immutable snapshot owned by the boundary.
 * - changed boundary: React immediately reads the new boundary and replaces
 *   the old subscription (including client changes for a new subject/tenant).
 * - SSR: always signed out, never expose server-side authentication state.
 *
 * Pass snapshot.client directly to useServerAssetRegister({ client });
 * the authoritative Java API must still verify identity and tenant access.
 */
export function useAuthSession(
  boundary: AuthSessionBoundary | null,
): AuthSessionSnapshot {
  return useSyncExternalStore(
    boundary?.subscribe ?? subscribeDisconnected,
    boundary?.getSnapshot ?? getDisconnectedSnapshot,
    getDisconnectedSnapshot,
  );
}
