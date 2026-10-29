// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import { AuthenticatedAssetInvestigation } from "./AuthenticatedAssetInvestigation";

const all = new Set<AuthSessionBoundary>();
afterEach(() => { cleanup(); for (const b of all) b.dispose(); all.clear(); });
const identity = { subjectKey: "synthetic-user", tenantKey: "site-a", sessionKey: "session-1",
  getAccessToken: () => "synthetic-only" };
function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
function registerPage(): unknown {
  return { items: [{ id: "AST-001", tag: "V-101", name: "Synthetic vessel" }],
    pageInfo: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasNextPage: false } };
}
function detail(): unknown {
  return { asset: { id: "AST-001", tag: "V-101", name: "Synthetic vessel" },
    revision: { id: "rev_7", label: "7", state: "RELEASED",
      changedAt: "2026-10-28T10:00:00Z", sourceReference: "source-controlled" },
    governingRevisionId: "rev_7" };
}
function evidence(): unknown {
  return { assetId: "AST-001", viewRevisionId: "rev_7", group: "DISPLAYED_REVISION",
    snapshotKey: "s1", nextCursor: null, items: [{ id: "ev-1", revisionId: "rev_7",
      kind: "DOCUMENT", association: "ASSOCIATED", availability: "AVAILABLE",
      quality: "UNKNOWN", sourceReference: "ref-one", basisReference: null,
      recordedAt: "2026-10-28T10:00:00Z" }] };
}
function makeBoundary(fetchImpl: typeof fetch): AuthSessionBoundary {
  const b = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl });
  all.add(b); return b;
}

describe("Stage 45.6 — integrated Asset investigation regression", () => {
  it("clears exact-record detail on same-query register refresh, even if the ID remains", async () => {
    const calls: string[] = [];
    const b = makeBoundary(async input => {
      const url = String(input); calls.push(url);
      if (url.includes("/v1/assets/AST-001/evidence")) return ok(evidence());
      if (url.endsWith("/v1/assets/AST-001")) return ok(detail());
      return ok(registerPage());
    });
    render(<AuthenticatedAssetInvestigation boundary={b} />);
    act(() => b.activate(identity));
    fireEvent.click(await screen.findByRole("button", { name: /Open V-101/ }));
    await waitFor(() => expect(screen.getByText("source-controlled")).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/ev-1/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Refresh Asset Register" }));
    // Selection is bound to the previous validated page object, not only to
    // an asset ID which might be reused under a new source generation.
    await waitFor(() => expect(screen.queryByRole("region", { name: "Selected Asset Detail" })).toBeNull());
    await screen.findByRole("button", { name: /Open V-101/ });
    expect(screen.queryByText("source-controlled")).toBeNull();
    expect(calls.filter(url => url.includes("/v1/assets?")).length).toBeGreaterThanOrEqual(2);
  });
  it("displays authorization failure rather than an empty Asset Detail", async () => {
    const b = makeBoundary(async input => String(input).endsWith("/AST-001")
      ? new Response("", { status: 403 }) : ok(registerPage()));
    render(<AuthenticatedAssetInvestigation boundary={b} />);
    act(() => b.activate(identity));
    fireEvent.click(await screen.findByRole("button", { name: /Open V-101/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("access denied"));
    expect(screen.queryByText("source-controlled")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry Asset Detail" })).toBeNull();
  });
  it("removes evidence and detail when the authenticated session expires", async () => {
    const b = makeBoundary(async input => {
      const url = String(input);
      if (url.includes("/evidence")) return ok(evidence());
      return ok(url.endsWith("/AST-001") ? detail() : registerPage());
    });
    render(<AuthenticatedAssetInvestigation boundary={b} />);
    act(() => b.activate(identity));
    fireEvent.click(await screen.findByRole("button", { name: /Open V-101/ }));
    await waitFor(() => expect(screen.getByText(/ev-1/)).toBeTruthy());
    act(() => b.transition("expired"));
    expect(screen.queryByText(/ev-1/)).toBeNull();
    expect(screen.queryByText("source-controlled")).toBeNull();
  });
});
