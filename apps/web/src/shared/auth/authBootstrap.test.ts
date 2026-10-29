import { describe, expect, it } from "vitest";

import { ApiClientError, type ApiClient, type ApiErrorCode } from "../api/apiClient";
import {
  createAuthBootstrap,
  type AuthBootstrap,
  type AuthBootstrapOptions,
  type TrustedAuthEvent,
  type TrustedIdentitySource,
} from "./authBootstrap";
import { type AuthSessionActivation, type AuthSessionPhase } from "./authSession";

/**
 * File 56 — permanent regression tests for the trusted authentication bootstrap.
 *
 * All identities, tenant IDs, tokens and HTTP responses are synthetic fixtures.
 * This suite DOES NOT simulate a real login, confer permissions, contact an
 * identity provider, or verify backend tenant authorization. A source is trusted
 * only by the application composition that supplies it, never by this code.
 */

const TOKEN_A = "synthetic-bootstrap-access-A";
const TOKEN_B = "synthetic-bootstrap-access-B";
const SESSION_A: AuthSessionActivation = Object.freeze({
  subjectKey: "synthetic-subject-A",
  tenantKey: "synthetic-tenant-A",
  sessionKey: "synthetic-session-A",
  getAccessToken: () => TOKEN_A,
});
const SESSION_B: AuthSessionActivation = Object.freeze({
  subjectKey: "synthetic-subject-B",
  tenantKey: "synthetic-tenant-B",
  sessionKey: "synthetic-session-B",
  getAccessToken: () => TOKEN_B,
});
const REQUEST = {
  pathSegments: ["v1", "assets"],
  decode: (value: unknown): unknown => value,
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

function jsonResponse(value: unknown = { synthetic: true }): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function mockTransport(
  handler: typeof fetch = async () => jsonResponse(),
): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ input, init });
    return handler(input, init);
  };
  return { fetchImpl, calls };
}

type SourceFixture = Readonly<{
  source: TrustedIdentitySource;
  emit: (event: TrustedAuthEvent) => void;
  emitLate: (event: TrustedAuthEvent) => void;
  activeSignal: () => AbortSignal | null;
  subscribeCount: () => number;
  teardownCount: () => number;
}>;

/** Retain the original callback deliberately to test bad late deliveries. */
function sourceFixture(
  onSubscribe?: (emit: (event: TrustedAuthEvent) => void, signal: AbortSignal) => void,
): SourceFixture {
  let handler: ((event: TrustedAuthEvent) => void) | null = null;
  let latestHandler: ((event: TrustedAuthEvent) => void) | null = null;
  let signal: AbortSignal | null = null;
  let subscribed = 0;
  let teardowns = 0;
  const source: TrustedIdentitySource = {
    subscribe(onEvent, receivedSignal) {
      subscribed++;
      handler = onEvent;
      latestHandler = onEvent;
      signal = receivedSignal;
      onSubscribe?.(onEvent, receivedSignal);
      return () => {
        teardowns++;
        handler = null;
      };
    },
  };
  return {
    source,
    emit(event) {
      if (handler === null) throw new Error("Test source is not subscribed");
      handler(event);
    },
    emitLate(event) {
      // Intentional adapter misbehavior: ignore teardown / AbortSignal.
      latestHandler?.(event);
    },
    activeSignal: () => signal,
    subscribeCount: () => subscribed,
    teardownCount: () => teardowns,
  };
}

function authenticated(session: AuthSessionActivation = SESSION_A): TrustedAuthEvent {
  return { type: "authenticated", session };
}

function setup(
  source: TrustedIdentitySource = sourceFixture().source,
  fetchImpl?: typeof fetch,
): AuthBootstrap {
  return createAuthBootstrap({
    apiBasePath: "/api",
    identitySource: source,
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
  });
}

function requireClient(bootstrap: AuthBootstrap): ApiClient {
  const client = bootstrap.boundary.getSnapshot().client;
  if (client === null) throw new Error("Expected authenticated test session");
  return client;
}

