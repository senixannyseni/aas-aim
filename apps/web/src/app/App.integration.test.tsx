// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  createAuthSessionBoundary,
  type AuthSessionActivation,
  type AuthSessionBoundary,
  type UnauthenticatedPhase,
} from "../shared/auth/authSession";
import App from "./App";

/**
 * File 54 — application-level integration regression tests.
 *
 * All identities, tokens, engineering classifications, and responses are
 * SYNTHETIC fixtures. The tests verify frontend visibility and navigation,
 * not real authentication, tenant authorization, or backend engineering truth.
 */
const SUBJECT_A: AuthSessionActivation = {
  subjectKey: "test-subject-A",
  tenantKey: "test-tenant-A",
  sessionKey: "test-session-A",
  getAccessToken: () => "test-token-A",
};
const SUBJECT_B: AuthSessionActivation = {
  subjectKey: "test-subject-B",
  tenantKey: "test-tenant-B",
  sessionKey: "test-session-B",
  getAccessToken: () => "test-token-B",
};

function asset(id: string): Record<string, unknown> {
  return {
    id: `TEST-${id}`,
    tag: `V-${id}`,
    name: `Synthetic ${id} asset`,
    assetType: "Test vessel",
    location: "Synthetic facility",
    riskClassification: {
      level: "CRITICAL",
      basisRecordId: `RISK-TEST-${id}`,
      assessedAt: "2026-10-20T09:00:00+07:00",
    },
    evidenceAssessment: {
      state: "VALID",
      basisRecordId: `EVID-TEST-${id}`,
      evaluatedAt: "2026-10-20T08:00:00Z",
    },
  };
}

function assetPage(items: unknown[] = [asset("A")], totalItems = items.length): unknown {
  return {
    items,
    pageInfo: {
      page: 1,
      pageSize: 10,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / 10)),
      hasNextPage: totalItems > 10,
    },
  };
}

type PendingResponse = {
  readonly promise: Promise<Response>;
  readonly resolve: (response: Response) => void;
  readonly reject: (reason: unknown) => void;
};

function deferredResponse(): PendingResponse {
  let resolve!: (response: Response) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Response>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}

type CapturedRequest = Readonly<{
  input: RequestInfo | URL;
  init: RequestInit | undefined;
  pending: PendingResponse;
}>;

function transport(ignoreAbort = false): {
  fetchImpl: typeof fetch;
  calls: CapturedRequest[];
} {
  const calls: CapturedRequest[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const pending = deferredResponse();
    calls.push({ input, init, pending });
    if (!ignoreAbort) {
      const abort = (): void => pending.reject(new DOMException("Test request aborted", "AbortError"));
      if (init?.signal?.aborted) abort();
      else init?.signal?.addEventListener("abort", abort, { once: true });
    }
    return pending.promise;
  };
  return { fetchImpl, calls };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function callAt(calls: readonly CapturedRequest[], index: number): CapturedRequest {
  const call = calls[index];
  if (call === undefined) throw new Error("Expected synthetic request was not made.");
  return call;
}

async function deliver(call: CapturedRequest, data: unknown = assetPage()): Promise<void> {
  await act(async () => { call.pending.resolve(jsonResponse(data)); });
}

async function expectCalls(calls: readonly CapturedRequest[], n: number): Promise<void> {
  await waitFor(() => expect(calls).toHaveLength(n));
}

function expectDisconnected(): void {
  const register = screen.getByRole("region", { name: "Server asset register" });
  expect(within(register).getByText("Asset Register API is not connected.")).toBeDefined();
  expect(within(register).queryByRole("table")).toBeNull();
  expect(within(register).queryByRole("searchbox")).toBeNull();
}

async function expectAsset(name: string): Promise<void> {
  await waitFor(() => expect(screen.getByText(name)).toBeDefined());
}

const boundaries = new Set<AuthSessionBoundary>();
function makeBoundary(fetchImpl: typeof fetch): AuthSessionBoundary {
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl });
  boundaries.add(boundary);
  return boundary;
}

