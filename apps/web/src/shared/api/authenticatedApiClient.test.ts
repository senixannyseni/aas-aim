import { describe, expect, it } from "vitest";

import { ApiClientError, type ApiClient, type ApiErrorCode } from "./apiClient";
import {
  createAuthenticatedApiClient,
  type AccessTokenProvider,
  type AuthenticatedApiClientOptions,
} from "./authenticatedApiClient";

/**
 * File 47 — permanent bearer-authentication transport regression tests.
 *
 * All credentials are synthetic fixtures, all HTTP exchanges are mocked,
 * and no identity provider or Java backend is contacted. These tests prove
 * transport behavior, not user identity, tenant authorization, token
 * cryptographic validity, refresh flows, or post-logout UI invalidation.
 */
const TOKEN = "test-token-a_123";
const SECOND_TOKEN = "test-token-b_456";

type CapturedCall = Readonly<{
  input: RequestInfo | URL;
  init: RequestInit | undefined;
}>;

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

function fakeFetch(handler: typeof fetch): {
  fetchImpl: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ input, init });
    return handler(input, init);
  };
  return { fetchImpl, calls };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function authClient(
  fetchImpl: typeof fetch,
  getAccessToken: AccessTokenProvider = () => TOKEN,
  options: Readonly<{ timeoutMs?: number; apiBasePath?: string }> = {},
): ApiClient {
  return createAuthenticatedApiClient({
    apiBasePath: options.apiBasePath ?? "/api",
    getAccessToken,
    fetchImpl,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  });
}

function getUnknown(client: ApiClient, signal?: AbortSignal): Promise<unknown> {
  return client.request({
    pathSegments: ["v1", "assets"],
    decode: (input) => input,
    ...(signal !== undefined ? { signal } : {}),
  });
}

function authorization(call: CapturedCall | undefined): string | null {
  return new Headers(call?.init?.headers).get("authorization");
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
    expect(typed.name).toBe("ApiClientError");
    expect(typed.code).toBe(code);
    expect(typed.status).toBe(status);
    return typed;
  }
  throw new Error(`Expected ${code}, but the request succeeded`);
}

