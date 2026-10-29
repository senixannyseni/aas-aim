import { describe, expect, it, vi } from "vitest";

import { ApiClientError, type ApiClient, type ApiErrorCode } from "../api/apiClient";
import {
  createAuthSessionBoundary,
  type AuthSessionActivation,
  type AuthSessionBoundary,
  type UnauthenticatedPhase,
} from "./authSession";

/**
 * File 49 — permanent tests for the frontend authentication SESSION boundary.
 *
 * All identities, tenant keys and bearer tokens are synthetic test fixtures.
 * Every network exchange uses an injected fetch; no login, identity provider,
 * browser credential store, or Java backend is contacted. The frontend cannot
 * prove identity/tenant authorization: the authoritative backend must do that.
 */
const TOKEN = "synthetic-access-token-123";
const SESSION: AuthSessionActivation = {
  subjectKey: "subject-fixture-A",
  tenantKey: "tenant-fixture-A",
  sessionKey: "session-fixture-A",
  getAccessToken: () => TOKEN,
};

const REQUEST = {
  pathSegments: ["v1", "assets"],
  decode: (input: unknown): unknown => input,
} as const;

type FetchCall = Readonly<{ input: RequestInfo | URL; init: RequestInit | undefined }>;
type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function transport(handler: typeof fetch = async () => response({ assets: [] })): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ input, init });
    return handler(input, init);
  };
  return { fetchImpl, calls };
}

function boundary(fetchImpl?: typeof fetch, timeoutMs?: number): AuthSessionBoundary {
  return createAuthSessionBoundary({
    apiBasePath: "/api",
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
}

function currentClient(auth: AuthSessionBoundary): ApiClient {
  const client = auth.getSnapshot().client;
  if (client === null) throw new Error("The test fixture expected an authenticated session");
  return client;
}

function fetchAssets(client: ApiClient, signal?: AbortSignal): Promise<unknown> {
  return client.request({
    ...REQUEST,
    ...(signal === undefined ? {} : { signal }),
  });
}

async function expectApiError(
  operation: Promise<unknown>,
  code: ApiErrorCode,
  status: number | null = null,
): Promise<ApiClientError> {
  try {
    await operation;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApiClientError);
    const typed = error as ApiClientError;
    expect(typed.code).toBe(code);
    expect(typed.status).toBe(status);
    return typed;
  }
  throw new Error(`Expected ${code}, but the operation succeeded`);
}

function expectInvalid(callback: () => void): void {
  try {
    callback();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).code).toBe("INVALID_REQUEST");
    return;
  }
  throw new Error("Expected an invalid session configuration error");
}

describe("authSession — initial state and observable snapshots", () => {
  it("starts signed out, without an API client or credential lookup", () => {
    let lookups = 0;
    const fetch = transport();
    const auth = boundary(fetch.fetchImpl);
    expect(auth.getSnapshot()).toEqual({ phase: "signed-out", revision: 0, client: null });
    expect(auth.getSnapshot().client).toBeNull();
    expect(lookups).toBe(0);
    expect(fetch.calls).toHaveLength(0);
    auth.activate({ ...SESSION, getAccessToken: () => { lookups += 1; return TOKEN; } });
    expect(lookups).toBe(0);
    expect(fetch.calls).toHaveLength(0);
    auth.dispose();
  });

  it("keeps snapshot object identity stable between updates for useSyncExternalStore", () => {
    const auth = boundary();
    const original = auth.getSnapshot();
    expect(auth.getSnapshot()).toBe(original);
    auth.transition("authenticating");
    const changed = auth.getSnapshot();
    expect(changed).not.toBe(original);
    expect(auth.getSnapshot()).toBe(changed);
    auth.dispose();
  });

  it("freezes published snapshots and the boundary interface", () => {
    const auth = boundary();
    expect(Object.isFrozen(auth)).toBe(true);
    expect(Object.isFrozen(auth.getSnapshot())).toBe(true);
    auth.activate(SESSION);
    expect(Object.isFrozen(auth.getSnapshot())).toBe(true);
    expect(Object.isFrozen(currentClient(auth))).toBe(true);
    auth.dispose();
  });

  it("increments revision on repeated and identical state transitions", () => {
    const auth = boundary();
    auth.transition("signed-out");
    auth.transition("signed-out");
    auth.activate(SESSION);
    auth.activate(SESSION);
    expect(auth.getSnapshot().revision).toBe(4);
    auth.dispose();
  });

  for (const phase of ["signed-out", "authenticating", "refreshing", "expired", "revoked", "error"] as const) {
    it(`publishes phase ${phase} with no visible client`, () => {
      const auth = boundary();
      auth.activate(SESSION);
      auth.transition(phase);
      expect(auth.getSnapshot()).toMatchObject({ phase, client: null, revision: 2 });
      auth.dispose();
    });
  }

  it("does not expose keys, access tokens, or a token provider on the snapshot", () => {
    const auth = boundary();
    auth.activate(SESSION);
    const snapshot = auth.getSnapshot();
    expect(Object.keys(snapshot).sort()).toEqual(["client", "phase", "revision"]);
    const text = JSON.stringify(snapshot);
    for (const sensitive of [TOKEN, SESSION.subjectKey, SESSION.tenantKey, SESSION.sessionKey]) {
      expect(text).not.toContain(sensitive);
    }
    auth.dispose();
  });
});