afterEach(() => {
  cleanup();
  for (const boundary of boundaries) boundary.dispose();
  boundaries.clear();
});

describe("App — authenticated Asset Register application integration", () => {
  it("defaults to a disconnected register and makes no synthetic connection", () => {
    render(<App />);
    expectDisconnected();
    expect(screen.getByRole("heading", { level: 1, name: "AIM overview" })).toBeDefined();
  });

  it("an explicit null boundary stays disconnected", () => {
    render(<App authBoundary={null} />);
    expectDisconnected();
  });

  it("renders every navigation destination exactly once", () => {
    render(<App />);
    const links = within(screen.getByRole("navigation", { name: "Workspace sections" })).getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const link of links) {
      const href = link.getAttribute("href");
      expect(href?.startsWith("#")).toBe(true);
      expect(document.querySelectorAll(`[id="${href!.slice(1)}"]`)).toHaveLength(1);
    }
    expect(screen.getByRole("region", { name: "Server asset register" }).closest("#asset-register")).not.toBeNull();
  });

  it("does not fetch for a signed-out session boundary", () => {
    const net = transport();
    render(<App authBoundary={makeBoundary(net.fetchImpl)} />);
    expectDisconnected();
    expect(net.calls).toHaveLength(0);
  });

  it("fetches a validated server page after a trusted boundary activates", async () => {
    const net = transport();
    const boundary = makeBoundary(net.fetchImpl);
    render(<App authBoundary={boundary} />);
    act(() => boundary.activate(SUBJECT_A));
    await expectCalls(net.calls, 1);
    const request = callAt(net.calls, 0);
    const url = new URL(String(request.input), "https://synthetic.test");
    expect(url.pathname).toBe("/api/v1/assets");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("pageSize")).toBe("10");
    await deliver(request);
    await expectAsset("Synthetic A asset");
    expect(screen.getByText(/RISK-TEST-A/)).toBeDefined();
    expect(screen.getByText(/EVID-TEST-A/)).toBeDefined();
    expect(screen.getByText("Showing 1–1 of 1 matching authorized assets")).toBeDefined();
  });

  it("does not treat one server page as the full register", async () => {
    const net = transport();
    const boundary = makeBoundary(net.fetchImpl);
    boundary.activate(SUBJECT_A);
    render(<App authBoundary={boundary} />);
    await expectCalls(net.calls, 1);
    await deliver(callAt(net.calls, 0), assetPage(Array.from({ length: 10 }, (_, n) => asset(String(n + 1))), 11));
    await waitFor(() => expect(screen.getByText("Showing 1–10 of 11 matching authorized assets")).toBeDefined());
    expect(screen.getByRole("button", { name: "Next server page" }).hasAttribute("disabled")).toBe(false);
  });

  it("removes records immediately on sign-out and blocks old clients", async () => {
    const net = transport();
    const boundary = makeBoundary(net.fetchImpl);
    boundary.activate(SUBJECT_A);
    render(<App authBoundary={boundary} />);
    await expectCalls(net.calls, 1);
    await deliver(callAt(net.calls, 0));
    await expectAsset("Synthetic A asset");
    const previousClient = boundary.getSnapshot().client;
    act(() => boundary.transition("signed-out"));
    expectDisconnected();
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
    expect(previousClient).not.toBeNull();
    expect(boundary.getSnapshot().client).toBeNull();
  });

  const inactivePhases: readonly UnauthenticatedPhase[] = [
    "authenticating", "refreshing", "expired", "revoked", "error",
  ];
  for (const phase of inactivePhases) {
    it(`hides records when the session becomes ${phase}`, async () => {
      const net = transport();
      const boundary = makeBoundary(net.fetchImpl);
      boundary.activate(SUBJECT_A);
      render(<App authBoundary={boundary} />);
      await expectCalls(net.calls, 1);
      await deliver(callAt(net.calls, 0));
      await expectAsset("Synthetic A asset");
      act(() => boundary.transition(phase));
      expectDisconnected();
      expect(screen.queryByText("Synthetic A asset")).toBeNull();
    });
  }

  it("does not display a previous tenant after session replacement", async () => {
    const net = transport();
    const boundary = makeBoundary(net.fetchImpl);
    boundary.activate(SUBJECT_A);
    render(<App authBoundary={boundary} />);
    await expectCalls(net.calls, 1);
    await deliver(callAt(net.calls, 0));
    await expectAsset("Synthetic A asset");
    act(() => boundary.activate(SUBJECT_B));
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
    await expectCalls(net.calls, 2);
    await deliver(callAt(net.calls, 1), assetPage([asset("B")]));
    await expectAsset("Synthetic B asset");
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
  });

  it("resets search text when a new session takes ownership", async () => {
    const net = transport();
    const boundary = makeBoundary(net.fetchImpl);
    boundary.activate(SUBJECT_A);
    render(<App authBoundary={boundary} />);
    await expectCalls(net.calls, 1);
    await deliver(callAt(net.calls, 0));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search assets" }), {
      target: { value: "confidential previous tenant search" },
    });
    act(() => boundary.activate(SUBJECT_B));
    expect((screen.getByRole("searchbox", { name: "Search assets" }) as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
  });

  it("rejects a late response after sign-out, even when fetch ignores abort", async () => {
    const net = transport(true);
    const boundary = makeBoundary(net.fetchImpl);
    boundary.activate(SUBJECT_A);
    render(<App authBoundary={boundary} />);
    await expectCalls(net.calls, 1);
    act(() => boundary.transition("signed-out"));
    await deliver(callAt(net.calls, 0));
    expectDisconnected();
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
  });

  it("rejects an old tenant's late response after the new tenant succeeds", async () => {
    const net = transport(true);
    const boundary = makeBoundary(net.fetchImpl);
    boundary.activate(SUBJECT_A);
    render(<App authBoundary={boundary} />);
    await expectCalls(net.calls, 1);
    act(() => boundary.activate(SUBJECT_B));
    await expectCalls(net.calls, 2);
    await deliver(callAt(net.calls, 1), assetPage([asset("B")]));
    await expectAsset("Synthetic B asset");
    await deliver(callAt(net.calls, 0), assetPage([asset("A")]));
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
    expect(screen.getByText("Synthetic B asset")).toBeDefined();
  });

  it("isolates records when the entire auth boundary prop is replaced", async () => {
    const a = transport();
    const b = transport();
    const first = makeBoundary(a.fetchImpl);
    const second = makeBoundary(b.fetchImpl);
    first.activate(SUBJECT_A);
    second.activate(SUBJECT_B);
    const view = render(<App authBoundary={first} />);
    await expectCalls(a.calls, 1);
    await deliver(callAt(a.calls, 0));
    await expectAsset("Synthetic A asset");
    view.rerender(<App authBoundary={second} />);
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
    await expectCalls(b.calls, 1);
    await deliver(callAt(b.calls, 0), assetPage([asset("B")]));
    await expectAsset("Synthetic B asset");
  });

  it("rejects malformed server records rather than showing partial data", async () => {
    const net = transport();
    const boundary = makeBoundary(net.fetchImpl);
    boundary.activate(SUBJECT_A);
    render(<App authBoundary={boundary} />);
    await expectCalls(net.calls, 1);
    await deliver(callAt(net.calls, 0), assetPage([{ ...asset("A"), riskClassification: { level: "LOW" } }]));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.queryByText("Synthetic A asset")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("does not display upstream diagnostic text when the API fails", async () => {
    const net = transport();
    const boundary = makeBoundary(net.fetchImpl);
    boundary.activate(SUBJECT_A);
    render(<App authBoundary={boundary} />);
    await expectCalls(net.calls, 1);
    await act(async () => { callAt(net.calls, 0).pending.reject(new Error("private-secret-diagnostic")); });
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("main").textContent).not.toContain("private-secret-diagnostic");
  });
});
