// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiClientError } from "../../shared/api/apiClient";
import {
  createAuthSessionBoundary,
  type AuthSessionActivation,
  type AuthSessionBoundary,
  type UnauthenticatedPhase,
} from "../../shared/auth/authSession";
import { AuthenticatedAssetRegister } from "./AuthenticatedAssetRegister";

/**
 * File 53 — permanent React integration tests for the authenticated Asset Register.
 *
 * Every identity, bearer token, asset, basis reference, and response is synthetic.
 * Responses are served through an injected fetch implementation; no identity
 * provider, live Java endpoint, tenant authority or engineering approval is
 * assumed. Successful frontend isolation is not a substitute for server-side
 * authentication and tenant/asset authorization.
 */
const ASSESSED_AT = "2026-10-20T09:00:00+07:00";
const EVALUATED_AT = "2026-10-20T08:00:00Z";

const AUTH_A: AuthSessionActivation = {
  subjectKey: "synthetic-subject-A",
  tenantKey: "synthetic-tenant-A",
  sessionKey: "synthetic-session-A",
  getAccessToken: () => "synthetic-token-A",
};
const AUTH_B: AuthSessionActivation = {
  subjectKey: "synthetic-subject-B",
  tenantKey: "synthetic-tenant-B",
  sessionKey: "synthetic-session-B",
  getAccessToken: () => "synthetic-token-B",
};

function record(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `TEST-${id}`,
    tag: `V-${id}`,
    name: `Synthetic ${id} asset`,
    assetType: "Pressure vessel",
    location: "Synthetic test plant",
    riskClassification: {
      level: "CRITICAL",
      basisRecordId: `RISK-TEST-${id}`,
      assessedAt: ASSESSED_AT,
    },
    evidenceAssessment: {
      state: "VALID",
      basisRecordId: `EVIDENCE-TEST-${id}`,
      evaluatedAt: EVALUATED_AT,
    },
    ...overrides,
  };
}

function page(
  items: unknown[] = [record("A")],
  changes: Partial<{ page: number; pageSize: 10 | 25 | 50; totalItems: number }> = {},
): Record<string, unknown> {
  const pageNumber = changes.page ?? 1;
  const pageSize = changes.pageSize ?? 10;
  const totalItems = changes.totalItems ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    items,
    pageInfo: {
      page: pageNumber,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: pageNumber < totalPages,
    },
  };
}

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}

type CapturedRequest = Readonly<{
  input: RequestInfo | URL;
  init: RequestInit | undefined;
  response: Deferred<Response>;
}>;

/**
 * Cooperative by default, so abandoned mocked requests release HTTP timers.
 * Set ignoreAbort for deliberate stale-completion regression scenarios.
 */
function transport(ignoreAbort = false): { fetchImpl: typeof fetch; calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const response = deferred<Response>();
    calls.push({ input, init, response });
    if (!ignoreAbort) {
      const signal = init?.signal;
      const cancel = (): void => response.reject(new DOMException("Synthetic fetch aborted", "AbortError"));
      if (signal?.aborted) cancel();
      else signal?.addEventListener("abort", cancel, { once: true });
    }
    return response.promise;
  };
  return { fetchImpl, calls };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function captured(calls: readonly CapturedRequest[], index: number): CapturedRequest {
  const call = calls[index];
  if (call === undefined) throw new Error(`Missing synthetic HTTP request ${index}`);
  return call;
}

async function delivered(call: CapturedRequest, data: unknown = page()): Promise<void> {
  await act(async () => {
    call.response.resolve(jsonResponse(data));
  });
}

async function failed(call: CapturedRequest, error: unknown = new Error("private upstream diagnostic")): Promise<void> {
  await act(async () => {
    call.response.reject(error);
  });
}

const liveBoundaries = new Set<AuthSessionBoundary>();

function makeBoundary(fetchImpl: typeof fetch): AuthSessionBoundary {
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl });
  liveBoundaries.add(boundary);
  return boundary;
}

function activeBoundary(fetchImpl: typeof fetch, session = AUTH_A): AuthSessionBoundary {
  const boundary = makeBoundary(fetchImpl);
  boundary.activate(session);
  return boundary;
}

function mount(boundary: AuthSessionBoundary | null) {
  return render(<AuthenticatedAssetRegister boundary={boundary} />);
}

async function expectRequests(calls: readonly CapturedRequest[], count: number): Promise<void> {
  await waitFor(() => expect(calls).toHaveLength(count));
}

async function expectAsset(name: string): Promise<void> {
  await waitFor(() => expect(screen.getByText(name)).toBeDefined());
}

function searchDraft(text: string): void {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search assets" }), {
    target: { value: text },
  });
}