/** Wait for the provider's Promise.resolve().then(...) scheduling. */
async function providerTurn(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createAuthenticatedApiClient — construction and transport policy", () => {
  it("does not acquire a token or send HTTP when constructed", () => {
    let called = 0;
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const client = authClient(transport.fetchImpl, () => {
      called += 1;
      return TOKEN;
    });
    expect(Object.isFrozen(client)).toBe(true);
    expect(called).toBe(0);
    expect(transport.calls).toHaveLength(0);
  });

  for (const invalidProvider of [undefined, null, "constant", {}, 42]) {
    it(`rejects non-callable credential providers (${String(invalidProvider)})`, () => {
      const transport = fakeFetch(async () => jsonResponse({}));
      expect(() => createAuthenticatedApiClient({
        apiBasePath: "/api",
        fetchImpl: transport.fetchImpl,
        getAccessToken: invalidProvider,
      } as unknown as AuthenticatedApiClientOptions)).toThrow(ApiClientError);
      expect(transport.calls).toHaveLength(0);
    });
  }

  for (const base of ["", "/", "https://other.example/api", "//host/api", "/api/../admin", "/api/"]) {
    it(`rejects invalid API base ${JSON.stringify(base)}`, () => {
      const transport = fakeFetch(async () => jsonResponse({}));
      let tokens = 0;
      expect(() => createAuthenticatedApiClient({
        apiBasePath: base,
        fetchImpl: transport.fetchImpl,
        getAccessToken: () => { tokens += 1; return TOKEN; },
      })).toThrow(ApiClientError);
      expect(tokens).toBe(0);
      expect(transport.calls).toHaveLength(0);
    });
  }

  for (const timeoutMs of [0, -1, 120_001, 1.5, NaN, Infinity]) {
    it(`rejects invalid request timeout ${String(timeoutMs)}`, () => {
      const transport = fakeFetch(async () => jsonResponse({}));
      expect(() => authClient(transport.fetchImpl, () => TOKEN, { timeoutMs })).toThrow(ApiClientError);
      expect(transport.calls).toHaveLength(0);
    });
  }

  it("sends only same-origin, no-cookie, no-redirect, no-referrer, no-cache bearer requests", async () => {
    const transport = fakeFetch(async () => jsonResponse({ assets: [] }));
    expect(await getUnknown(authClient(transport.fetchImpl))).toEqual({ assets: [] });
    expect(transport.calls).toHaveLength(1);
    const call = transport.calls[0];
    expect(call?.input).toBe("/api/v1/assets");
    expect(call?.init?.method).toBe("GET");
    expect(call?.init?.mode).toBe("same-origin");
    expect(call?.init?.credentials).toBe("omit");
    expect(call?.init?.redirect).toBe("error");
    expect(call?.init?.cache).toBe("no-store");
    expect(call?.init?.referrerPolicy).toBe("no-referrer");
    expect(call?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(authorization(call)).toBe(`Bearer ${TOKEN}`);
    expect(new Headers(call?.init?.headers).get("accept")).toBe("application/json");
    expect(new Headers(call?.init?.headers).get("cookie")).toBeNull();
    expect(new Headers(call?.init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(call?.init?.body).toBeUndefined();
  });

  it("supports a nested same-origin base path without adding a foreign URL", async () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    await getUnknown(authClient(transport.fetchImpl, () => TOKEN, { apiBasePath: "/api/v2" }));
    expect(transport.calls[0]?.input).toBe("/api/v2/v1/assets");
  });

  it("safely encodes query strings without putting credentials in the URL", async () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    await authClient(transport.fetchImpl).request({
      pathSegments: ["v1", "assets"],
      query: { search: "Unit A & B", page: 2, archived: false },
      decode: (input) => input,
    });
    const url = String(transport.calls[0]?.input);
    expect(url).toBe("/api/v1/assets?search=Unit+A+%26+B&page=2&archived=false");
    expect(url).not.toContain(TOKEN);
  });

  for (const method of ["POST", "PUT", "PATCH"] as const) {
    it(`preserves JSON request serialization and bearer header for ${method}`, async () => {
      const transport = fakeFetch(async () => jsonResponse({ saved: true }));
      await authClient(transport.fetchImpl).request({
        method,
        pathSegments: ["v1", "assets"],
        json: { tag: "V-101", priority: 2 },
        decode: (input) => input,
      });
      expect(transport.calls[0]?.init?.method).toBe(method);
      expect(transport.calls[0]?.init?.body).toBe('{"tag":"V-101","priority":2}');
      expect(new Headers(transport.calls[0]?.init?.headers).get("content-type")).toBe("application/json");
      expect(authorization(transport.calls[0])).toBe(`Bearer ${TOKEN}`);
      expect(String(transport.calls[0]?.init?.body)).not.toContain(TOKEN);
    });
  }

  it("supports DELETE with bearer authorization and no body", async () => {
    const transport = fakeFetch(async () => jsonResponse({ deleted: true }));
    await authClient(transport.fetchImpl).request({
      method: "DELETE", pathSegments: ["v1", "assets", "A-1"], decode: (input) => input,
    });
    expect(transport.calls[0]?.init?.method).toBe("DELETE");
    expect(transport.calls[0]?.init?.body).toBeUndefined();
    expect(authorization(transport.calls[0])).toBe(`Bearer ${TOKEN}`);
  });
});

