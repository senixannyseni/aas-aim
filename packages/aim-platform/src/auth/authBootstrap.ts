import type { ApiClientOptions } from "@bandha/aim-platform/api/apiClient";
import { parseApiBasePath } from "@bandha/aim-platform/config";
import {
  createAuthSessionBoundary,
  type AuthSessionActivation,
  type AuthSessionBoundary,
  type UnauthenticatedPhase,
} from "@bandha/aim-platform/auth/authSession";

/**
 * File 55 — the explicit, fail-closed connection between the browser entry
 * point and a separately reviewed, trusted identity-provider integration.
 *
 * This module DOES NOT discover an identity provider, initiate a login flow,
 * persist a token, or read credentials from a global, VITE_* variable, URL,
 * DOM element, or browser storage. Merely constructing this object grants no
 * access: the caller must supply a trusted adapter and explicitly start it.
 *
 * The adapter must validate identity-provider callbacks, session expiry,
 * token renewal and tenant selection within its own reviewed implementation.
 * Browser events are NOT proof of authentication or tenant authorization;
 * the authoritative Java backend must verify every request independently.
 */

/** Only a reviewed identity integration may emit these events. */
export type TrustedAuthEvent =
  | Readonly<{ type: "authenticated"; session: AuthSessionActivation }>
  | Readonly<{ type: UnauthenticatedPhase }>;

/**
 * Narrow capability provided by a trusted identity integration. subscribe()
 * may emit synchronously or later, but MUST return a synchronous teardown.
 * It must stop work on AbortSignal cancellation; the bootstrap also ignores
 * any misbehaving late callbacks after cancellation or disposal.
 */
export type TrustedIdentitySource = Readonly<{
  subscribe: (
    onEvent: (event: TrustedAuthEvent) => void,
    signal: AbortSignal,
  ) => () => void;
}>;

export type AuthBootstrapOptions = ApiClientOptions & Readonly<{
  identitySource: TrustedIdentitySource;
}>;

export type AuthBootstrap = Readonly<{
  /** Pass this reference to <App authBoundary={bootstrap.boundary} />. */
  boundary: AuthSessionBoundary;
  /** Start once, after the trusted source has been configured. */
  start: () => void;
  /** Terminal; revoke old clients, abort source and detach subscriptions. */
  dispose: () => void;
}>;

/** Errors are intentionally independent of identity-provider exception text. */
function bootstrapFailure(): Error {
  return new Error("Trusted authentication bootstrap is unavailable.");
}

function safeTeardown(teardown: (() => void) | null): void {
  if (teardown === null) return;
  try { teardown(); } catch { /* A source teardown cannot restore a session. */ }
}

/**
 * Establish the sole ownership chain for this browser session.
 *
 * 1. Created: signed out; not connected to the identity source.
 * 2. start(): authenticating; connect a trusted source exactly once.
 * 3. authenticated event: create a new, revocable API client generation.
 * 4. Any other lifecycle event: invalidate the current API client first.
 * 5. Invalid event/source failure: revoke and close the source (fail closed).
 * 6. dispose(): terminal; late callbacks are ignored.
 *
 * The bootstrap intentionally has no automatic retry after a source failure.
 * A newly reviewed source or login cycle must create a fresh bootstrap.
 *
 * Do NOT construct a fake identitySource in production to force the register
 * online. Until the real source is available, render App without a boundary.
 */
export function createAuthBootstrap(options: AuthBootstrapOptions): AuthBootstrap {
  if (
    options === null || typeof options !== "object" ||
    options.identitySource === null ||
    typeof options.identitySource !== "object" ||
    typeof options.identitySource.subscribe !== "function"
  ) {
    throw bootstrapFailure();
  }

  // Validate public configuration at the seam, not after a credential exists.
  // No implicit default: an invalid API base path is a configuration failure.
  let apiBasePath: string;
  try {
    apiBasePath = parseApiBasePath(options.apiBasePath);
  } catch {
    throw bootstrapFailure();
  }

  const boundary = createAuthSessionBoundary({
    apiBasePath,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
  });
  const source = options.identitySource;
  const controller = new AbortController();
  let started = false;
  let disposed = false;
  let stopped = false;
  let unsubscribe: (() => void) | null = null;

  function closeSource(): void {
    if (stopped) return;
    stopped = true;
    controller.abort();
    const teardown = unsubscribe;
    unsubscribe = null;
    safeTeardown(teardown);
  }

  function failClosed(): void {
    if (disposed) return;
    closeSource();
    // Revoke any authenticated client BEFORE callers observe an error.
    boundary.transition("error");
  }

  function onEvent(event: TrustedAuthEvent): void {
    if (!started || stopped || disposed || controller.signal.aborted) return;
    try {
      if (event === null || typeof event !== "object") {
        failClosed();
        return;
      }
      if (event.type === "authenticated") {
        // authSession.activate validates the full opaque session context.
        boundary.activate(event.session);
        return;
      }
      if (
        event.type === "signed-out" ||
        event.type === "authenticating" ||
        event.type === "refreshing" ||
        event.type === "expired" ||
        event.type === "revoked" ||
        event.type === "error"
      ) {
        boundary.transition(event.type);
        return;
      }
      failClosed();
    } catch {
      // Reject malformed runtime event values and listener side effects without
      // exposing potentially sensitive identity-provider exception messages.
      failClosed();
    }
  }

  return Object.freeze({
    boundary,
    start(): void {
      if (disposed || stopped) throw bootstrapFailure();
      if (started) return; // No duplicate subscriptions / reactivation.
      started = true;
      boundary.transition("authenticating");
      if (disposed || stopped) return; // A subscriber may dispose re-entrantly.

      try {
        const teardown: unknown = source.subscribe(onEvent, controller.signal);
        if (typeof teardown !== "function") {
          failClosed();
          return;
        }
        if (disposed || stopped) {
          // subscribe() may synchronously emit a bad event or trigger disposal.
          safeTeardown(teardown as () => void);
          return;
        }
        unsubscribe = teardown as () => void;
      } catch {
        failClosed();
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true; // Terminal BEFORE notifications or teardown callbacks.
      closeSource();
      boundary.dispose();
    },
  });
}