function submitSearch(): void {
  fireEvent.submit(screen.getByRole("search", { name: "Search server asset register" }));
}

function expectDisconnected(): void {
  expect(screen.getByText("Asset Register API is not connected.")).toBeDefined();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("searchbox")).toBeNull();
}

afterEach(() => {
  cleanup();
  for (const boundary of liveBoundaries) boundary.dispose();
  liveBoundaries.clear();
});

describe("AuthenticatedAssetRegister — disconnected and initial lifecycle", () => {
  it("renders an explicit disconnected register when no boundary exists", () => {
    mount(null);
    expectDisconnected();
  });

  it("never creates an asset request from a null boundary", () => {
    const net = transport();
    const auth = makeBoundary(net.fetchImpl);
    mount(null);
    expect(net.calls).toHaveLength(0);
    expect(auth.getSnapshot().phase).toBe("signed-out");
  });

  it("remains disconnected for a real signed-out boundary", () => {
    const net = transport();
    mount(makeBoundary(net.fetchImpl));
    expectDisconnected();
    expect(net.calls).toHaveLength(0);
  });

  const disabled: readonly UnauthenticatedPhase[] = [
    "authenticating", "refreshing", "expired", "revoked", "error", "signed-out",
  ];

  for (const phase of disabled) {
    it(`does not request assets for an initial ${phase} boundary`, () => {
      const net = transport();
      const auth = makeBoundary(net.fetchImpl);
      auth.transition(phase);
      mount(auth);
      expectDisconnected();
      expect(net.calls).toHaveLength(0);
    });

    it(`removes visible records and query controls on transition to ${phase}`, async () => {
      const net = transport();
      const auth = activeBoundary(net.fetchImpl);
      mount(auth);
      await expectRequests(net.calls, 1);
      await delivered(captured(net.calls, 0));
      await expectAsset("Synthetic A asset");
      act(() => auth.transition(phase));
      expectDisconnected();
      expect(screen.queryByText("Synthetic A asset")).toBeNull();
      expect(auth.getSnapshot().client).toBeNull();
    });
  }

  it("starts a request only after an explicit trusted activation", async () => {
    const net = transport();
    const auth = makeBoundary(net.fetchImpl);
    mount(auth);
    expect(net.calls).toHaveLength(0);
    act(() => auth.activate(AUTH_A));
    await expectRequests(net.calls, 1);
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });

  it("does not request a token from a disconnected boundary", () => {
    const net = transport();
    const auth = makeBoundary(net.fetchImpl);
    mount(auth);
    expect(auth.getSnapshot().client).toBeNull();
    expect(net.calls).toHaveLength(0);
  });

  it("does not refetch from an unchanged authenticated boundary when parent rerenders", async () => {
    const net = transport();
    const auth = activeBoundary(net.fetchImpl);
    const view = mount(auth);
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0));
    view.rerender(<AuthenticatedAssetRegister boundary={auth} />);
    expect(net.calls).toHaveLength(1);
    expect(screen.getByText("Synthetic A asset")).toBeDefined();
  });
});

