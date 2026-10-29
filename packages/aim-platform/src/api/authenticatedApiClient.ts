import {
  ApiClientError,
  createApiClient,
  type ApiClient,
  type ApiClientOptions,
} from "@bandha/aim-platform/api/apiClient";

/**
 * File 46 — opt-in bearer authentication transport for the draft Asset Register API.
 *
 * This is NOT a login service, token store, refresh-token handler, or proof of
 * authorization. The application must inject a trusted, session-scoped token
 * provider. That provider obtains credentials through a separately reviewed
 * identity flow and NEVER from a VITE_* variable or a hardcoded constant.
 *
 * An access token is acquired afresh for each request and held only in the
 * request's closure. The factory neither stores nor logs credentials.
 *
 * IMPORTANT: When the authenticated user/tenant/session changes, create a NEW
 * ApiClient instance and supply it to useServerAssetRegister. The controller
 * uses client identity to invalidate old pages immediately. Merely changing
 * the token returned by this provider does not invalidate already visible UI.
 *
 * The backend remains solely responsible for authenticating bearer tokens,
 * authorizing tenant/asset access, auditing, and enforcing engineering rules.
 */

/** Returning null/undefined means no active authenticated session. */
export type AccessTokenProvider = (
  signal: AbortSignal,
) => string | null | undefined | Promise<string | null | undefined>;

export type AuthenticatedApiClientOptions = ApiClientOptions & Readonly<{
  getAccessToken: AccessTokenProvider;
}>;

// RFC 6750 section 2.1 b64token grammar; allow opaque (not only JWT) tokens.
// Length bound also prevents unreasonable Authorization header allocation.
const BEARER_TOKEN = /^[A-Za-z0-9\-._~+/]+={0,}$/;
const MAX_BEARER_TOKEN_LENGTH = 8_192;

function authError(message: string): ApiClientError {
  // Existing transport error taxonomy has no dedicated AUTH_REQUIRED code.
  // INVALID_REQUEST distinguishes local credential acquisition problems from
  // genuine server HTTP 401/403 responses without manufacturing an HTTP status.
  return new ApiClientError("INVALID_REQUEST", message);
}

function aborted(): ApiClientError {
  return new ApiClientError("ABORTED", "The API request was cancelled.");
}

/**
 * Observe caller cancellation even when a buggy token provider ignores its
 * AbortSignal and never resolves. Provider failures are deliberately redacted.
 */
async function acquireToken(
  provider: AccessTokenProvider,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) throw aborted();

  let onAbort: () => void = () => undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(aborted());
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    let token: string | null | undefined;
    try {
      token = await Promise.race([
        Promise.resolve().then(() => provider(signal)),
        cancelled,
      ]);
    } catch {
      if (signal.aborted) throw aborted();
      // Never echo provider exceptions; they could include secret material.
      throw authError("Authentication credentials could not be obtained.");
    }

    if (signal.aborted) throw aborted();
    if (
      typeof token !== "string" ||
      token.length === 0 ||
      token.length > MAX_BEARER_TOKEN_LENGTH ||
      !BEARER_TOKEN.test(token)
    ) {
      throw authError("An authenticated access token is required.");
    }
    return token;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

/**
 * Return an ApiClient with the exact same typed request contract as
 * createApiClient(), but with a fresh bearer token added to each HTTP request.
 *
 * The existing client still validates same-origin paths, JSON bodies,
 * timeouts, HTTP status, response limits, and decoded JSON. This adapter
 * does not bypass or duplicate those rules.
 *
 * Bearer requests deliberately omit ambient cookies and disallow redirects.
 * No request occurs at construction time or when no token is available.
 */
export function createAuthenticatedApiClient(
  options: AuthenticatedApiClientOptions,
): ApiClient {
  if (typeof options.getAccessToken !== "function") {
    throw authError("An access-token provider is required.");
  }

  const rawFetch = options.fetchImpl ?? fetch;
  const basePath = options.apiBasePath;

  const authenticatedFetch: typeof fetch = async (input, init) => {
    // Only the existing path-restricted transport may invoke this wrapper.
    // Check before requesting a credential or constructing an auth header.
    if (
      typeof input !== "string" ||
      !input.startsWith(`${basePath}/`) ||
      init?.signal == null ||
      init.mode !== "same-origin" ||
      init.redirect !== "error"
    ) {
      throw authError("Invalid authenticated API transport request.");
    }

    const signal = init.signal;
    const token = await acquireToken(options.getAccessToken, signal);
    if (signal.aborted) throw aborted();

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);

    // Overrides deliberately prohibit implicit cookie authentication. The
    // raw transport must still honor mode, redirect, and AbortSignal.
    return rawFetch(input, {
      ...init,
      mode: "same-origin",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers,
      signal,
    });
  };

  return createApiClient({
    apiBasePath: options.apiBasePath,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    fetchImpl: authenticatedFetch,
  });
}