function getAssets(client: ApiClient, signal?: AbortSignal): Promise<unknown> {
  return client.request({
    ...REQUEST,
    ...(signal === undefined ? {} : { signal }),
  });
}

async function expectRequestError(
  operation: Promise<unknown>,
  code: ApiErrorCode,
  status: number | null = null,
): Promise<void> {
  try {
    await operation;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApiClientError);
    const actual = error as ApiClientError;
    expect(actual.code).toBe(code);
    expect(actual.status).toBe(status);
    return;
  }
  throw new Error(`Expected ${code} but the request succeeded`);
}

function expectBootstrapFailure(action: () => void): void {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Trusted authentication bootstrap is unavailable.");
    return;
  }
  throw new Error("Expected the authentication bootstrap to fail closed");
}

async function untilCalled(calls: FetchCall[], count = 1): Promise<void> {
  // Requests have an asynchronous token-resolution boundary before fetch().
  for (let attempt = 0; attempt < 20 && calls.length < count; attempt++) {
    await Promise.resolve();
  }
  expect(calls).toHaveLength(count);
}

describe("authBootstrap — initialization and explicit start", () => {
  it("constructs signed out with no source subscription, credentials, or HTTP requests", () => {
    const source = sourceFixture();
    const http = mockTransport();
    const bootstrap = setup(source.source, http.fetchImpl);
    expect(bootstrap.boundary.getSnapshot()).toEqual({ phase: "signed-out", revision: 0, client: null });
    expect(source.subscribeCount()).toBe(0);
    expect(source.activeSignal()).toBeNull();
    expect(http.calls).toHaveLength(0);
    bootstrap.dispose();
  });

  it("exposes a frozen bootstrap and no credential-bearing properties", () => {
    const bootstrap = setup();
    expect(Object.isFrozen(bootstrap)).toBe(true);
    expect(Object.keys(bootstrap).sort()).toEqual(["boundary", "dispose", "start"]);
    expect(bootstrap.boundary.getSnapshot().client).toBeNull();
    bootstrap.dispose();
  });

  it("enters authenticating and subscribes once on explicit start", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    expect(bootstrap.boundary.getSnapshot()).toEqual({ phase: "authenticating", revision: 1, client: null });
    expect(source.subscribeCount()).toBe(1);
    expect(source.activeSignal()?.aborted).toBe(false);
    bootstrap.start();
    bootstrap.start();
    expect(source.subscribeCount()).toBe(1);
    expect(bootstrap.boundary.getSnapshot().revision).toBe(1);
    bootstrap.dispose();
  });

  it("accepts a synchronous authenticated event emitted while subscribe runs", () => {
    const source = sourceFixture((emit) => emit(authenticated()));
    const bootstrap = setup(source.source);
    bootstrap.start();
    expect(bootstrap.boundary.getSnapshot().phase).toBe("authenticated");
    expect(requireClient(bootstrap)).toBe(bootstrap.boundary.getSnapshot().client);
    expect(source.teardownCount()).toBe(0);
    bootstrap.dispose();
    expect(source.teardownCount()).toBe(1);
  });

  it("publishes state changes through stable session-boundary snapshots", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    const observed: AuthSessionPhase[] = [];
    bootstrap.boundary.subscribe(() => observed.push(bootstrap.boundary.getSnapshot().phase));
    const signedOut = bootstrap.boundary.getSnapshot();
    expect(bootstrap.boundary.getSnapshot()).toBe(signedOut);
    bootstrap.start();
    source.emit(authenticated());
    source.emit({ type: "signed-out" });
    expect(observed).toEqual(["authenticating", "authenticated", "signed-out"]);
    expect(bootstrap.boundary.getSnapshot()).not.toBe(signedOut);
    expect(Object.isFrozen(bootstrap.boundary.getSnapshot())).toBe(true);
    bootstrap.dispose();
  });

  it("does not call the token provider during construction, start, or activation", () => {
    let lookups = 0;
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    const session = { ...SESSION_A, getAccessToken: () => { lookups++; return TOKEN_A; } };
    bootstrap.start();
    source.emit(authenticated(session));
    expect(lookups).toBe(0);
    bootstrap.dispose();
    expect(lookups).toBe(0);
  });

  for (const phase of ["signed-out", "authenticating", "refreshing", "expired", "revoked", "error"] as const) {
    it(`accepts ${phase} as a lifecycle event and invalidates the authenticated client`, async () => {
      const source = sourceFixture();
      const http = mockTransport();
      const bootstrap = setup(source.source, http.fetchImpl);
      bootstrap.start();
      source.emit(authenticated());
      const previous = requireClient(bootstrap);
      source.emit({ type: phase });
      const current = bootstrap.boundary.getSnapshot();
      expect(current.phase).toBe(phase);
      expect(current.client).toBeNull();
      expect(current.revision).toBe(3);
      await expectRequestError(getAssets(previous), "ABORTED");
      expect(http.calls).toHaveLength(0);
      bootstrap.dispose();
    });
  }

  it("allows reauthentication after a nonterminal signed-out event", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    source.emit(authenticated());
    const previous = requireClient(bootstrap);
    source.emit({ type: "signed-out" });
    source.emit(authenticated(SESSION_B));
    expect(bootstrap.boundary.getSnapshot().phase).toBe("authenticated");
    expect(requireClient(bootstrap)).not.toBe(previous);
    bootstrap.dispose();
  });
});

