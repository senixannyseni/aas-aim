import {
  ApiClientError,
  type ApiClient,
  type ApiClientOptions,
  type JsonApiRequest,
} from "@bandha/aim-platform/api/apiClient";
import {
  createAuthenticatedApiClient,
  type AccessTokenProvider,
} from "@bandha/aim-platform/api/authenticatedApiClient";

/**
 * File 48 — frontend authentication SESSION boundary, not an identity provider.
 *
 * A trusted, separately implemented identity integration must call activate()
 * on EVERY successful login, token/session replacement, subject change, or
 * tenant change; and transition() on refresh, sign-out, expiry or revocation.
 * An activation always creates a NEW ApiClient, even when its keys are equal.
 *
 * Only the authoritative backend can validate credentials, authenticate the
 * subject, authorize tenant and asset access, and audit engineering operations.
 * These keys are opaque identity-provider context, NOT proof of authorization.
 * NEVER use a bearer token or refresh token as any identity/session key.
 *
 * This boundary stores neither tokens nor browser credentials, issues no
 * login/refresh requests, and does not use localStorage/sessionStorage.
 * The snapshot is stable between changes for React useSyncExternalStore().
 */

export type AuthSessionPhase =
  | "signed-out"
  | "authenticating"
  | "authenticated"
  | "refreshing"
  | "expired"
  | "revoked"
  | "error";

export type UnauthenticatedPhase = Exclude<AuthSessionPhase, "authenticated">;

/** Intentionally does not expose the subject, tenant, keys, or access token. */
export type AuthSessionSnapshot = Readonly<{
  phase: AuthSessionPhase;
  /** Increases for every transition, including reactivation of the same user. */
  revision: number;
  /** null for all non-authenticated phases. */
  client: ApiClient | null;
}>;

/**
 * Context from a TRUSTED identity adapter (never arbitrary input from the UI).
 * Keys represent a subject, selected tenant and login/session incarnation;
 * they must not contain credentials or be treated as authorization claims.
 */
export type AuthSessionActivation = Readonly<{
  subjectKey: string;
  tenantKey: string;
  sessionKey: string;
  getAccessToken: AccessTokenProvider;
}>;

export type AuthSessionBoundary = Readonly<{
  getSnapshot: () => AuthSessionSnapshot;
  /** Compatible with React useSyncExternalStore(subscribe, getSnapshot). */
  subscribe: (listener: () => void) => () => void;
  /** Each activation rotates client identity and revokes old requests. */
  activate: (session: AuthSessionActivation) => void;
  /** Clears the client immediately, before notifying subscribers. */
  transition: (phase: UnauthenticatedPhase) => void;
  /** Terminal lifecycle operation: revokes clients and subscriptions. */
  dispose: () => void;
}>;

type ClientLease = Readonly<{
  client: ApiClient;
  invalidate: () => void;
}>;

function cancelled(): ApiClientError {
  return new ApiClientError("ABORTED", "The API request was cancelled.");
}

function invalidSession(): ApiClientError {
  return new ApiClientError("INVALID_REQUEST", "Invalid authentication session configuration.");
}

/**
 * Reject control characters/blank context, but never log or copy key values.
 * An identity adapter, NOT this frontend, establishes whether keys are true.
 */
