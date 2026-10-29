// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import type { AssetPageSelection } from "./assetRegisterReadModel";
import { useAuthorizedAssetDetail } from "./useAuthorizedAssetDetail";

const boundaries = new Set<AuthSessionBoundary>();
afterEach(() => { cleanup(); for (const boundary of boundaries) boundary.dispose(); boundaries.clear(); });
const identity = { subjectKey: "test-subject", tenantKey: "tenant-a",
  sessionKey: "session-one", getAccessToken: () => "synthetic-token" };
function makeBoundary(fetchImpl: typeof fetch): AuthSessionBoundary {
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl });
  boundaries.add(boundary);
  return boundary;
}
function response(id: string): Response {
  return new Response(JSON.stringify({
    asset: { id, tag: id, name: `Synthetic ${id}` },
    revision: { id: "rev_1", label: "1", state: "RELEASED",
      changedAt: "2026-10-28T10:00:00Z", sourceReference: "fixture-source" },
    governingRevisionId: "rev_1",
  }), { status: 200, headers: { "content-type": "application/json" } });
}
const selected = (assetId: string, sessionRevision: number): AssetPageSelection => ({
  assetId, sessionRevision,
});

describe("Stage 45.4 — selected Asset Detail lifecycle", () => {
  it("is disconnected without a session or selection", () => {
    const { result } = renderHook(() => useAuthorizedAssetDetail(null, selected("AST-001", 0)));
    expect(result.current.state.kind).toBe("idle");
  });
  it("requests exact asset detail only for the current authenticated revision", async () => {
    const urls: string[] = [];
    const boundary = makeBoundary(async input => {
      urls.push(String(input)); return response("AST-001");
    });
    const { result, rerender } = renderHook(({ selection }) =>
      useAuthorizedAssetDetail(boundary, selection),
      { initialProps: { selection: null as AssetPageSelection | null } });
    act(() => boundary.activate(identity));
    expect(result.current.state.kind).toBe("idle");
    rerender({ selection: selected("AST-001", boundary.getSnapshot().revision) });
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(urls).toEqual(["/api/v1/assets/AST-001"]);
    act(() => boundary.transition("expired"));
    expect(result.current.state.kind).toBe("idle");
  });
  it("does not accept detail from the previous selection", async () => {
    const responses = new Map<string, (response: Response) => void>();
    const boundary = makeBoundary(input => new Promise<Response>(resolve => {
      responses.set(String(input), resolve);
    }));
    act(() => boundary.activate(identity));
    const rev = boundary.getSnapshot().revision;
    const { result, rerender } = renderHook(({ selection }) =>
      useAuthorizedAssetDetail(boundary, selection),
      { initialProps: { selection: selected("AST-001", rev) as AssetPageSelection | null } });
    await waitFor(() => expect(responses.has("/api/v1/assets/AST-001")).toBe(true));
    rerender({ selection: selected("AST-002", rev) });
    expect(result.current.state.kind).toBe("loading");
    await waitFor(() => expect(responses.has("/api/v1/assets/AST-002")).toBe(true));
    await act(async () => {
      responses.get("/api/v1/assets/AST-001")?.(response("AST-001"));
      await Promise.resolve();
    });
    expect(result.current.state.kind).not.toBe("ready");
    await act(async () => {
      responses.get("/api/v1/assets/AST-002")?.(response("AST-002"));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    if (result.current.state.kind === "ready") {
      expect(result.current.state.detail.asset.id).toBe("AST-002");
    }
  });
  it("rejects mismatched asset response and never displays it", async () => {
    const boundary = makeBoundary(async () => response("AST-OTHER"));
    act(() => boundary.activate(identity));
    const { result } = renderHook(() => useAuthorizedAssetDetail(
      boundary, selected("AST-001", boundary.getSnapshot().revision)));
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    if (result.current.state.kind === "error") {
      expect(result.current.state.failure.kind).toBe("invalid_response");
    }
  });
  it("does not request a detail under a stale session revision", () => {
    let calls = 0;
    const boundary = makeBoundary(async () => { calls++; return response("AST-001"); });
    act(() => boundary.activate(identity));
    const { result } = renderHook(() => useAuthorizedAssetDetail(
      boundary, selected("AST-001", 0)));
    expect(result.current.state.kind).toBe("idle");
    expect(calls).toBe(0);
  });
});