describe("authSession — activation and identity isolation", () => {
  for (const variant of [
    { name: "the same identity and session", changes: {} },
    { name: "a new user", changes: { subjectKey: "subject-fixture-B" } },
    { name: "a different tenant", changes: { tenantKey: "tenant-fixture-B" } },
    { name: "a different session incarnation", changes: { sessionKey: "session-fixture-B" } },
  ]) {
    it(`rotates the API client for ${variant.name}`, async () => {
      const fetch = transport();
      const auth = boundary(fetch.fetchImpl);
      auth.activate(SESSION);
      const previous = currentClient(auth);
      auth.activate({ ...SESSION, ...variant.changes });
      expect(currentClient(auth)).not.toBe(previous);
      expect(auth.getSnapshot().revision).toBe(2);
      await expectApiError(fetchAssets(previous), "ABORTED");
      expect(fetch.calls).toHaveLength(0);
      await expect(fetchAssets(currentClient(auth))).resolves.toEqual({ assets: [] });
      expect(fetch.calls).toHaveLength(1);
      auth.dispose();
    });
  }

  it("invalidates an A → B → A sequence without reusing the first A client", async () => {
    const fetch = transport();
    const auth = boundary(fetch.fetchImpl);
    auth.activate(SESSION);
    const first = currentClient(auth);
    auth.activate({ ...SESSION, sessionKey: "B" });
    const middle = currentClient(auth);
    auth.activate(SESSION);
    const latest = currentClient(auth);
    expect(latest).not.toBe(first);
    await expectApiError(fetchAssets(first), "ABORTED");
    await expectApiError(fetchAssets(middle), "ABORTED");
    await expect(fetchAssets(latest)).resolves.toEqual({ assets: [] });
    expect(fetch.calls).toHaveLength(1);
    auth.dispose();
  });

  it("does not acquire credentials while activating an already trusted session", () => {
    let lookups = 0;
    const auth = boundary();
    auth.activate({ ...SESSION, getAccessToken: () => { lookups += 1; return TOKEN; } });
    expect(lookups).toBe(0);
    auth.activate({ ...SESSION, getAccessToken: () => { lookups += 1; return TOKEN; } });
    expect(lookups).toBe(0);
    auth.dispose();
  });

  it("obtains a fresh bearer token for every request without caching one in the snapshot", async () => {
    const fetch = transport();
    let count = 0;
    const auth = boundary(fetch.fetchImpl);
    auth.activate({ ...SESSION, getAccessToken: () => `fixture-token-${++count}` });
    await fetchAssets(currentClient(auth));
    await fetchAssets(currentClient(auth));
    expect(count).toBe(2);
    expect(new Headers(fetch.calls[0]?.init?.headers).get("authorization")).toBe("Bearer fixture-token-1");
    expect(new Headers(fetch.calls[1]?.init?.headers).get("authorization")).toBe("Bearer fixture-token-2");
    auth.dispose();
  });

  it("preserves same-origin transport controls and the decoded response", async () => {
    const fetch = transport(async () => response({ authorizedAssets: ["fixture-A"] }));
    const auth = boundary(fetch.fetchImpl);
    auth.activate(SESSION);
    await expect(fetchAssets(currentClient(auth))).resolves.toEqual({ authorizedAssets: ["fixture-A"] });
    expect(fetch.calls[0]?.input).toBe("/api/v1/assets");
    expect(fetch.calls[0]?.init).toMatchObject({
      method: "GET", mode: "same-origin", credentials: "omit", redirect: "error",
      cache: "no-store", referrerPolicy: "no-referrer",
    });
    expect(new Headers(fetch.calls[0]?.init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    auth.dispose();
  });

  it("rejects malformed request paths before acquiring a token", async () => {
    let tokenCalls = 0;
    const fetch = transport();
    const auth = boundary(fetch.fetchImpl);
    auth.activate({ ...SESSION, getAccessToken: () => { tokenCalls += 1; return TOKEN; } });
    await expectApiError(currentClient(auth).request({
      pathSegments: ["v1", "..", "assets"], decode: (value) => value,
    }), "INVALID_REQUEST");
    expect(tokenCalls).toBe(0);
    expect(fetch.calls).toHaveLength(0);
    auth.dispose();
  });
});

describe("authSession — fail-closed configuration", () => {
  for (const field of ["subjectKey", "tenantKey", "sessionKey"] as const) {
    for (const value of ["", " leading", "trailing ", "bad\nkey", "bad\u007fkey", "x".repeat(257), null, 17]) {
      it(`rejects invalid ${field} (${JSON.stringify(value).slice(0, 30)}) and revokes the existing client`, async () => {
        const fetch = transport();
        const auth = boundary(fetch.fetchImpl);
        auth.activate(SESSION);
        const old = currentClient(auth);
        expectInvalid(() => auth.activate({ ...SESSION, [field]: value } as unknown as AuthSessionActivation));
        expect(auth.getSnapshot()).toMatchObject({ phase: "error", client: null, revision: 2 });
        await expectApiError(fetchAssets(old), "ABORTED");
        expect(fetch.calls).toHaveLength(0);
        auth.dispose();
      });
    }
  }

  for (const bad of [null, undefined, 0, [], "session", {}]) {
    it(`rejects a non-session activation (${String(bad)})`, () => {
      const auth = boundary();
      expectInvalid(() => auth.activate(bad as unknown as AuthSessionActivation));
      expect(auth.getSnapshot()).toMatchObject({ phase: "error", client: null, revision: 1 });
      auth.dispose();
    });
  }

  for (const provider of [null, undefined, "hardcoded", {}, 12]) {
    it(`rejects a non-callable provider (${String(provider)}) and invalidates old sessions`, async () => {
      const auth = boundary();
      auth.activate(SESSION);
      const old = currentClient(auth);
      expectInvalid(() => auth.activate({ ...SESSION, getAccessToken: provider } as unknown as AuthSessionActivation));
      expect(auth.getSnapshot().phase).toBe("error");
      await expectApiError(fetchAssets(old), "ABORTED");
      auth.dispose();
    });
  }

  it("does not accept authenticated as a public transition phase", async () => {
    const auth = boundary();
    auth.activate(SESSION);
    const old = currentClient(auth);
    expectInvalid(() => auth.transition("authenticated" as UnauthenticatedPhase));
    expect(auth.getSnapshot()).toMatchObject({ phase: "error", client: null });
    await expectApiError(fetchAssets(old), "ABORTED");
    auth.dispose();
  });

  it("invalid transport configuration fails closed without publishing an authenticated client", () => {
    const auth = createAuthSessionBoundary({ apiBasePath: "https://untrusted.example/api" });
    expectInvalid(() => auth.activate(SESSION));
    expect(auth.getSnapshot()).toMatchObject({ phase: "error", client: null, revision: 1 });
    auth.dispose();
  });
});

describe("authSession — subscriptions and lifecycle notifications", () => {
  it("notifies observers only after replacing the published snapshot", () => {
    const auth = boundary();
    const observations: string[] = [];
    auth.subscribe(() => observations.push(`${auth.getSnapshot().revision}:${auth.getSnapshot().phase}`));
    auth.activate(SESSION);
    auth.transition("refreshing");
    auth.transition("expired");
    expect(observations).toEqual(["1:authenticated", "2:refreshing", "3:expired"]);
    auth.dispose();
  });

  it("invalidates the old client before notifying a subscriber", async () => {
    const auth = boundary();
    auth.activate(SESSION);
    const old = currentClient(auth);
    let observedClient: ApiClient | null = old;
    auth.subscribe(() => { observedClient = auth.getSnapshot().client; });
    auth.transition("signed-out");
    expect(observedClient).toBeNull();
    await expectApiError(fetchAssets(old), "ABORTED");
    auth.dispose();
  });

  it("supports idempotent unsubscribe and avoids later notifications", () => {
    const auth = boundary();
    let events = 0;
    const stop = auth.subscribe(() => { events += 1; });
    auth.activate(SESSION);
    stop();
    stop();
    auth.transition("revoked");
    expect(events).toBe(1);
    auth.dispose();
  });

  it("does not let a throwing observer prevent another observer or the revocation", async () => {
    const auth = boundary();
    auth.activate(SESSION);
    const old = currentClient(auth);
    let events = 0;
    auth.subscribe(() => { throw new Error("synthetic observer failure"); });
    auth.subscribe(() => { events += 1; });
    expect(() => auth.transition("signed-out")).not.toThrow();
    expect(events).toBe(1);
    await expectApiError(fetchAssets(old), "ABORTED");
    auth.dispose();
  });

  it("rejects invalid subscribers without changing the revision", () => {
    const auth = boundary();
    expectInvalid(() => auth.subscribe(null as unknown as () => void));
    expectInvalid(() => auth.subscribe("observer" as unknown as () => void));
    expect(auth.getSnapshot().revision).toBe(0);
    auth.dispose();
  });
});

describe("authSession — revocation, cancellation and race protection", () => {
  for (const phase of ["signed-out", "authenticating", "refreshing", "expired", "revoked", "error"] as const) {
    it(`rejects retained client references immediately on ${phase}`, async () => {
      let tokenCalls = 0;
      const fetch = transport();
      const auth = boundary(fetch.fetchImpl);
      auth.activate({ ...SESSION, getAccessToken: () => { tokenCalls += 1; return TOKEN; } });
      const old = currentClient(auth);
      auth.transition(phase);
      await expectApiError(fetchAssets(old), "ABORTED");
      expect(tokenCalls).toBe(0);
      expect(fetch.calls).toHaveLength(0);
      auth.dispose();
    });
  }

  it("cancels pending token acquisition and prevents a late token from reaching fetch", async () => {
    const token = deferred<string>();
    const fetch = transport();
    const auth = boundary(fetch.fetchImpl);
    auth.activate({ ...SESSION, getAccessToken: () => token.promise });
    const old = currentClient(auth);
    const pending = fetchAssets(old);
    auth.transition("revoked");
    await expectApiError(pending, "ABORTED");
    token.resolve("late-token-synthetic");
    await Promise.resolve();
    await Promise.resolve();
    expect(fetch.calls).toHaveLength(0);
    auth.dispose();
  });

  it("rejects an in-flight fetch that ignores the abort signal", async () => {
    const fetch = transport(() => new Promise<Response>(() => undefined));
    const auth = boundary(fetch.fetchImpl);
    auth.activate(SESSION);
    const pending = fetchAssets(currentClient(auth));
    await vi.waitFor(() => expect(fetch.calls).toHaveLength(1));
    auth.transition("expired");
    await expectApiError(pending, "ABORTED");
    expect(fetch.calls[0]?.init?.signal?.aborted).toBe(true);
    auth.dispose();
  });

  it("aborts the previous tenant's pending request before delivering the new tenant's data", async () => {
    const oldResponse = deferred<Response>();
    const newResponse = deferred<Response>();
    let count = 0;
    const fetch = transport(() => (++count === 1 ? oldResponse.promise : newResponse.promise));
    const auth = boundary(fetch.fetchImpl);
    auth.activate(SESSION);
    const oldClient = currentClient(auth);
    const oldRequest = fetchAssets(oldClient);
    const oldOutcome = oldRequest.catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetch.calls).toHaveLength(1));

    auth.activate({ ...SESSION, tenantKey: "tenant-fixture-B", sessionKey: "session-fixture-B" });
    const newRequest = fetchAssets(currentClient(auth));
    await vi.waitFor(() => expect(fetch.calls).toHaveLength(2));
    newResponse.resolve(response({ tenant: "fixture-B" }));
    await expect(newRequest).resolves.toEqual({ tenant: "fixture-B" });
    oldResponse.resolve(response({ tenant: "fixture-A" }));
    expect((await oldOutcome) as ApiClientError).toMatchObject({ code: "ABORTED" });
    expect(fetch.calls[0]?.init?.signal?.aborted).toBe(true);
    auth.dispose();
  });

  it("caller cancellation ends a request even if fetch does not cooperate", async () => {
    const fetch = transport(() => new Promise<Response>(() => undefined));
    const auth = boundary(fetch.fetchImpl);
    auth.activate(SESSION);
    const caller = new AbortController();
    const pending = fetchAssets(currentClient(auth), caller.signal);
    await vi.waitFor(() => expect(fetch.calls).toHaveLength(1));
    caller.abort();
    await expectApiError(pending, "ABORTED");
    expect(fetch.calls[0]?.init?.signal?.aborted).toBe(true);
    auth.dispose();
  });

  it("pre-aborted caller signals do not request a token or transmit HTTP", async () => {
    const fetch = transport();
    let tokens = 0;
    const auth = boundary(fetch.fetchImpl);
    auth.activate({ ...SESSION, getAccessToken: () => { tokens += 1; return TOKEN; } });
    const caller = new AbortController();
    caller.abort();
    await expectApiError(fetchAssets(currentClient(auth), caller.signal), "ABORTED");
    expect(tokens).toBe(0);
    expect(fetch.calls).toHaveLength(0);
    auth.dispose();
  });

  it("keeps token-provider acquisition within the request deadline", async () => {
    const auth = boundary(undefined, 50);
    auth.activate({ ...SESSION, getAccessToken: () => new Promise<string>(() => undefined) });
    await expectApiError(fetchAssets(currentClient(auth)), "TIMEOUT");
    auth.dispose();
  });

  for (const status of [401, 403, 429, 500, 503]) {
    it(`retains HTTP ${status} classification without reflecting an error body`, async () => {
      const fetch = transport(async () => new Response("synthetic-sensitive-server-body", {
        status,
        headers: { "content-type": "text/plain" },
      }));
      const auth = boundary(fetch.fetchImpl);
      auth.activate(SESSION);
      const error = await expectApiError(fetchAssets(currentClient(auth)), "HTTP_ERROR", status);
      expect(error.message).not.toContain("synthetic-sensitive-server-body");
      auth.dispose();
    });
  }
});