describe("createAuthenticatedApiClient — token acquisition and isolation", () => {
  it("gets a fresh token on every request instead of caching it", async () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const returned = [TOKEN, SECOND_TOKEN];
    let calls = 0;
    const client = authClient(transport.fetchImpl, () => returned[calls++]);
    await getUnknown(client);
    await getUnknown(client);
    expect(calls).toBe(2);
    expect(authorization(transport.calls[0])).toBe(`Bearer ${TOKEN}`);
    expect(authorization(transport.calls[1])).toBe(`Bearer ${SECOND_TOKEN}`);
  });

  it("passes a live AbortSignal to asynchronous token providers", async () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    let provided: AbortSignal | undefined;
    const client = authClient(transport.fetchImpl, async (signal) => {
      provided = signal;
      await Promise.resolve();
      return TOKEN;
    });
    await getUnknown(client);
    expect(provided).toBeInstanceOf(AbortSignal);
    expect(provided?.aborted).toBe(false);
    expect(transport.calls).toHaveLength(1);
  });

  for (const token of ["opaque", "header.payload.signature", "a_b-c.d~e/f+g==", "a", "X".repeat(8_192)]) {
    it(`accepts opaque bearer grammar (length ${token.length})`, async () => {
      const transport = fakeFetch(async () => jsonResponse({ ok: true }));
      expect(await getUnknown(authClient(transport.fetchImpl, () => token))).toEqual({ ok: true });
      expect(authorization(transport.calls[0])).toBe(`Bearer ${token}`);
    });
  }

  for (const token of [
    null, undefined, "", "Bearer abc", "abc def", "abc\nInjected: yes", "abc\rdef", "abc\tdef",
    "abc=def", "abc!def", "abc: def", "âbc", "🔑", "X".repeat(8_193), 7, false, {}, [],
  ]) {
    it(`rejects malformed/missing access-token fixture (${typeof token}, length ${String(token).length})`, async () => {
      const transport = fakeFetch(async () => jsonResponse({ ok: true }));
      const error = await expectApiError(getUnknown(authClient(
        transport.fetchImpl,
        () => token as string | null | undefined,
      )), "INVALID_REQUEST");
      expect(error.message).toBe("An authenticated access token is required.");
      expect(transport.calls).toHaveLength(0);
    });
  }

  for (const rejection of [new Error("secret-token-provider-error"), "secret-token-provider-error", 123]) {
    it("redacts asynchronous token-provider rejections", async () => {
      const transport = fakeFetch(async () => jsonResponse({ ok: true }));
      const error = await expectApiError(getUnknown(authClient(transport.fetchImpl, async () => {
        throw rejection;
      })), "INVALID_REQUEST");
      expect(error.message).toBe("Authentication credentials could not be obtained.");
      expect(error.message).not.toContain("secret-token-provider-error");
      expect(transport.calls).toHaveLength(0);
    });
  }

  it("redacts synchronous token-provider exceptions", async () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const error = await expectApiError(getUnknown(authClient(transport.fetchImpl, () => {
      throw new Error("SYNTHETIC_SECRET_IN_EXCEPTION");
    })), "INVALID_REQUEST");
    expect(error.message).not.toContain("SYNTHETIC_SECRET_IN_EXCEPTION");
    expect(transport.calls).toHaveLength(0);
  });

  it("isolates credentials across concurrent requests completing out of order", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    let providerCalls = 0;
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const client = authClient(transport.fetchImpl, () => {
      providerCalls += 1;
      return providerCalls === 1 ? first.promise : second.promise;
    });
    const a = getUnknown(client);
    const b = getUnknown(client);
    await providerTurn();
    expect(providerCalls).toBe(2);
    second.resolve(SECOND_TOKEN);
    await b;
    first.resolve(TOKEN);
    await a;
    expect(authorization(transport.calls[0])).toBe(`Bearer ${SECOND_TOKEN}`);
    expect(authorization(transport.calls[1])).toBe(`Bearer ${TOKEN}`);
  });

  it("separates sessions by constructing a new API client with a new provider", async () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const firstSession = authClient(transport.fetchImpl, () => TOKEN);
    const secondSession = authClient(transport.fetchImpl, () => SECOND_TOKEN);
    expect(firstSession).not.toBe(secondSession);
    await getUnknown(firstSession);
    await getUnknown(secondSession);
    expect(authorization(transport.calls[0])).toBe(`Bearer ${TOKEN}`);
    expect(authorization(transport.calls[1])).toBe(`Bearer ${SECOND_TOKEN}`);
    // UI invalidation on session changes is the controller's responsibility.
  });
});

