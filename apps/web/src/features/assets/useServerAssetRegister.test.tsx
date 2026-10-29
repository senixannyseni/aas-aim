// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createApiClient, type ApiClient, type JsonApiRequest, type QueryScalar } from "../../shared/api/apiClient";
import { ServerAssetRegister, type ServerAssetRegisterQuery } from "./ServerAssetRegister";
import {
  DEFAULT_SERVER_ASSET_QUERY,
  toAssetQueryParameters,
  useServerAssetRegister,
  validateServerAssetQuery,
} from "./useServerAssetRegister";

/**
 * File 45 — permanent request-controller regression tests.
 *
 * Every asset, provenance reference and HTTP response is a synthetic fixture.
 * The controlled client intentionally ignores AbortSignal on some requests so
 * the hook's epoch guard is tested independently of transport cooperation.
 * These tests do not authenticate, authorize, verify classification provenance,
 * or assert the existence of a Java service or production API endpoint.
 */
afterEach(cleanup);

const BASE: ServerAssetRegisterQuery = DEFAULT_SERVER_ASSET_QUERY;
const ASSESSED_AT = "2026-10-20T09:00:00+07:00";
const EVALUATED_AT = "2026-10-20T08:00:00Z";

function query(changes: Partial<ServerAssetRegisterQuery> = {}): ServerAssetRegisterQuery {
  return { ...BASE, ...changes };
}

function asset(index = 1, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const key = String(index).padStart(3, "0");
  return {
    id: `AST-${key}`,
    tag: `V-${key}`,
    name: `Synthetic asset ${key}`,
    assetType: "Pressure vessel",
    location: "Synthetic Unit A",
    riskClassification: {
      level: "CRITICAL",
      basisRecordId: `RISK-TEST-${key}`,
      assessedAt: ASSESSED_AT,
    },
    evidenceAssessment: {
      state: "VALID",
      basisRecordId: `EVIDENCE-TEST-${key}`,
      evaluatedAt: EVALUATED_AT,
    },
    ...overrides,
  };
}

/** A response shaped like the draft OpenAPI wire contract, not an adapted page. */
function wirePage(
  items: unknown[] = [asset()],
  changes: Partial<{ page: number; pageSize: 10 | 25 | 50; totalItems: number }> = {},
): Record<string, unknown> {
  const page = changes.page ?? 1;
  const pageSize = changes.pageSize ?? 10;
  const totalItems = changes.totalItems ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    items,
    pageInfo: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
    },
  };
}

type PendingCall = Readonly<{
  method: string | undefined;
  pathSegments: readonly string[];
  query: Readonly<Record<string, QueryScalar>> | undefined;
  signal: AbortSignal | undefined;
  /** Decodes a raw response exactly as a conforming ApiClient would. */
  resolve: (raw: unknown) => void;
  reject: (error: unknown) => void;
}>;

/** Each call remains pending until its test resolves/rejects it. */
function controlledClient(): { client: ApiClient; calls: PendingCall[] } {
  const calls: PendingCall[] = [];
  const client: ApiClient = {
    request<T>(options: JsonApiRequest<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        calls.push({
          method: options.method,
          pathSegments: options.pathSegments,
          query: options.query,
          signal: options.signal,
          resolve(raw: unknown): void {
            try {
              resolve(options.decode(raw));
            } catch (error: unknown) {
              reject(error);
            }
          },
          reject,
        });
      });
    },
  };
  return { client, calls };
}

function callAt(calls: readonly PendingCall[], index: number): PendingCall {
  const call = calls[index];
  if (call === undefined) throw new Error(`Expected test request ${index}`);
  return call;
}

async function succeed(call: PendingCall, payload: unknown = wirePage()): Promise<void> {
  await act(async () => { call.resolve(payload); });
}

async function fail(call: PendingCall, error: unknown = new Error("Private server diagnostic")): Promise<void> {
  await act(async () => { call.reject(error); });
}

function expectLoading(kind: string): void {
  expect(kind).toBe("loading");
}

