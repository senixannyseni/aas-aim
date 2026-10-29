// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import { useAuthenticatedAssetPage } from "./useAuthenticatedAssetPage";

const live = new Set<AuthSessionBoundary>();
afterEach(() => {
  cleanup();
  for (const boundary of live) boundary.dispose();
  live.clear();
});

const identity = {
  subjectKey: "synthetic-user", tenantKey: "synthetic-tenant",
  sessionKey: "synthetic-session",
  getAccessToken: () => "synthetic-test-token",
};

function assetPage() {
  return {
    items: [{
      id: "AST-001", tag: "V-101", name: "Synthetic pressure vessel",
      assetType: "Pressure vessel", location: "Synthetic facility",
      riskClassification: null, evidenceAssessment: null,
    }],
    pageInfo: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasNextPage: false },
  };
}
function jsonResponse(): Response {
  return new Response(JSON.stringify(assetPage()), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
function boundaryWith(fetchImpl: typeof fetch): AuthSessionBoundary {
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl });
  live.add(boundary);
  return boundary;
}

describe("Stage 45.2 — authenticated bridge", () => {
  it("is inert without an identity provider", () => {
    const { result } = renderHook(() => useAuthenticatedAssetPage(null));
    expect(result.current.phase).toBe("signed-out");
    expect(result.current.register.state.kind).toBe("idle");
  });

  it("loads a validated server page and clears it on expiry", async () => {
    const calls: { input: RequestInfo | URL; init: RequestInit | undefined }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return jsonResponse();
    };
    const boundary = boundaryWith(fetchImpl);
    const { result } = renderHook(() => useAuthenticatedAssetPage(boundary));
    act(() => boundary.activate(identity));
    await waitFor(() => expect(result.current.register.state.kind).toBe("ready"));
    const state = result.current.register.state;
    if (state.kind !== "ready") throw new Error("Expected ready asset page");
    expect(state.page.items[0]?.record.id).toBe("AST-001");
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.input)).toContain("/api/v1/assets");
    expect(calls[0]?.init?.credentials).toBe("omit");
    expect(new Headers(calls[0]?.init?.headers).get("Authorization"))
      .toBe("Bearer synthetic-test-token");
    act(() => boundary.transition("expired"));
    expect(result.current.phase).toBe("expired");
    expect(result.current.register.state.kind).toBe("idle");
  });

  it("does not resurrect a response after revocation", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    let fetchCount = 0;
    // Deliberately ignores AbortSignal; revocation must still invalidate it.
    const fetchImpl: typeof fetch = () => {
      fetchCount += 1;
      return new Promise<Response>((resolve) => { resolveFetch = resolve; });
    };
    const boundary = boundaryWith(fetchImpl);
    const { result } = renderHook(() => useAuthenticatedAssetPage(boundary));
    act(() => boundary.activate(identity));
    await waitFor(() => expect(fetchCount).toBe(1));
    act(() => boundary.transition("revoked"));
    expect(result.current.register.state.kind).toBe("idle");
    await act(async () => {
      resolveFetch?.(jsonResponse());
      await Promise.resolve();
    });
    expect(result.current.phase).toBe("revoked");
    expect(result.current.register.state.kind).toBe("idle");
  });
});