describe("authSession — terminal disposal", () => {
  it("publishes revoked once, invalidates prior clients, and makes disposal idempotent", async () => {
    const auth = boundary();
    auth.activate(SESSION);
    const old = currentClient(auth);
    const revisions: number[] = [];
    auth.subscribe(() => { revisions.push(auth.getSnapshot().revision); });
    auth.dispose();
    auth.dispose();
    expect(auth.getSnapshot()).toMatchObject({ phase: "revoked", revision: 2, client: null });
    expect(revisions).toEqual([2]);
    await expectApiError(fetchAssets(old), "ABORTED");
  });

  it("blocks activation, transition and new subscriptions after disposal", () => {
    const auth = boundary();
    auth.dispose();
    expectInvalid(() => auth.activate(SESSION));
    expectInvalid(() => auth.transition("signed-out"));
    expectInvalid(() => auth.subscribe(() => undefined));
    expect(auth.getSnapshot()).toMatchObject({ phase: "revoked", client: null });
  });

  it("does not allow re-entrant observers to reactivate while disposing", () => {
    const auth = boundary();
    auth.activate(SESSION);
    let rejected = 0;
    auth.subscribe(() => {
      try { auth.activate(SESSION); }
      catch (error: unknown) {
        if (error instanceof ApiClientError && error.code === "INVALID_REQUEST") rejected += 1;
      }
    });
    auth.dispose();
    expect(rejected).toBe(1);
    expect(auth.getSnapshot()).toMatchObject({ phase: "revoked", client: null });
  });

  it("aborts outstanding work on disposal even when fetch ignores cancellation", async () => {
    const fetch = transport(() => new Promise<Response>(() => undefined));
    const auth = boundary(fetch.fetchImpl);
    auth.activate(SESSION);
    const pending = fetchAssets(currentClient(auth));
    await vi.waitFor(() => expect(fetch.calls).toHaveLength(1));
    auth.dispose();
    await expectApiError(pending, "ABORTED");
    expect(fetch.calls[0]?.init?.signal?.aborted).toBe(true);
  });
});
