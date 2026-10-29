import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

import App from "./App";
import { createAuthBootstrap, type AuthBootstrap, type TrustedIdentitySource } from "../shared/auth/authBootstrap";
import { readPublicConfig } from "../shared/config/env";

/**
 * File 57 — explicit browser composition seam for a REVIEWED identity adapter.
 *
 * No default source, discovery, credentials, storage, global registry or login
 * fallback is provided. The normal main.tsx invokes this with no identity
 * source and therefore cannot create an authenticated session or send API
 * requests. A separately reviewed entry point may pass a TrustedIdentitySource.
 * Backend authorization is never inferred from this frontend capability.
 */
export type AimMountOptions = Readonly<{
  /** Explicit capability supplied by a reviewed, application-owned adapter. */
  identitySource?: TrustedIdentitySource | null;
}>;

export type MountedAimApplication = Readonly<{
  /** Revoke API clients and detach the identity source before unmounting. */
  dispose: () => void;
}>;

/**
 * Mount the AIM browser workspace, disconnected unless a trusted source exists.
 *
 * When a source is explicitly supplied, public API configuration is validated
 * before any subscription or React mount; an invalid path fails closed. The
 * bootstrap is owned outside StrictMode, so React's development remounts do not
 * duplicate identity subscriptions or create spurious authenticated clients.
 *
 * A real adapter must integrate the IdP's login, token renewal, expiry, and
 * logout notifications, while the Java API verifies access on every request.
 */
export function mountAimApplication(
  rootElement: Element,
  options: AimMountOptions = {},
): MountedAimApplication {
  const identitySource = options.identitySource ?? null;
  let bootstrap: AuthBootstrap | null = null;

  // Inert default: don't even read API configuration without an identity source.
  if (identitySource !== null) {
    const { apiBasePath } = readPublicConfig(import.meta.env.VITE_AIM_API_BASE_PATH);
    bootstrap = createAuthBootstrap({ apiBasePath, identitySource });
  }

  let root: Root | null = null;
  try {
    root = createRoot(rootElement);
    // Synchronous identity callbacks can update the boundary before React
    // renders; useSyncExternalStore still reads the latest snapshot.
    bootstrap?.start();
    root.render(
      <StrictMode>
        <App authBoundary={bootstrap?.boundary ?? null} />
      </StrictMode>,
    );
  } catch {
    // A partial mount cannot leave an authenticated client or subscriber alive.
    bootstrap?.dispose();
    root?.unmount();
    throw new Error("Bandha AIM application could not start.");
  }

  const mountedRoot = root;
  let disposed = false;
  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true; // terminal before source teardown or React callbacks
      bootstrap?.dispose();
      mountedRoot.unmount();
    },
  });
}
