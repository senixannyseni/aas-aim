// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import { AuthenticatedAssetInvestigation } from "./AuthenticatedAssetInvestigation";

const boundaries = new Set<AuthSessionBoundary>();
afterEach(() => { cleanup(); for (const boundary of boundaries) boundary.dispose(); boundaries.clear(); });

describe("Stage 45.4 — standalone authorized asset investigation", () => {
  it("opens only the selected Asset Detail, then clears it on sign-out", async () => {
    const calls: string[] = [];
    const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: async input => {
      calls.push(String(input));
      const url = String(input);
      const body = url.includes("/v1/assets/AST-001") ? {
        asset: { id: "AST-001", tag: "V-101", name: "Synthetic vessel" },
        revision: { id: "rev_7", label: "7", state: "RELEASED",
          changedAt: "2026-10-28T10:00:00Z", sourceReference: "fixture" },
        governingRevisionId: "rev_7",
      } : { items: [{ id: "AST-001", tag: "V-101", name: "Synthetic vessel" }],
        pageInfo: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasNextPage: false } };
      return new Response(JSON.stringify(body), {
        status: 200, headers: { "content-type": "application/json" },
      });
    } });
    boundaries.add(boundary);
    render(<AuthenticatedAssetInvestigation boundary={boundary} />);
    act(() => boundary.activate({ subjectKey: "test-user", tenantKey: "tenant-a",
      sessionKey: "test-session", getAccessToken: () => "test-token" }));
    await screen.findByRole("button", { name: /Open V-101/ });
    fireEvent.click(screen.getByRole("button", { name: /Open V-101/ }));
    await waitFor(() => expect(screen.getAllByText("rev_7").length).toBeGreaterThan(0));
    expect(calls).toContain("/api/v1/assets/AST-001");
    act(() => boundary.transition("signed-out"));
    expect(screen.queryAllByText("rev_7")).toHaveLength(0);
  });
});