describe("server asset query contract — validation and serialization", () => {
  it("starts at the first page with no server filters", () => {
    expect(BASE).toEqual({ page: 1, pageSize: 10, search: "", risk: "ALL", evidence: "ALL" });
    expect(Object.isFrozen(BASE)).toBe(true);
  });

  it("canonicalizes surrounding search whitespace without mutating the input", () => {
    const input = query({ search: "  vessel  " });
    const validated = validateServerAssetQuery(input);
    expect(validated.search).toBe("vessel");
    expect(input.search).toBe("  vessel  ");
    expect(Object.isFrozen(validated)).toBe(true);
  });

  it("permits exactly the contract page sizes", () => {
    for (const pageSize of [10, 25, 50] as const) {
      expect(validateServerAssetQuery(query({ pageSize })).pageSize).toBe(pageSize);
    }
  });

  it("permits all risk and evidence filter sentinels, preserving UNKNOWN and NOT_PROVIDED", () => {
    for (const risk of ["ALL", "LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN", "NOT_PROVIDED"] as const) {
      expect(validateServerAssetQuery(query({ risk })).risk).toBe(risk);
    }
    for (const evidence of ["ALL", "VALID", "STALE", "INVALID", "UNAVAILABLE", "MISSING", "UNKNOWN", "NOT_PROVIDED"] as const) {
      expect(validateServerAssetQuery(query({ evidence })).evidence).toBe(evidence);
    }
  });

  const invalidPages = [0, -1, 1.3, Number.NaN, Infinity, 2_147_483_648, Number.MAX_SAFE_INTEGER];
  for (const page of invalidPages) {
    it(`rejects invalid page ${String(page)}`, () => {
      expect(() => validateServerAssetQuery(query({ page }))).toThrow("Invalid server asset register query.");
    });
  }

  for (const pageSize of [0, 1, 11, 100, -10] as const) {
    it(`rejects invalid page size ${pageSize}`, () => {
      const candidate = { ...BASE, pageSize } as unknown as ServerAssetRegisterQuery;
      expect(() => validateServerAssetQuery(candidate)).toThrow("Invalid server asset register query.");
    });
  }

  const invalidFilters = [
    ["risk", "GOOD"],
    ["risk", "critical"],
    ["risk", null],
    ["evidence", "APPROVED"],
    ["evidence", "valid"],
    ["evidence", null],
  ] as const;
  for (const [field, value] of invalidFilters) {
    it(`rejects unsupported ${field} value ${String(value)}`, () => {
      const candidate = { ...BASE, [field]: value } as unknown as ServerAssetRegisterQuery;
      expect(() => validateServerAssetQuery(candidate)).toThrow("Invalid server asset register query.");
    });
  }

  for (const search of ["a".repeat(201), "a\nb", "a\tb", "a\u0000b", "a\u007fb"]) {
    it(`rejects an invalid search string (${search.length} characters)`, () => {
      expect(() => validateServerAssetQuery(query({ search }))).toThrow("Invalid server asset register query.");
    });
  }

  it("accepts a 200-character search string", () => {
    expect(validateServerAssetQuery(query({ search: "a".repeat(200) })).search).toHaveLength(200);
  });

  it("rejects a null or array masquerading as a typed query", () => {
    for (const candidate of [null, [], "vessel"]) {
      expect(() => validateServerAssetQuery(candidate as unknown as ServerAssetRegisterQuery)).toThrow();
    }
  });

  it("serializes default query with page and pageSize only", () => {
    expect(toAssetQueryParameters(BASE)).toEqual({ page: 1, pageSize: 10 });
  });

  it("serializes all requested nondefault filters exactly", () => {
    expect(toAssetQueryParameters(query({
      page: 3, pageSize: 25, search: "  Unit A  ", risk: "CRITICAL", evidence: "STALE",
    }))).toEqual({ page: 3, pageSize: 25, search: "Unit A", risk: "CRITICAL", evidence: "STALE" });
  });

  it("serializes unknown classifications independently of missing classifications", () => {
    expect(toAssetQueryParameters(query({ risk: "UNKNOWN", evidence: "NOT_PROVIDED" }))).toEqual({
      page: 1, pageSize: 10, risk: "UNKNOWN", evidence: "NOT_PROVIDED",
    });
  });

  it("omits blank whitespace-only search terms from the wire request", () => {
    expect(toAssetQueryParameters(query({ search: "   " }))).toEqual({ page: 1, pageSize: 10 });
  });
});