describe("AuthenticatedAssetRegister — authenticated server records", () => {
  it("requests the proposed API path through the authenticated transport", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    expect(String(captured(net.calls, 0).input)).toContain("/api/v1/assets?");
    expect(String(captured(net.calls, 0).input)).toContain("page=1");
    expect(String(captured(net.calls, 0).input)).toContain("pageSize=10");
  });

  it("uses a session-scoped bearer header without ambient cookies", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    const init = captured(net.calls, 0).init;
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-token-A");
    expect(init?.credentials).toBe("omit");
    expect(init?.redirect).toBe("error");
  });

  it("shows validated asset identity, risk and evidence independently", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0));
    await expectAsset("Synthetic A asset");
    const table = screen.getByRole("table");
    expect(table.textContent).toContain("TEST-A");
    expect(table.textContent).toContain("Risk: Critical");
    expect(table.textContent).toContain("Evidence: Valid");
  });

  it("displays independent basis IDs and timestamps", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0));
    const content = screen.getByRole("table").textContent ?? "";
    for (const text of ["RISK-TEST-A", "EVIDENCE-TEST-A", ASSESSED_AT, EVALUATED_AT]) {
      expect(content).toContain(text);
    }
  });

  it("preserves explicit UNKNOWN status rather than inventing LOW risk", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0), page([record("U", {
      riskClassification: { level: "UNKNOWN", basisRecordId: "RISK-UNKNOWN", assessedAt: ASSESSED_AT },
      evidenceAssessment: { state: "UNKNOWN", basisRecordId: "EVIDENCE-UNKNOWN", evaluatedAt: EVALUATED_AT },
    })]));
    expect(screen.getByText("Risk: Unknown")).toBeDefined();
    expect(screen.getByText("Evidence: Unknown")).toBeDefined();
    expect(screen.queryByText("Risk: Low")).toBeNull();
  });

  it("does not invent classifications for records with omitted classifications", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    const data = record("M");
    delete data["riskClassification"];
    delete data["evidenceAssessment"];
    await delivered(captured(net.calls, 0), page([data]));
    expect(within(screen.getByRole("table")).getAllByText("Not provided")).toHaveLength(2);
    expect(screen.queryByText("Risk: Unknown")).toBeNull();
  });

  it("uses server totals instead of treating a loaded page as the entire register", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    const firstTen = Array.from({ length: 10 }, (_, index) => record(`R${index + 1}`));
    await delivered(captured(net.calls, 0), page(firstTen, { totalItems: 12 }));
    expect(screen.getByText("Showing 1–10 of 12 matching authorized assets")).toBeDefined();
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(10);
  });

  it("does not invent an empty register on a failed request", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await failed(captured(net.calls, 0));
    expect(screen.getByRole("alert").textContent).toContain("could not be loaded");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("private upstream diagnostic")).toBeNull();
  });

  it("rejects malformed classification provenance instead of displaying partial data", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0), page([record("X", {
      riskClassification: { level: "CRITICAL", assessedAt: ASSESSED_AT },
    })]));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("retains an actionable retry for a failed authenticated request", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await failed(captured(net.calls, 0));
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    await expectRequests(net.calls, 2);
    await delivered(captured(net.calls, 1), page([record("RECOVERED")]));
    await expectAsset("Synthetic RECOVERED asset");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("AuthenticatedAssetRegister — query, filter and page scope", () => {
  it("submits a search as an authenticated server query", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0));
    searchDraft("  pressure vessel  ");
    submitSearch();
    await expectRequests(net.calls, 2);
    expect(String(captured(net.calls, 1).input)).toContain("search=pressure+vessel");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("sends independent risk and evidence filters to the server", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    fireEvent.change(screen.getByRole("combobox", { name: "Risk classification" }), {
      target: { value: "CRITICAL" },
    });
    await expectRequests(net.calls, 2);
    fireEvent.change(screen.getByRole("combobox", { name: "Evidence status" }), {
      target: { value: "UNKNOWN" },
    });
    await expectRequests(net.calls, 3);
    const url = String(captured(net.calls, 2).input);
    expect(url).toContain("risk=CRITICAL");
    expect(url).toContain("evidence=UNKNOWN");
  });

  it("changes server page instead of locally paginating the current page", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0), page(
      Array.from({ length: 10 }, (_, i) => record(`P${i + 1}`)),
      { totalItems: 12 },
    ));
    fireEvent.click(screen.getByRole("button", { name: "Next server page" }));
    await expectRequests(net.calls, 2);
    expect(String(captured(net.calls, 1).input)).toContain("page=2");
    expect(screen.queryByRole("table")).toBeNull();
    await delivered(captured(net.calls, 1), page([record("P11"), record("P12")], {
      page: 2, totalItems: 12,
    }));
    expect(screen.getByText("Showing 11–12 of 12 matching authorized assets")).toBeDefined();
  });

  it("resets to the first page when page size changes", async () => {
    const net = transport();
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0));
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "25" },
    });
    await expectRequests(net.calls, 2);
    const url = String(captured(net.calls, 1).input);
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=25");
  });

  it("does not display a superseded response after a search update", async () => {
    const net = transport(true);
    mount(activeBoundary(net.fetchImpl));
    await expectRequests(net.calls, 1);
    searchDraft("new");
    submitSearch();
    await expectRequests(net.calls, 2);
    await delivered(captured(net.calls, 1), page([record("NEW")]));
    expect(screen.getByText("Synthetic NEW asset")).toBeDefined();
    await delivered(captured(net.calls, 0), page([record("OLD")]));
    expect(screen.queryByText("Synthetic OLD asset")).toBeNull();
    expect(screen.getByText("Synthetic NEW asset")).toBeDefined();
  });
});