describe("authBootstrap — session replacement and transport separation", () => {
  for (const item of [
    { label: "identical session keys", patch: {} },
    { label: "different subject", patch: { subjectKey: "synthetic-subject-C" } },
    { label: "different tenant", patch: { tenantKey: "synthetic-tenant-C" } },
    { label: "different session incarnation", patch: { sessionKey: "synthetic-session-C" } },
    { label: "different token provider", patch: { getAccessToken: () => TOKEN_B } },
  ]) {
    it(`rotates clients for ${item.label} and permanently revokes the previous client`, async () => {
      const source = sourceFixture();
      const http = mockTransport();
      const bootstrap = setup(source.source, http.fetchImpl);
      bootstrap.start();
      source.emit(authenticated());
      const oldClient = requireClient(bootstrap);
      source.emit(authenticated({ ...SESSION_A, ...item.patch }));
      const nextClient = requireClient(bootstrap);
      expect(nextClient).not.toBe(oldClient);
      expect(bootstrap.boundary.getSnapshot().revision).toBe(3);
      await expectRequestError(getAssets(oldClient), "ABORTED");
      expect(http.calls).toHaveLength(0);
      expect(await getAssets(nextClient)).toEqual({ synthetic: true });
      expect(http.calls).toHaveLength(1);
      bootstrap.dispose();
    });
  }

  it("sends the actual token only in the current request's Authorization header", async () => {
    const source = sourceFixture();
    const http = mockTransport();
    const bootstrap = setup(source.source, http.fetchImpl);
    bootstrap.start();
    source.emit(authenticated());
    expect(await getAssets(requireClient(bootstrap))).toEqual({ synthetic: true });
    source.emit(authenticated(SESSION_B));
    expect(await getAssets(requireClient(bootstrap))).toEqual({ synthetic: true });
    expect(http.calls).toHaveLength(2);
    expect(http.calls[0]?.input).toBe("/api/v1/assets");
    expect(http.calls[1]?.input).toBe("/api/v1/assets");
    const firstHeaders = new Headers(http.calls[0]?.init?.headers);
    const nextHeaders = new Headers(http.calls[1]?.init?.headers);
    expect(firstHeaders.get("Authorization")).toBe(`Bearer ${TOKEN_A}`);
    expect(nextHeaders.get("Authorization")).toBe(`Bearer ${TOKEN_B}`);
    expect(http.calls[0]?.init?.credentials).toBe("omit");
    expect(http.calls[0]?.init?.redirect).toBe("error");
    expect(http.calls[0]?.init?.cache).toBe("no-store");
    bootstrap.dispose();
  });

  it("acquires a fresh token for every explicit request", async () => {
    let lookups = 0;
    const source = sourceFixture();
    const http = mockTransport();
    const bootstrap = setup(source.source, http.fetchImpl);
    bootstrap.start();
    source.emit(authenticated({ ...SESSION_A, getAccessToken: () => { lookups++; return TOKEN_A; } }));
    await getAssets(requireClient(bootstrap));
    await getAssets(requireClient(bootstrap));
    expect(lookups).toBe(2);
    expect(http.calls).toHaveLength(2);
    bootstrap.dispose();
  });

  it("never serializes session keys or bearer tokens into its public snapshot", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    source.emit(authenticated());
    const serialized = JSON.stringify(bootstrap.boundary.getSnapshot());
    expect(Object.keys(bootstrap.boundary.getSnapshot()).sort()).toEqual(["client", "phase", "revision"]);
    for (const secret of [TOKEN_A, SESSION_A.subjectKey, SESSION_A.tenantKey, SESSION_A.sessionKey]) {
      expect(serialized.includes(secret)).toBe(false);
    }
    bootstrap.dispose();
  });

  it("does not allow a retired client to make further requests after reauthentication", async () => {
    const source = sourceFixture();
    const http = mockTransport();
    const bootstrap = setup(source.source, http.fetchImpl);
    bootstrap.start();
    source.emit(authenticated());
    const first = requireClient(bootstrap);
    source.emit({ type: "refreshing" });
    source.emit(authenticated(SESSION_B));
    const second = requireClient(bootstrap);
    await expectRequestError(getAssets(first), "ABORTED");
    expect(await getAssets(second)).toEqual({ synthetic: true });
    expect(http.calls).toHaveLength(1);
    bootstrap.dispose();
  });

  for (const status of [401, 403, 429, 500, 503]) {
    it(`preserves HTTP ${status} classification without reflecting backend body`, async () => {
      const source = sourceFixture();
      const http = mockTransport(async () => new Response("synthetic-sensitive-server-response", { status }));
      const bootstrap = setup(source.source, http.fetchImpl);
      bootstrap.start();
      source.emit(authenticated());
      try {
        await getAssets(requireClient(bootstrap));
        throw new Error("Unexpected success");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ApiClientError);
        const failure = error as ApiClientError;
        expect(failure.code).toBe("HTTP_ERROR");
        expect(failure.status).toBe(status);
        expect(failure.message.includes("synthetic-sensitive-server-response")).toBe(false);
      }
      bootstrap.dispose();
    });
  }
});