describe("useServerAssetRegister — disconnected state and initial request", () => {
  it("stays idle and never attempts a request without a client", () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: null }));
    expect(hook.result.current.state.kind).toBe("idle");
    expect(hook.result.current.query).toEqual(BASE);
    expect(transport.calls).toHaveLength(0);
  });

  it("ignores retry while disconnected", () => {
    const hook = renderHook(() => useServerAssetRegister({ client: null }));
    act(() => { hook.result.current.retry(); });
    expect(hook.result.current.state.kind).toBe("idle");
  });

  it("starts one GET for the first page without authoring records", () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    expectLoading(hook.result.current.state.kind);
    expect(transport.calls).toHaveLength(1);
    const call = callAt(transport.calls, 0);
    expect(call.method).toBe("GET");
    expect(call.pathSegments).toEqual(["v1", "assets"]);
    expect(call.query).toEqual({ page: 1, pageSize: 10 });
    expect(call.signal?.aborted).toBe(false);
  });

  it("uses and canonicalizes an initial custom query", () => {
    const transport = controlledClient();
    const initialQuery = query({ page: 2, pageSize: 25, search: "  Unit B ", risk: "HIGH" });
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client, initialQuery }));
    expect(hook.result.current.query.search).toBe("Unit B");
    expect(callAt(transport.calls, 0).query).toEqual({ page: 2, pageSize: 25, search: "Unit B", risk: "HIGH" });
  });

  it("does not reset the current query when initialQuery prop is replaced", () => {
    const transport = controlledClient();
    const hook = renderHook(
      ({ initialQuery }: { initialQuery: ServerAssetRegisterQuery }) =>
        useServerAssetRegister({ client: transport.client, initialQuery }),
      { initialProps: { initialQuery: BASE } },
    );
    hook.rerender({ initialQuery: query({ risk: "HIGH" }) });
    expect(hook.result.current.query).toEqual(BASE);
    expect(transport.calls).toHaveLength(1);
  });

  it("does not refetch when the parent rerenders with the same client", () => {
    const transport = controlledClient();
    const hook = renderHook(({ client }: { client: ApiClient | null }) => useServerAssetRegister({ client }), {
      initialProps: { client: transport.client },
    });
    hook.rerender({ client: transport.client });
    expect(transport.calls).toHaveLength(1);
  });

  it("does not fetch again for a semantically identical query", () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    act(() => { hook.result.current.onQueryChange({ ...BASE }); });
    expect(transport.calls).toHaveLength(1);
    expect(callAt(transport.calls, 0).signal?.aborted).toBe(false);
  });
});