describe("createAuthenticatedApiClient — reject invalid operations before acquiring credentials", () => {
  for (const pathSegments of [[], [".."], ["v1", "../assets"], ["http://host"], ["assets?tenant=x"], ["a/b"], ["%2f"], [""]]) {
    it(`rejects unsafe path ${JSON.stringify(pathSegments)} without calling the provider`, async () => {
      let tokens = 0;
      const transport = fakeFetch(async () => jsonResponse({}));
      const client = authClient(transport.fetchImpl, () => { tokens += 1; return TOKEN; });
      await expectApiError(client.request({ pathSegments, decode: (input) => input }), "INVALID_REQUEST");
      expect(tokens).toBe(0);
      expect(transport.calls).toHaveLength(0);
    });
  }

  for (const badQueryValue of [NaN, Infinity, null, {}, []]) {
    it(`rejects unsafe query value ${String(badQueryValue)} before token lookup`, async () => {
      let tokens = 0;
      const transport = fakeFetch(async () => jsonResponse({}));
      const client = authClient(transport.fetchImpl, () => { tokens += 1; return TOKEN; });
      const query = { page: badQueryValue } as unknown as Readonly<Record<string, string | number | boolean>>;
      await expectApiError(client.request({ pathSegments: ["assets"], query, decode: (input) => input }), "INVALID_REQUEST");
      expect(tokens).toBe(0);
      expect(transport.calls).toHaveLength(0);
    });
  }

  for (const badJsonValue of [NaN, Infinity, undefined, 1n, () => 3, Symbol("bad")]) {
    it(`rejects unsafe JSON (${typeof badJsonValue}) before token lookup`, async () => {
      let tokens = 0;
      const transport = fakeFetch(async () => jsonResponse({}));
      const client = authClient(transport.fetchImpl, () => { tokens += 1; return TOKEN; });
      await expectApiError(client.request({
        method: "POST", pathSegments: ["assets"], json: { bad: badJsonValue }, decode: (input) => input,
      }), "INVALID_REQUEST");
      expect(tokens).toBe(0);
      expect(transport.calls).toHaveLength(0);
    });
  }

  it("does not request credentials when the caller has already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let tokens = 0;
    const transport = fakeFetch(async () => jsonResponse({}));
    const client = authClient(transport.fetchImpl, () => { tokens += 1; return TOKEN; });
    await expectApiError(getUnknown(client, controller.signal), "ABORTED");
    expect(tokens).toBe(0);
    expect(transport.calls).toHaveLength(0);
  });

  it("does not request credentials if the required response decoder is missing", async () => {
    let tokens = 0;
    const transport = fakeFetch(async () => jsonResponse({}));
    const client = authClient(transport.fetchImpl, () => { tokens += 1; return TOKEN; });
    await expectApiError(client.request({ pathSegments: ["assets"] } as never), "INVALID_REQUEST");
    expect(tokens).toBe(0);
    expect(transport.calls).toHaveLength(0);
  });

  it("rejects GET bodies before requesting credentials", async () => {
    let tokens = 0;
    const transport = fakeFetch(async () => jsonResponse({}));
    const client = authClient(transport.fetchImpl, () => { tokens += 1; return TOKEN; });
    await expectApiError(client.request({ method: "GET", json: {}, pathSegments: ["assets"], decode: (input: unknown) => input } as never), "INVALID_REQUEST");
    expect(tokens).toBe(0);
    expect(transport.calls).toHaveLength(0);
  });
});

