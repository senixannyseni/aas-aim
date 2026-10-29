import type { JSX } from "react";

import type { ApiClient } from "../../shared/api/apiClient";
import type { AuthSessionBoundary } from "../../shared/auth/authSession";
import { useAuthSession } from "../../shared/auth/useAuthSession";
import { ServerAssetRegister } from "./ServerAssetRegister";
import { useServerAssetRegister } from "./useServerAssetRegister";

/**
 * File 52 — session-scoped composition of the authenticated Asset Register.
 *
 * The trusted identity integration owns `boundary`. Pass null when there is
 * no integration or active session; this component must never invent a login,
 * token, user, tenant, API response, or engineering status.
 *
 * Only a confirmed authenticated snapshot supplies an API client. Switching
 * clients unmounts the previous register controller and its local query and
 * search draft. This prevents both previous-session records AND previous-
 * session search text from carrying into the next user's or tenant's view.
 *
 * Revocation of an old client and cancellation of pending network requests
 * are enforced by authSession.ts and useServerAssetRegister.ts. This component
 * provides an additional UI-level lifecycle boundary; it is not a substitute
 * for backend authentication, tenant authorization, or engineering approval.
 */
export type AuthenticatedAssetRegisterProps = Readonly<{
  boundary: AuthSessionBoundary | null;
}>;

// Internal, non-secret React identity keys. Weak references do not retain old
// clients or session credentials. No IDs, subjects, tenants, or tokens are used
// as keys or rendered into the DOM. A distinct client always has a distinct key,
// even if a replacement AuthSessionBoundary starts at the same revision.
const clientKeys = new WeakMap<ApiClient, number>();
let nextClientKey = 0;

function scopeKey(client: ApiClient | null): string {
  if (client === null) return "disconnected";
  let id = clientKeys.get(client);
  if (id === undefined) {
    id = ++nextClientKey;
    clientKeys.set(client, id);
  }
  return `authenticated-client-${id}`;
}

function ScopedAssetRegister({ client }: { client: ApiClient | null }): JSX.Element {
  // Mounted once per client identity. Query state, search draft, and pending
  // effects are discarded on sign-out, expiry, revocation, or session rotation.
  const register = useServerAssetRegister({ client });
  return <ServerAssetRegister {...register} />;
}

/**
 * The only composition layer between a session and server asset data.
 *
 * No API requests are made until a trusted boundary is authenticated. The
 * UI is deliberately disconnected when SSR or the session has no client.
 * Do not replace the keyed subtree with a persistent controller: a new tenant
 * must not inherit the preceding tenant's search filters or pagination.
 */
export function AuthenticatedAssetRegister({
  boundary,
}: AuthenticatedAssetRegisterProps): JSX.Element {
  const session = useAuthSession(boundary);
  const client = session.phase === "authenticated" ? session.client : null;

  return <ScopedAssetRegister key={scopeKey(client)} client={client} />;
}