describe("useServerAssetRegister — response decoding and errors", () => {
  it("rejects a partial first page when metadata claims more records than returned", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0), wirePage([asset()], { totalItems: 11 }));
    const state = hook.result.current.state;
    expect(state.kind).toBe("error"); // A partial page must never masquerade as complete.
  });

  it("renders an accurate server total from a complete first page", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    const items = Array.from({ length: 10 }, (_, i) => asset(i + 1));
    await succeed(callAt(transport.calls, 0), wirePage(items, { totalItems: 11 }));
    const state = hook.result.current.state;
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("Expected ready state");
    expect(state.page.pageInfo.totalItems).toBe(11);
    expect(state.page.pageInfo.totalPages).toBe(2);
    expect(state.page.items).toHaveLength(10);
    expect(state.page.items[0]?.riskBasis?.basisRecordId).toBe("RISK-TEST-001");
    expect(state.page.items[0]?.evidenceBasis?.basisRecordId).toBe("EVIDENCE-TEST-001");
    expect(state.forQuery).toEqual(BASE);
  });

  it("accepts an authorized empty result without making up assets", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0), wirePage([]));
    const state = hook.result.current.state;
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("Expected empty ready state");
    expect(state.page.items).toEqual([]);
    expect(state.page.pageInfo.totalItems).toBe(0);
  });

  it("keeps missing classifications distinct from explicit UNKNOWN", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0), wirePage([
      asset(1, { riskClassification: null, evidenceAssessment: null }),
      asset(2, {
        riskClassification: { level: "UNKNOWN", basisRecordId: "RISK-UNKNOWN-002", assessedAt: ASSESSED_AT },
        evidenceAssessment: { state: "UNKNOWN", basisRecordId: "EV-UNKNOWN-002", evaluatedAt: EVALUATED_AT },
      }),
    ]));
    const state = hook.result.current.state;
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("Expected ready state");
    expect(state.page.items[0]?.record.riskStatus).toBeNull();
    expect(state.page.items[0]?.riskBasis).toBeNull();
    expect(state.page.items[1]?.record.riskStatus).toBe("UNKNOWN");
    expect(state.page.items[1]?.record.evidenceStatus).toBe("UNKNOWN");
    expect(state.page.items[1]?.riskBasis?.basisRecordId).toBe("RISK-UNKNOWN-002");
  });

  it("rejects a page with malformed risk provenance atomically", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0), wirePage([
      asset(1), asset(2, { riskClassification: { level: "CRITICAL" } }),
    ]));
    expect(hook.result.current.state.kind).toBe("error");
    expect("page" in hook.result.current.state).toBe(false);
  });

  it("rejects a valid-but-wrong page number", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0), wirePage([asset(11)], { page: 2, totalItems: 11 }));
    expect(hook.result.current.state.kind).toBe("error");
  });

  it("rejects a valid-but-wrong page size", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0), wirePage([asset()], { pageSize: 25 }));
    expect(hook.result.current.state.kind).toBe("error");
  });

  it("rejects invalid pagination totals rather than showing partial records", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    const invalid = wirePage([asset()]);
    const pageInfo = invalid["pageInfo"] as Record<string, unknown>;
    await succeed(callAt(transport.calls, 0), { ...invalid, pageInfo: { ...pageInfo, totalPages: 10 } });
    expect(hook.result.current.state.kind).toBe("error");
  });

  it("rejects duplicate IDs within one API page", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0), wirePage([asset(), asset()]));
    expect(hook.result.current.state.kind).toBe("error");
  });

  it("shows a generic error without exposing backend exception text", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await fail(callAt(transport.calls, 0), new Error("TENANT-SECRET-123"));
    const state = hook.result.current.state;
    expect(state.kind).toBe("error");
    expect(JSON.stringify(state)).not.toContain("TENANT-SECRET-123");
    if (state.kind !== "error") throw new Error("Expected error state");
    expect(state.forQuery).toEqual(BASE);
    expect(typeof state.onRetry).toBe("function");
  });

  it("converts decoder failures to generic errors", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0), { unexpected: "private payload" });
    expect(hook.result.current.state.kind).toBe("error");
    expect(JSON.stringify(hook.result.current.state)).not.toContain("private payload");
  });

  it("recovers from error on retry without altering filters", async () => {
    const transport = controlledClient();
    const initialQuery = query({ search: "vessel", risk: "HIGH" });
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client, initialQuery }));
    await fail(callAt(transport.calls, 0));
    act(() => { hook.result.current.retry(); });
    expect(transport.calls).toHaveLength(2);
    expect(callAt(transport.calls, 1).query).toEqual({ page: 1, pageSize: 10, search: "vessel", risk: "HIGH" });
    expect(hook.result.current.state.kind).toBe("loading");
    await succeed(callAt(transport.calls, 1));
    expect(hook.result.current.state.kind).toBe("ready");
    expect(hook.result.current.query).toEqual(initialQuery);
  });

  it("retry refreshes a ready page but does not keep stale data visible", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0));
    expect(hook.result.current.state.kind).toBe("ready");
    act(() => { hook.result.current.retry(); });
    expect(hook.result.current.state.kind).toBe("loading");
    expect(transport.calls).toHaveLength(2);
  });
});