function validContextKey(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 && value.length <= 256 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Issue a revocable lease for one authenticated session generation.
 *
 * A held reference to a previous client becomes unusable immediately after
 * invalidation: new requests fail, and in-flight requests reject even if a
 * buggy injected fetch or identity provider ignores its AbortSignal.
 * We NEVER reuse the underlying transport across activations.
 */
function leaseClient(
  options: ApiClientOptions,
  provider: AccessTokenProvider,
): ClientLease {
  let active = true;
  const pending = new Set<AbortController>();
  const transport = createAuthenticatedApiClient({
    ...options,
    getAccessToken: async (signal) => {
      if (!active) throw cancelled();
      const token = await provider(signal);
      if (!active || signal.aborted) throw cancelled();
      return token;
    },
  });

  const client: ApiClient = Object.freeze({
    async request<T>(request: JsonApiRequest<T>): Promise<T> {
      if (!active) throw cancelled();
      const controller = new AbortController();
      const onCallerAbort = (): void => controller.abort();
      request.signal?.addEventListener("abort", onCallerAbort, { once: true });
      if (request.signal?.aborted || !active) controller.abort();
      pending.add(controller);

      // A separate rejection channel is needed because a test transport or
      // an external token provider could ignore AbortSignal indefinitely.
      let rejectCancellation: (error: ApiClientError) => void = () => undefined;
      const cancellation = new Promise<never>((_resolve, reject) => {
        rejectCancellation = reject;
      });
      const onAbort = (): void => rejectCancellation(cancelled());
      controller.signal.addEventListener("abort", onAbort, { once: true });
      if (controller.signal.aborted) onAbort();

      try {
        const result = await Promise.race([
          transport.request({ ...request, signal: controller.signal }),
          cancellation,
        ]);
        if (!active || controller.signal.aborted) throw cancelled();
        return result;
      } finally {
        controller.signal.removeEventListener("abort", onAbort);
        request.signal?.removeEventListener("abort", onCallerAbort);
        pending.delete(controller);
      }
    },
  });

  return Object.freeze({
    client,
    invalidate(): void {
      if (!active) return;
      active = false;
      for (const controller of pending) controller.abort();
      pending.clear();
    },
  });
}

/**
 * Owns only the frontend visibility/client lifecycle. It is intentionally
 * inert until activate() is called by an actual trusted identity integration.
 *
 * In React, subscribe with useSyncExternalStore(boundary.subscribe,
 * boundary.getSnapshot) and pass snapshot.client to useServerAssetRegister.
 * Subscribe/re-render during every identity or tenant transition so no old
 * register page stays visible; the hook additionally checks client identity.
 */
export function createAuthSessionBoundary(options: ApiClientOptions): AuthSessionBoundary {
  let revision = 0;
  let disposed = false;
  let lease: ClientLease | null = null;
  let snapshot: AuthSessionSnapshot = Object.freeze({
    phase: "signed-out", revision, client: null,
  });
  const listeners = new Set<() => void>();

  function assertLive(): void {
    if (disposed) throw invalidSession();
  }

  function publish(phase: AuthSessionPhase, nextLease: ClientLease | null): void {
    // The previous client becomes invalid BEFORE any listener can read state.
    lease?.invalidate();
    lease = nextLease;
    snapshot = Object.freeze({ phase, revision: ++revision, client: nextLease?.client ?? null });
    for (const listener of Array.from(listeners)) {
      // A faulty subscriber must not prevent other auth-state observers from
      // being notified. This never carries tokens or rejected input values.
      try { listener(); } catch { /* observer failure cannot restore credentials */ }
    }
  }

  const boundary: AuthSessionBoundary = Object.freeze({
    getSnapshot: (): AuthSessionSnapshot => snapshot,
    subscribe(listener: () => void): () => void {
      assertLive();
      if (typeof listener !== "function") throw invalidSession();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    activate(session: AuthSessionActivation): void {
      assertLive();
      if (
        session === null || typeof session !== "object" ||
        !validContextKey(session.subjectKey) ||
        !validContextKey(session.tenantKey) ||
        !validContextKey(session.sessionKey) ||
        typeof session.getAccessToken !== "function"
      ) {
        publish("error", null); // Fail closed; never continue on stale identity.
        throw invalidSession();
      }
      let nextLease: ClientLease;
      try {
        nextLease = leaseClient(options, session.getAccessToken);
      } catch {
        publish("error", null);
        throw invalidSession();
      }
      publish("authenticated", nextLease);
    },
    transition(phase: UnauthenticatedPhase): void {
      assertLive();
      if (
        phase !== "signed-out" && phase !== "authenticating" &&
        phase !== "refreshing" && phase !== "expired" &&
        phase !== "revoked" && phase !== "error"
      ) {
        publish("error", null);
        throw invalidSession();
      }
      publish(phase, null);
    },
    dispose(): void {
      if (disposed) return;
      // Mark terminal BEFORE notifying: a re-entrant observer must not
      // reactivate a session during disposal.
      disposed = true;
      publish("revoked", null);
      listeners.clear();
    },
  });
  return boundary;
}