describe("AuthenticatedAssetRegister — session replacement and data isolation", () => {
  it("clears both loaded records and unsent search text on sign-out", async () => {
    const net = transport();
    const auth = activeBoundary(net.fetchImpl);
    mount(auth);
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0));
    searchDraft("private unsent search");
    expect((screen.getByRole("searchbox", { name: "Search assets" }) as HTMLInputElement).value)
      .toBe("private unsent search");
    act(() => auth.transition("signed-out"));
    expectDisconnected();
    act(() => auth.activate(AUTH_B));
    expect((screen.getByRole("searchbox", { name: "Search assets" }) as HTMLInputElement).value)
      .toBe("");
    await expectRequests(net.calls, 2);
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
  });

  it("resets submitted search and filters on a tenant switch", async () => {
    const net = transport();
    const auth = activeBoundary(net.fetchImpl);
    mount(auth);
    await expectRequests(net.calls, 1);
    searchDraft("secret-A");
    submitSearch();
    await expectRequests(net.calls, 2);
    fireEvent.change(screen.getByRole("combobox", { name: "Risk classification" }), {
      target: { value: "HIGH" },
    });
    await expectRequests(net.calls, 3);
    act(() => auth.activate(AUTH_B));
    await expectRequests(net.calls, 4);
    expect((screen.getByRole("searchbox", { name: "Search assets" }) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("combobox", { name: "Risk classification" }) as HTMLSelectElement).value).toBe("ALL");
    expect(String(captured(net.calls, 3).input)).not.toContain("secret-A");
    expect(String(captured(net.calls, 3).input)).not.toContain("risk=HIGH");
    expect(new Headers(captured(net.calls, 3).init?.headers).get("authorization"))
      .toBe("Bearer synthetic-token-B");
  });

  it("remounts even when the next session repeats all context keys", async () => {
    const net = transport();
    const auth = activeBoundary(net.fetchImpl);
    mount(auth);
    await expectRequests(net.calls, 1);
    searchDraft("unsent");
    const former = auth.getSnapshot().client;
    act(() => auth.activate(AUTH_A));
    expect(auth.getSnapshot().client).not.toBe(former);
    expect((screen.getByRole("searchbox", { name: "Search assets" }) as HTMLInputElement).value).toBe("");
    await expectRequests(net.calls, 2);
  });

  it("prevents a previous tenant's late response from becoming visible", async () => {
    const net = transport(true);
    const auth = activeBoundary(net.fetchImpl);
    mount(auth);
    await expectRequests(net.calls, 1);
    act(() => auth.activate(AUTH_B));
    await expectRequests(net.calls, 2);
    await delivered(captured(net.calls, 1), page([record("TENANT-B")]));
    await expectAsset("Synthetic TENANT-B asset");
    await delivered(captured(net.calls, 0), page([record("TENANT-A")]));
    expect(screen.getByText("Synthetic TENANT-B asset")).toBeDefined();
    expect(screen.queryByText("Synthetic TENANT-A asset")).toBeNull();
  });

  it("rejects a held previous-session client after identity replacement", async () => {
    const net = transport();
    const auth = activeBoundary(net.fetchImpl);
    const oldClient = auth.getSnapshot().client;
    mount(auth);
    act(() => auth.activate(AUTH_B));
    expect(oldClient).not.toBeNull();
    try {
      await oldClient!.request({ pathSegments: ["v1", "assets"], decode: (data) => data });
      throw new Error("A revoked client unexpectedly succeeded");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiClientError);
      expect((error as ApiClientError).code).toBe("ABORTED");
    }
  });

  it("uses only the new boundary when the parent replaces it", async () => {
    const net = transport();
    const authA = activeBoundary(net.fetchImpl);
    const authB = activeBoundary(net.fetchImpl, AUTH_B);
    const view = mount(authA);
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0), page([record("FROM-A")]));
    await expectAsset("Synthetic FROM-A asset");
    view.rerender(<AuthenticatedAssetRegister boundary={authB} />);
    expect(screen.queryByText("Synthetic FROM-A asset")).toBeNull();
    await expectRequests(net.calls, 2);
    await delivered(captured(net.calls, 1), page([record("FROM-B")]));
    await expectAsset("Synthetic FROM-B asset");
    act(() => authA.transition("revoked"));
    expect(screen.getByText("Synthetic FROM-B asset")).toBeDefined();
  });

  it("replaces an authenticated boundary with null without retaining results", async () => {
    const net = transport();
    const auth = activeBoundary(net.fetchImpl);
    const view = mount(auth);
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0));
    view.rerender(<AuthenticatedAssetRegister boundary={null} />);
    expectDisconnected();
  });

  it("does not revive an unmounted register when a late HTTP request completes", async () => {
    const net = transport(true);
    const auth = activeBoundary(net.fetchImpl);
    const view = mount(auth);
    await expectRequests(net.calls, 1);
    view.unmount();
    await delivered(captured(net.calls, 0), page([record("UNMOUNTED")]));
    expect(screen.queryByText("Synthetic UNMOUNTED asset")).toBeNull();
  });

  it("clears records on session disposal and cannot reactivate disposed boundary", async () => {
    const net = transport();
    const auth = activeBoundary(net.fetchImpl);
    mount(auth);
    await expectRequests(net.calls, 1);
    await delivered(captured(net.calls, 0));
    act(() => auth.dispose());
    expectDisconnected();
    expect(() => auth.activate(AUTH_B)).toThrow(ApiClientError);
  });
});