describe("useServerAssetRegister — query updates and request races", () => {
  it("aborts the previous request when filters change", () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    const old = callAt(transport.calls, 0);
    act(() => { hook.result.current.onQueryChange(query({ risk: "CRITICAL" })); });
    expect(old.signal?.aborted).toBe(true);
    expect(transport.calls).toHaveLength(2);
    expect(callAt(transport.calls, 1).query).toEqual({ page: 1, pageSize: 10, risk: "CRITICAL" });
    expectLoading(hook.result.current.state.kind);
  });

  it("never accepts a late successful response after changing filters", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    const original = callAt(transport.calls, 0);
    act(() => { hook.result.current.onQueryChange(query({ evidence: "MISSING" })); });
    await succeed(original, wirePage([asset(1)]));
    expect(hook.result.current.state.kind).toBe("loading");
    await succeed(callAt(transport.calls, 1), wirePage([asset(2)]));
    const state = hook.result.current.state;
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("Expected latest page");
    expect(state.page.items[0]?.record.id).toBe("AST-002");
    expect(state.forQuery.evidence).toBe("MISSING");
  });

  it("never accepts a late failure after a newer successful query", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    const old = callAt(transport.calls, 0);
    act(() => { hook.result.current.onQueryChange(query({ risk: "LOW" })); });
    await succeed(callAt(transport.calls, 1));
    await fail(old, new Error("Old private network failure"));
    expect(hook.result.current.state.kind).toBe("ready");
  });

  it("protects an A → B → A race even though the final query matches the first", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    const firstA = callAt(transport.calls, 0);
    act(() => { hook.result.current.onQueryChange(query({ risk: "HIGH" })); });
    const middleB = callAt(transport.calls, 1);
    act(() => { hook.result.current.onQueryChange(BASE); });
    const latestA = callAt(transport.calls, 2);
    expect(firstA.signal?.aborted).toBe(true);
    expect(middleB.signal?.aborted).toBe(true);
    await succeed(firstA, wirePage([asset(1)]));
    await succeed(middleB, wirePage([asset(2)]));
    expect(hook.result.current.state.kind).toBe("loading");
    await succeed(latestA, wirePage([asset(3)]));
    const state = hook.result.current.state;
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("Expected latest A response");
    expect(state.page.items[0]?.record.id).toBe("AST-003");
  });

  it("does not refetch for a query that differs only in whitespace", () => {
    const transport = controlledClient();
    const initialQuery = query({ search: "vessel" });
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client, initialQuery }));
    act(() => { hook.result.current.onQueryChange(query({ search: "  vessel  " })); });
    expect(transport.calls).toHaveLength(1);
    expect(callAt(transport.calls, 0).signal?.aborted).toBe(false);
  });

  it("retains page number as supplied by the controlled query", () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    act(() => { hook.result.current.onQueryChange(query({ page: 2, pageSize: 25 })); });
    expect(hook.result.current.query.page).toBe(2);
    expect(hook.result.current.query.pageSize).toBe(25);
    expect(callAt(transport.calls, 1).query).toEqual({ page: 2, pageSize: 25 });
  });

  it("keeps unrelated filters when changing the requested page", () => {
    const transport = controlledClient();
    const initial = query({ search: "test", risk: "CRITICAL", evidence: "STALE" });
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client, initialQuery: initial }));
    act(() => { hook.result.current.onQueryChange({ ...hook.result.current.query, page: 2 }); });
    expect(callAt(transport.calls, 1).query).toEqual({
      page: 2, pageSize: 10, search: "test", risk: "CRITICAL", evidence: "STALE",
    });
  });

  it("does not expose previous page records during new-page loading", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await succeed(callAt(transport.calls, 0));
    act(() => { hook.result.current.onQueryChange(query({ page: 2 })); });
    expect(hook.result.current.state.kind).toBe("loading");
    expect("page" in hook.result.current.state).toBe(false);
  });

  it("aborts pending work when the hook unmounts", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    const inFlight = callAt(transport.calls, 0);
    hook.unmount();
    expect(inFlight.signal?.aborted).toBe(true);
    // Misbehaving clients may still resolve after cancellation; this must not throw.
    await succeed(inFlight);
  });

  it("does not allow an obsolete retry response to restore an older result", async () => {
    const transport = controlledClient();
    const hook = renderHook(() => useServerAssetRegister({ client: transport.client }));
    await fail(callAt(transport.calls, 0));
    act(() => { hook.result.current.retry(); });
    const retryCall = callAt(transport.calls, 1);
    act(() => { hook.result.current.onQueryChange(query({ search: "new" })); });
    expect(retryCall.signal?.aborted).toBe(true);
    await succeed(retryCall);
    expect(hook.result.current.state.kind).toBe("loading");
    await succeed(callAt(transport.calls, 2));
    expect(hook.result.current.state.kind).toBe("ready");
  });
});