describe("createAuthenticatedApiClient — cancellation, timeout and HTTP failures", () => {
  it("aborts token lookup even if the provider never resolves or observes the signal", async () => {
    const waiting = deferred<string>();
    const controller = new AbortController();
    let providerSignal: AbortSignal | undefined;
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const client = authClient(transport.fetchImpl, (signal) => {
      providerSignal = signal;
      return waiting.promise;
    }, { timeoutMs: 1_000 });
    const operation = getUnknown(client, controller.signal);
    await providerTurn();
    expect(providerSignal).toBeInstanceOf(AbortSignal);
    controller.abort();
    await expectApiError(operation, "ABORTED");
    expect(providerSignal?.aborted).toBe(true);
    expect(transport.calls).toHaveLength(0);
  });

  it("does not transmit a token if the provider resolves after caller cancellation", async () => {
    const waiting = deferred<string>();
    const controller = new AbortController();
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const client = authClient(transport.fetchImpl, () => waiting.promise, { timeoutMs: 1_000 });
    const operation = getUnknown(client, controller.signal);
    await providerTurn();
    controller.abort();
    waiting.resolve(TOKEN);
    await expectApiError(operation, "ABORTED");
    await providerTurn();
    expect(transport.calls).toHaveLength(0);
  });

  it("includes token lookup in the end-to-end timeout deadline", async () => {
    const waiting = deferred<string>();
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const client = authClient(transport.fetchImpl, () => waiting.promise, { timeoutMs: 15 });
    await expectApiError(getUnknown(client), "TIMEOUT");
    expect(transport.calls).toHaveLength(0);
  });

  it("does not transmit when the provider throws after being cancelled", async () => {
    const waiting = deferred<string>();
    const controller = new AbortController();
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const client = authClient(transport.fetchImpl, () => waiting.promise, { timeoutMs: 1_000 });
    const operation = getUnknown(client, controller.signal);
    await providerTurn();
    controller.abort();
    waiting.reject(new Error("test-credential-secret"));
    await expectApiError(operation, "ABORTED");
    expect(transport.calls).toHaveLength(0);
  });

  for (const status of [401, 403, 429, 500, 503]) {
    it(`preserves server HTTP ${status} while sanitizing its response body`, async () => {
      const transport = fakeFetch(async () => new Response("PRIVATE_BACKEND_DETAILS", { status }));
      const error = await expectApiError(getUnknown(authClient(transport.fetchImpl)), "HTTP_ERROR", status);
      expect(error.message).toContain(String(status));
      expect(error.message).not.toContain("PRIVATE_BACKEND_DETAILS");
      expect(authorization(transport.calls[0])).toBe(`Bearer ${TOKEN}`);
    });
  }

  it("still rejects invalid JSON bodies", async () => {
    const transport = fakeFetch(async () => new Response("not-json", {
      headers: { "content-type": "application/json" },
    }));
    await expectApiError(getUnknown(authClient(transport.fetchImpl)), "INVALID_JSON");
  });

  it("still rejects decoder failures and sanitizes their messages", async () => {
    const transport = fakeFetch(async () => jsonResponse({ token: "test-secret-from-server" }));
    const error = await expectApiError(authClient(transport.fetchImpl).request({
      pathSegments: ["v1", "assets"],
      decode: () => { throw new Error("test-secret-from-server"); },
    }), "INVALID_RESPONSE");
    expect(error.message).not.toContain("test-secret-from-server");
  });

  it("still classifies network errors without exposing transport exceptions", async () => {
    const transport = fakeFetch(async () => { throw new Error("PRIVATE_TRANSPORT_SECRET"); });
    const error = await expectApiError(getUnknown(authClient(transport.fetchImpl)), "NETWORK_ERROR");
    expect(error.message).not.toContain("PRIVATE_TRANSPORT_SECRET");
  });
});

// Compile-time contract checks: never executed, but checked by TypeScript.
if (false) {
  const client = authClient(async () => jsonResponse({}));
  // @ts-expect-error Bearer transport preserves the rule forbidding GET bodies.
  void client.request({ method: "GET", pathSegments: ["assets"], json: {}, decode: (input: unknown) => input });
  // @ts-expect-error Bearer transport preserves the rule requiring POST JSON bodies.
  void client.request({ method: "POST", pathSegments: ["assets"], decode: (input: unknown) => input });
}