describe("authBootstrap — malformed configuration and source failures", () => {
  for (const candidate of [null, undefined, 42, {}, { identitySource: null }, { identitySource: {} }, { identitySource: { subscribe: false } }]) {
    it(`rejects an absent/noncallable trusted identity source (${String(candidate)})`, () => {
      expectBootstrapFailure(() => createAuthBootstrap(candidate as unknown as AuthBootstrapOptions));
    });
  }

  for (const base of ["", "/", "/api/", "/api/../admin", "//example/api", "https://other.example/api", "api", "/api?q=1"]) {
    it(`rejects invalid API base paths (${JSON.stringify(base)})`, () => {
      const source = sourceFixture();
      expectBootstrapFailure(() => createAuthBootstrap({
        apiBasePath: base,
        identitySource: source.source,
      }));
      expect(source.subscribeCount()).toBe(0);
    });
  }

  it("does not start an identity source when construction fails", () => {
    let subscribed = 0;
    expectBootstrapFailure(() => createAuthBootstrap({
      apiBasePath: "https://outside.invalid/api",
      identitySource: { subscribe: () => { subscribed++; return () => undefined; } },
    }));
    expect(subscribed).toBe(0);
  });

  it("fails closed if the identity source throws on subscribe", () => {
    const bootstrap = setup({ subscribe: () => { throw new Error("private identity provider secret"); } });
    bootstrap.start();
    expect(bootstrap.boundary.getSnapshot()).toMatchObject({ phase: "error", client: null });
    expectBootstrapFailure(() => bootstrap.start());
    bootstrap.dispose();
  });

  for (const invalidReturn of [null, undefined, false, "not-a-teardown", {}]) {
    it(`fails closed when subscribe returns a non-function (${String(invalidReturn)})`, () => {
      const bootstrap = setup({ subscribe: () => invalidReturn as unknown as () => void });
      bootstrap.start();
      expect(bootstrap.boundary.getSnapshot().phase).toBe("error");
      expect(bootstrap.boundary.getSnapshot().client).toBeNull();
      expectBootstrapFailure(() => bootstrap.start());
      bootstrap.dispose();
    });
  }

  it("rejects a malformed synchronous event and runs a teardown returned afterward", () => {
    let teardowns = 0;
    let captured: ((event: TrustedAuthEvent) => void) | null = null;
    const bootstrap = setup({
      subscribe(onEvent) {
        captured = onEvent;
        onEvent({ type: "alien-phase" } as unknown as TrustedAuthEvent);
        return () => { teardowns++; };
      },
    });
    bootstrap.start();
    expect(teardowns).toBe(1);
    expect(bootstrap.boundary.getSnapshot()).toMatchObject({ phase: "error", client: null });
    (captured as ((event: TrustedAuthEvent) => void) | null)?.(authenticated());
    expect(bootstrap.boundary.getSnapshot().phase).toBe("error");
    bootstrap.dispose();
  });

  for (const event of [
    null,
    undefined,
    12,
    {},
    { type: "unrecognized" },
    { type: "authenticated" },
    { type: "authenticated", session: null },
    { type: "authenticated", session: { ...SESSION_A, tenantKey: " " } },
    { type: "authenticated", session: { ...SESSION_A, getAccessToken: "not-a-provider" } },
  ]) {
    it(`revokes an established session when an invalid runtime event arrives (${JSON.stringify(event)?.slice(0, 64)})`, async () => {
      const source = sourceFixture();
      const http = mockTransport();
      const bootstrap = setup(source.source, http.fetchImpl);
      bootstrap.start();
      source.emit(authenticated());
      const oldClient = requireClient(bootstrap);
      source.emit(event as unknown as TrustedAuthEvent);
      expect(bootstrap.boundary.getSnapshot()).toMatchObject({ phase: "error", client: null });
      expect(source.activeSignal()?.aborted).toBe(true);
      expect(source.teardownCount()).toBe(1);
      await expectRequestError(getAssets(oldClient), "ABORTED");
      expect(http.calls).toHaveLength(0);
      source.emitLate(authenticated(SESSION_B));
      expect(bootstrap.boundary.getSnapshot().client).toBeNull();
      expectBootstrapFailure(() => bootstrap.start());
      bootstrap.dispose();
    });
  }

  it("revokes the current client when a malformed activation follows a valid one", async () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    source.emit(authenticated());
    const prior = requireClient(bootstrap);
    source.emit(authenticated({ ...SESSION_A, subjectKey: "\tbad" }));
    expect(bootstrap.boundary.getSnapshot().phase).toBe("error");
    expect(bootstrap.boundary.getSnapshot().client).toBeNull();
    await expectRequestError(getAssets(prior), "ABORTED");
    bootstrap.dispose();
  });

  it("prevents thrown subscriber notifications from restoring the old client", async () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    source.emit(authenticated());
    const prior = requireClient(bootstrap);
    bootstrap.boundary.subscribe(() => { throw new Error("synthetic observer failure"); });
    source.emit({ type: "revoked" });
    expect(bootstrap.boundary.getSnapshot().client).toBeNull();
    await expectRequestError(getAssets(prior), "ABORTED");
    bootstrap.dispose();
  });

  it("swallows source teardown failures after revoking the session", async () => {
    let callback: ((event: TrustedAuthEvent) => void) | null = null;
    const bootstrap = setup({
      subscribe(onEvent) {
        callback = onEvent;
        return () => { throw new Error("synthetic teardown secret"); };
      },
    });
    bootstrap.start();
    (callback as ((event: TrustedAuthEvent) => void) | null)?.(authenticated());
    const prior = requireClient(bootstrap);
    (callback as ((event: TrustedAuthEvent) => void) | null)?.({ type: "unrecognized" } as unknown as TrustedAuthEvent);
    expect(bootstrap.boundary.getSnapshot().phase).toBe("error");
    await expectRequestError(getAssets(prior), "ABORTED");
    bootstrap.dispose();
  });

  it("fails closed when an invalid transport timeout is activated", () => {
    const source = sourceFixture();
    const bootstrap = createAuthBootstrap({ apiBasePath: "/api", timeoutMs: 0, identitySource: source.source });
    bootstrap.start();
    source.emit(authenticated());
    expect(bootstrap.boundary.getSnapshot()).toMatchObject({ phase: "error", client: null });
    expect(source.activeSignal()?.aborted).toBe(true);
    bootstrap.dispose();
  });
});