describe("useServerAssetRegister — client/session isolation", () => {
  it("does not display old authorized records when switching to a different client", async () => {
    const oldTransport = controlledClient();
    const newTransport = controlledClient();
    const hook = renderHook(({ client }: { client: ApiClient | null }) => useServerAssetRegister({ client }), {
      initialProps: { client: oldTransport.client },
    });
    await succeed(callAt(oldTransport.calls, 0), wirePage([asset(1)]));
    expect(hook.result.current.state.kind).toBe("ready");
    hook.rerender({ client: newTransport.client });
    expect(hook.result.current.state.kind).toBe("loading");
    expect(newTransport.calls).toHaveLength(1);
    await succeed(callAt(newTransport.calls, 0), wirePage([asset(2)]));
    const state = hook.result.current.state;
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("Expected new client response");
    expect(state.page.items[0]?.record.id).toBe("AST-002");
  });

  it("aborts a pending request when the client changes", () => {
    const first = controlledClient();
    const next = controlledClient();
    const hook = renderHook(({ client }: { client: ApiClient | null }) => useServerAssetRegister({ client }), {
      initialProps: { client: first.client },
    });
    const oldCall = callAt(first.calls, 0);
    hook.rerender({ client: next.client });
    expect(oldCall.signal?.aborted).toBe(true);
    expect(next.calls).toHaveLength(1);
  });

  it("ignores a late response from a previous client after a client switch", async () => {
    const first = controlledClient();
    const next = controlledClient();
    const hook = renderHook(({ client }: { client: ApiClient | null }) => useServerAssetRegister({ client }), {
      initialProps: { client: first.client },
    });
    const oldCall = callAt(first.calls, 0);
    hook.rerender({ client: next.client });
    await succeed(oldCall, wirePage([asset(1)]));
    expect(hook.result.current.state.kind).toBe("loading");
    await succeed(callAt(next.calls, 0), wirePage([asset(2)]));
    const state = hook.result.current.state;
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("Expected current-client page");
    expect(state.page.items[0]?.record.id).toBe("AST-002");
  });

  it("clears existing records when client becomes null", async () => {
    const transport = controlledClient();
    const hook = renderHook(({ client }: { client: ApiClient | null }) => useServerAssetRegister({ client }), {
      initialProps: { client: transport.client as ApiClient | null },
    });
    await succeed(callAt(transport.calls, 0));
    hook.rerender({ client: null });
    expect(hook.result.current.state.kind).toBe("idle");
    expect("page" in hook.result.current.state).toBe(false);
  });

  it("aborts an in-flight request when client becomes null", async () => {
    const transport = controlledClient();
    const hook = renderHook(({ client }: { client: ApiClient | null }) => useServerAssetRegister({ client }), {
      initialProps: { client: transport.client as ApiClient | null },
    });
    const old = callAt(transport.calls, 0);
    hook.rerender({ client: null });
    expect(old.signal?.aborted).toBe(true);
    await succeed(old);
    expect(hook.result.current.state.kind).toBe("idle");
  });

  it("starts a fresh fetch when reconnecting from null", async () => {
    const transport = controlledClient();
    const hook = renderHook(({ client }: { client: ApiClient | null }) => useServerAssetRegister({ client }), {
      initialProps: { client: null as ApiClient | null },
    });
    expect(transport.calls).toHaveLength(0);
    hook.rerender({ client: transport.client });
    expect(transport.calls).toHaveLength(1);
    await succeed(callAt(transport.calls, 0));
    expect(hook.result.current.state.kind).toBe("ready");
  });
});

