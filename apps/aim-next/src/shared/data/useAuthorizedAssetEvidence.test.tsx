// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import { useAuthorizedAssetEvidence } from "./useAuthorizedAssetEvidence";

const boundaries = new Set<AuthSessionBoundary>();
afterEach(() => { cleanup(); for (const b of boundaries) b.dispose(); boundaries.clear(); });
const identity = { subjectKey: "synthetic", tenantKey: "tenant-a", sessionKey: "one",
  getAccessToken: () => "synthetic-test-token" };
const revision = (sessionRevision: number, assetId = "AST-001") => ({
  assetId, revisionId: "rev_8", group: "DISPLAYED_REVISION" as const, sessionRevision,
});
const item = { id: "evidence-1", revisionId: "rev_8", kind: "MEASUREMENT",
  association: "ASSOCIATED", availability: "AVAILABLE", quality: "VALID",
  sourceReference: "source-one", basisReference: null, recordedAt: "2026-10-28T10:00:00Z" };
const resultPage = (assetId: string, cursor: string | null = null) => ({ assetId,
  viewRevisionId: "rev_8", group: "DISPLAYED_REVISION", snapshotKey: "server_gen_one",
  items: [{ ...item, id: cursor ? "evidence-2" : "evidence-1" }],
  nextCursor: cursor ? null : "next_page" });
function boundary(fetchImpl: typeof fetch): AuthSessionBoundary {
  const b = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl });
  boundaries.add(b); return b;
}
function response(assetId: string, cursor: string | null = null): Response {
  return new Response(JSON.stringify(resultPage(assetId, cursor)), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

describe("Stage 45.5 — evidence request lifecycle", () => {
  it("never requests evidence without an authenticated session", () => {
    const { result } = renderHook(() => useAuthorizedAssetEvidence(null, revision(0)));
    expect(result.current.state.kind).toBe("idle");
  });
  it("requests a first page and follows only the server cursor plus snapshot key", async () => {
    const urls: string[] = [];
    const b = boundary(async input => {
      const url = String(input); urls.push(url);
      const parsed = new URL(url, "http://local.test");
      return response("AST-001", parsed.searchParams.get("cursor"));
    });
    act(() => b.activate(identity));
    const { result } = renderHook(() => useAuthorizedAssetEvidence(
      b, revision(b.getSnapshot().revision)));
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.state.kind === "ready" &&
      result.current.state.pageNumber === 2).toBe(true));
    expect(urls[0]).toContain("/api/v1/assets/AST-001/evidence?");
    expect(urls[1]).toContain("cursor=next_page");
    expect(urls[1]).toContain("snapshotKey=server_gen_one");
    expect(result.current.state.kind === "ready" &&
      result.current.state.page.nextCursor).toBeNull();
  });
  it("reports malformed caller revision identity without throwing during the effect", async () => {
    let calls = 0;
    const b = boundary(async () => { calls++; return response("AST-001"); });
    act(() => b.activate(identity));
    const { result } = renderHook(() => useAuthorizedAssetEvidence(b, {
      assetId: "AST-001", revisionId: "rev/8", group: "DISPLAYED_REVISION",
      sessionRevision: b.getSnapshot().revision,
    }));
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    if (result.current.state.kind === "error") {
      expect(result.current.state.failure.kind).toBe("invalid_response");
    }
    expect(calls).toBe(0);
  });
  it("never restores previous-session evidence after revocation", async () => {
    let deliver: ((value: Response) => void) | undefined;
    const b = boundary(() => new Promise<Response>(resolve => { deliver = resolve; }));
    act(() => b.activate(identity));
    const { result } = renderHook(() => useAuthorizedAssetEvidence(
      b, revision(b.getSnapshot().revision)));
    expect(result.current.state.kind).toBe("loading");
    await waitFor(() => expect(deliver).toBeDefined());
    act(() => b.transition("revoked"));
    expect(result.current.state.kind).toBe("idle");
    await act(async () => { deliver?.(response("AST-001")); await Promise.resolve(); });
    expect(result.current.state.kind).toBe("idle");
  });
  it("rejects an obsolete asset response after selection changes", async () => {
    const responders = new Map<string, (value: Response) => void>();
    const b = boundary(input => new Promise<Response>(resolve => {
      responders.set(String(input), resolve);
    }));
    act(() => b.activate(identity));
    const rev = b.getSnapshot().revision;
    const { result, rerender } = renderHook(({ assetId }) => useAuthorizedAssetEvidence(
      b, revision(rev, assetId)), { initialProps: { assetId: "AST-001" } });
    await waitFor(() => expect([...responders.keys()].some(v => v.includes("AST-001"))).toBe(true));
    rerender({ assetId: "AST-002" });
    expect(result.current.state.kind).toBe("loading");
    await waitFor(() => expect([...responders.keys()].some(v => v.includes("AST-002"))).toBe(true));
    await act(async () => {
      for (const [url, deliver] of responders) if (url.includes("AST-001")) deliver(response("AST-001"));
      await Promise.resolve();
    });
    expect(result.current.state.kind).not.toBe("ready");
    await act(async () => {
      for (const [url, deliver] of responders) if (url.includes("AST-002")) deliver(response("AST-002"));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    if (result.current.state.kind === "ready") expect(result.current.state.page.assetId).toBe("AST-002");
  });
  it("does not present inaccessible evidence as an empty successful page", async () => {
    const b = boundary(async () => new Response("", { status: 403 }));
    act(() => b.activate(identity));
    const { result } = renderHook(() => useAuthorizedAssetEvidence(
      b, revision(b.getSnapshot().revision)));
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    if (result.current.state.kind === "error") expect(result.current.state.failure.kind).toBe("access_denied");
  });
});
