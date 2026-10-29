import type { AuthSessionBoundary, AuthSessionPhase } from
  "@bandha/aim-platform/auth/authSession";
import { useAuthSession } from
  "@bandha/aim-platform/auth/useAuthSession";
import {
  useServerAssetRegister,
  type ServerAssetRegisterController,
} from "@bandha/aim-platform/assets/useServerAssetRegister";

/** Stage 45.2 — temporary cross-app bridge, NOT an identity provider.
 * Reuses the foundation session and server-paginated Asset Register controller.
 * An authenticated session is needed; the authoritative API still must
 * independently authorize each asset and all engineering operations.
 */
export type AuthenticatedAssetPage = Readonly<{
  phase: AuthSessionPhase;
  /** Frontend session transition counter, NOT a trusted data-generation ID. */
  sessionRevision: number;
  register: ServerAssetRegisterController;
}>;

export function useAuthenticatedAssetPage(
  boundary: AuthSessionBoundary | null,
): AuthenticatedAssetPage {
  const session = useAuthSession(boundary);
  const client = session.phase === "authenticated" ? session.client : null;
  const register = useServerAssetRegister({ client });
  return { phase: session.phase, sessionRevision: session.revision, register };
}