describe("HTTP transport and ServerAssetRegister integration", () => {
  it("uses the actual API client and runtime decoder for a same-origin GET", async () => {
    const observed: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      observed.push({ input, init });
      return new Response(JSON.stringify(wirePage()), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    };
    const client = createApiClient({ apiBasePath: "/api", fetchImpl });
    const hook = renderHook(() => useServerAssetRegister({ client }));
    await waitFor(() => expect(hook.result.current.state.kind).toBe("ready"));
    expect(observed).toHaveLength(1);
    expect(observed[0]?.input).toBe("/api/v1/assets?page=1&pageSize=10");
    expect(observed[0]?.init?.credentials).toBe("same-origin");
    expect(observed[0]?.init?.cache).toBe("no-store");
    expect(observed[0]?.init?.redirect).toBe("error");
  });

  it("does not expose a failed HTTP authorization response as an empty register", async () => {
    const fetchImpl: typeof fetch = async () => new Response("Unauthorized", { status: 403 });
    const client = createApiClient({ apiBasePath: "/api", fetchImpl });
    const hook = renderHook(() => useServerAssetRegister({ client }));
    await waitFor(() => expect(hook.result.current.state.kind).toBe("error"));
    expect("page" in hook.result.current.state).toBe(false);
  });

  function Connected({ client }: { client: ApiClient | null }) {
    return <ServerAssetRegister {...useServerAssetRegister({ client })} />;
  }

  it("shows a disconnected message without querying a backend", () => {
    render(<Connected client={null} />);
    expect(screen.getByText("Asset Register API is not connected.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the validated server page and provenance in the controlled view", async () => {
    const transport = controlledClient();
    render(<Connected client={transport.client} />);
    expect(screen.getByRole("status").textContent).toContain("Loading the requested asset page");
    await succeed(callAt(transport.calls, 0));
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("Synthetic asset 001")).toBeDefined();
    expect(screen.getByText(/RISK-TEST-001/)).toBeDefined();
    expect(screen.getByText(/EVIDENCE-TEST-001/)).toBeDefined();
  });

  it("submits the search to the server and withholds existing rows", async () => {
    const transport = controlledClient();
    render(<Connected client={transport.client} />);
    await succeed(callAt(transport.calls, 0));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search assets" }), {
      target: { value: "  pump  " },
    });
    fireEvent.submit(screen.getByRole("search", { name: "Search server asset register" }));
    expect(callAt(transport.calls, 1).query).toEqual({ page: 1, pageSize: 10, search: "pump" });
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("requests server filtering without applying a local filter to the current page", async () => {
    const transport = controlledClient();
    render(<Connected client={transport.client} />);
    await succeed(callAt(transport.calls, 0));
    fireEvent.change(screen.getByRole("combobox", { name: "Risk classification" }), {
      target: { value: "UNKNOWN" },
    });
    expect(callAt(transport.calls, 1).query).toEqual({ page: 1, pageSize: 10, risk: "UNKNOWN" });
    expect(screen.queryByRole("table")).toBeNull();
    await succeed(callAt(transport.calls, 1), wirePage([]));
    expect(screen.getByText("No assets match the current server-side query.")).toBeDefined();
  });

  it("requests the next server page using authoritative pagination metadata", async () => {
    const transport = controlledClient();
    render(<Connected client={transport.client} />);
    const ten = Array.from({ length: 10 }, (_, i) => asset(i + 1));
    await succeed(callAt(transport.calls, 0), wirePage(ten, { totalItems: 11 }));
    expect(screen.getByText("Showing 1–10 of 11 matching authorized assets")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Next server page" }));
    expect(callAt(transport.calls, 1).query).toEqual({ page: 2, pageSize: 10 });
    expect(screen.queryByRole("table")).toBeNull();
    await succeed(callAt(transport.calls, 1), wirePage([asset(11)], { page: 2, totalItems: 11 }));
    expect(screen.getByText("Showing 11–11 of 11 matching authorized assets")).toBeDefined();
  });

  it("preserves existing risk filtering when selecting an evidence filter", async () => {
    const transport = controlledClient();
    render(<Connected client={transport.client} />);
    await succeed(callAt(transport.calls, 0));
    fireEvent.change(screen.getByRole("combobox", { name: "Risk classification" }), {
      target: { value: "HIGH" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Evidence status" }), {
      target: { value: "STALE" },
    });
    expect(callAt(transport.calls, 2).query).toEqual({
      page: 1, pageSize: 10, risk: "HIGH", evidence: "STALE",
    });
  });

  it("supports retry from the displayed generic error state", async () => {
    const transport = controlledClient();
    render(<Connected client={transport.client} />);
    await fail(callAt(transport.calls, 0));
    expect(screen.getByRole("alert").textContent).toContain("could not be loaded");
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(transport.calls).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    await succeed(callAt(transport.calls, 1));
    expect(screen.getByRole("table")).toBeDefined();
  });
});