describe("authBootstrap — cancellation and race isolation", () => {
  for (const event of ["signed-out", "refreshing", "expired", "revoked", "error"] as const) {
    it(`rejects in-flight responses after ${event}, including a noncooperative fetch`, async () => {
      const reply = deferred<Response>();
      const http = mockTransport(() => reply.promise);
      const source = sourceFixture();
      const bootstrap = setup(source.source, http.fetchImpl);
      bootstrap.start();
      source.emit(authenticated());
      const pending = getAssets(requireClient(bootstrap));
      await untilCalled(http.calls);
      source.emit({ type: event });
      await expectRequestError(pending, "ABORTED");
      expect(http.calls[0]?.init?.signal?.aborted).toBe(true);
      reply.resolve(jsonResponse({ synthetic: "stale" }));
      await Promise.resolve();
      expect(bootstrap.boundary.getSnapshot().client).toBeNull();
      bootstrap.dispose();
    });
  }

  it("rejects a stale old-session response after activating a new tenant", async () => {
    const firstResponse = deferred<Response>();
    const http = mockTransport((_input, init) => {
      const token = (init?.headers as Record<string, string>)["Authorization"];
      if (token === `Bearer ${TOKEN_A}`) return firstResponse.promise;
      return Promise.resolve(jsonResponse({ tenant: "synthetic-B" }));
    });
    const source = sourceFixture();
    const bootstrap = setup(source.source, http.fetchImpl);
    bootstrap.start();
    source.emit(authenticated());
    const prior = requireClient(bootstrap);
    const pending = getAssets(prior);
    await untilCalled(http.calls);
    source.emit(authenticated(SESSION_B));
    const next = requireClient(bootstrap);
    expect(await getAssets(next)).toEqual({ tenant: "synthetic-B" });
    await expectRequestError(pending, "ABORTED");
    firstResponse.resolve(jsonResponse({ tenant: "synthetic-A" }));
    await Promise.resolve();
    expect(bootstrap.boundary.getSnapshot().client).toBe(next);
    expect(http.calls).toHaveLength(2);
    bootstrap.dispose();
  });

  it("rejects a request whose access-token provider never returns, on sign-out", async () => {
    const source = sourceFixture();
    const http = mockTransport();
    const bootstrap = setup(source.source, http.fetchImpl);
    bootstrap.start();
    source.emit(authenticated({ ...SESSION_A, getAccessToken: () => new Promise<string>(() => undefined) }));
    const pending = getAssets(requireClient(bootstrap));
    source.emit({ type: "signed-out" });
    await expectRequestError(pending, "ABORTED");
    expect(http.calls).toHaveLength(0);
    bootstrap.dispose();
  });

  it("ignores a misbehaving late authenticated callback after an invalid event", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    source.emit({ type: "invalid" } as unknown as TrustedAuthEvent);
    const errorSnapshot = bootstrap.boundary.getSnapshot();
    source.emitLate(authenticated(SESSION_B));
    expect(bootstrap.boundary.getSnapshot()).toBe(errorSnapshot);
    expect(errorSnapshot.client).toBeNull();
    bootstrap.dispose();
  });
});

