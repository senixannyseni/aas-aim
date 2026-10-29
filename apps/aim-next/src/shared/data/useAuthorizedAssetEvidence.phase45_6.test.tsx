// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import { useAuthorizedAssetEvidence } from "./useAuthorizedAssetEvidence";

const boundaries = new Set<AuthSessionBoundary>();
afterEach(() => { cleanup(); for (const b of boundaries) b.dispose(); boundaries.clear(); });
function create(fetchImpl: typeof fetch): AuthSessionBoundary {
  const b = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl });
  boundaries.add(b);
  act(() => b.activate({ subjectKey: "synthetic", tenantKey: "t1", sessionKey: "s1",
    getAccessToken: () => "synthetic-token" }));
  return b;
}
function response(snapshotKey: string, cursor: string | null): Response {
  return new Response(JSON.stringify({ assetId: "AST-001", viewRevisionId: "rev_8",
    group: "DISPLAYED_REVISION", snapshotKey,
    items: [{ id: cursor ? "ev2" : "ev1", revisionId: "rev_8", kind: "DOCUMENT",
      association: "ASSOCIATED", availability: "AVAILABLE", quality: "UNKNOWN",
      sourceReference: "source", basisReference: null, recordedAt: "2026-10-28T10:00:00Z" }],
    nextCursor: cursor ? null : "next2" }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
describe("Stage 45.6 — evidence cursor generation integrity", () => {
  it("fails closed on changed cursor generation and restarts from page one", async () => {
    const urls: string[] = [];
    let firstRequests = 0;
    const b = create(async input => {
      const url = String(input); urls.push(url);
      const cursor = new URL(url, "http://test").searchParams.get("cursor");
      if (cursor) return response("different-generation", cursor);
      firstRequests += 1;
      return response(firstRequests === 1 ? "original" : "restarted", null);
    });
    const { result } = renderHook(() => useAuthorizedAssetEvidence(b, {
      assetId: "AST-001", revisionId: "rev_8", group: "DISPLAYED_REVISION",
      sessionRevision: b.getSnapshot().revision,
    }));
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    if (result.current.state.kind === "error") {
      expect(result.current.state.failure.kind).toBe("invalid_response");
    }
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.kind === "ready" &&
      result.current.state.page.snapshotKey === "restarted").toBe(true));
    expect(urls[urls.length - 1]).not.toContain("cursor=");
    expect(result.current.hasPreviousPage).toBe(false);
  });
  it("moves backward using a pinned cursor and disallows Next at the terminal page", async () => {
    const b = create(async input => {
      const cursor = new URL(String(input), "http://test").searchParams.get("cursor");
      return response("same-generation", cursor);
    });
    const { result } = renderHook(() => useAuthorizedAssetEvidence(b, {
      assetId: "AST-001", revisionId: "rev_8", group: "DISPLAYED_REVISION",
      sessionRevision: b.getSnapshot().revision,
    }));
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.state.kind === "ready" &&
      result.current.state.pageNumber === 2).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.hasPreviousPage).toBe(true);
    act(() => result.current.previousPage());
    await waitFor(() => expect(result.current.state.kind === "ready" &&
      result.current.state.pageNumber === 1).toBe(true));
    expect(result.current.hasPreviousPage).toBe(false);
    expect(result.current.hasNextPage).toBe(true);
  });
});