describe("authBootstrap — terminal disposal and reentrancy", () => {
  it("disposes safely before start without subscribing", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.dispose();
    expect(source.subscribeCount()).toBe(0);
    expect(bootstrap.boundary.getSnapshot()).toMatchObject({ phase: "revoked", client: null });
    expectBootstrapFailure(() => bootstrap.start());
  });

  it("aborts the source, tears down exactly once and makes disposal idempotent", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    bootstrap.dispose();
    bootstrap.dispose();
    expect(source.activeSignal()?.aborted).toBe(true);
    expect(source.teardownCount()).toBe(1);
    expect(bootstrap.boundary.getSnapshot().phase).toBe("revoked");
    expectBootstrapFailure(() => bootstrap.start());
  });

  it("invalidates the authenticated client on disposal", async () => {
    const source = sourceFixture();
    const http = mockTransport();
    const bootstrap = setup(source.source, http.fetchImpl);
    bootstrap.start();
    source.emit(authenticated());
    const retired = requireClient(bootstrap);
    bootstrap.dispose();
    expect(bootstrap.boundary.getSnapshot().client).toBeNull();
    await expectRequestError(getAssets(retired), "ABORTED");
    expect(http.calls).toHaveLength(0);
  });

  it("ignores late source callbacks after normal disposal", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    source.emit(authenticated());
    bootstrap.dispose();
    const snapshot = bootstrap.boundary.getSnapshot();
    source.emitLate(authenticated(SESSION_B));
    source.emitLate({ type: "authenticating" });
    expect(bootstrap.boundary.getSnapshot()).toBe(snapshot);
    expect(snapshot.client).toBeNull();
  });

  it("does not permit reentrant activation during revocation notification", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.start();
    source.emit(authenticated());
    let rejects = 0;
    bootstrap.boundary.subscribe(() => {
      try { bootstrap.boundary.activate(SESSION_B); }
      catch (error: unknown) {
        if (error instanceof ApiClientError && error.code === "INVALID_REQUEST") rejects++;
      }
    });
    bootstrap.dispose();
    expect(rejects).toBe(1);
    expect(bootstrap.boundary.getSnapshot().client).toBeNull();
    expect(bootstrap.boundary.getSnapshot().phase).toBe("revoked");
  });

  it("handles disposal from within a synchronous subscribe callback", () => {
    let bootstrap!: AuthBootstrap;
    let teardowns = 0;
    bootstrap = setup({
      subscribe(onEvent) {
        onEvent(authenticated());
        bootstrap.dispose();
        return () => { teardowns++; };
      },
    });
    bootstrap.start();
    expect(teardowns).toBe(1);
    expect(bootstrap.boundary.getSnapshot()).toMatchObject({ phase: "revoked", client: null });
    expectBootstrapFailure(() => bootstrap.start());
  });

  it("handles disposal from an authenticating-state subscriber before source subscription", () => {
    const source = sourceFixture();
    const bootstrap = setup(source.source);
    bootstrap.boundary.subscribe(() => bootstrap.dispose());
    bootstrap.start();
    expect(source.subscribeCount()).toBe(0);
    expect(bootstrap.boundary.getSnapshot()).toMatchObject({ phase: "revoked", client: null });
  });

  it("suppresses teardown exceptions during disposal", () => {
    const bootstrap = setup({ subscribe: () => () => { throw new Error("synthetic teardown failure"); } });
    bootstrap.start();
    bootstrap.dispose();
    expect(bootstrap.boundary.getSnapshot().phase).toBe("revoked");
  });

  it("revokes in-flight requests even when fetch ignores abort on disposal", async () => {
    const reply = deferred<Response>();
    const http = mockTransport(() => reply.promise);
    const source = sourceFixture();
    const bootstrap = setup(source.source, http.fetchImpl);
    bootstrap.start();
    source.emit(authenticated());
    const pending = getAssets(requireClient(bootstrap));
    await untilCalled(http.calls);
    bootstrap.dispose();
    await expectRequestError(pending, "ABORTED");
    expect(http.calls[0]?.init?.signal?.aborted).toBe(true);
    reply.resolve(jsonResponse());
  });
});
