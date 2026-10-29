// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import { AuthenticatedAssetInvestigation } from "../AuthenticatedAssetInvestigation";
import { createControlledAssetApi } from "./controlledAssetApi";

const boundaries = new Set<AuthSessionBoundary>();
afterEach(() => { cleanup(); boundaries.forEach(boundary => boundary.dispose()); boundaries.clear(); });

function setup(site: "a" | "b" = "a") {
  const fixture = createControlledAssetApi();
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: fixture.fetchImpl });
  boundaries.add(boundary);
  render(<AuthenticatedAssetInvestigation boundary={boundary} />);
  act(() => boundary.activate({ subjectKey: "synthetic", tenantKey: `site-${site}`,
    sessionKey: "synthetic-session", getAccessToken: () => `fixture-site-${site}` }));
  return { boundary, fixture };
}

describe("Stage 45.7 controlled React Asset investigation", () => {
  it("opens authorized detail, separates revision scope, and navigates evidence pages", async () => {
    const { fixture } = setup();
    fireEvent.click(await screen.findByRole("button", { name: /Open V-101/ }));
    const detail = await screen.findByRole("region", { name: "Selected Asset Detail" });
    await waitFor(() => expect(within(detail).getByText("synthetic-review-source")).toBeTruthy());
    expect(within(detail).getByText("rev_7")).toBeTruthy();
    await screen.findByText(/Page 1; 20 reference/);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText(/Page 2; 1 reference/);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await screen.findByText(/Page 1; 20 reference/);
    fireEvent.click(screen.getByRole("radio", { name: "Historical predecessors" }));
    await waitFor(() => expect(screen.getByText(/ev_rev_7_1/)).toBeTruthy());
    expect(fixture.requests().some(request => request.route === "evidence")).toBe(true);
  });

  it("restarts an expired evidence cursor without presenting an empty success", async () => {
    const { fixture } = setup();
    fireEvent.click(await screen.findByRole("button", { name: /Open V-101/ }));
    await screen.findByText(/Page 1; 20 reference/);
    fixture.rotateEvidenceGeneration();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("source generation changed"));
    fireEvent.click(screen.getByRole("button", { name: "Restart evidence from page 1" }));
    await screen.findByText(/Page 1; 20 reference/);
  });

  it("keeps forbidden Asset Detail unavailable even when listed", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Open V-102/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("access denied"));
    expect(screen.queryByText("synthetic-review-source")).toBeNull();
  });

  it("discards selected details and evidence after session revocation", async () => {
    const { boundary } = setup();
    fireEvent.click(await screen.findByRole("button", { name: /Open V-101/ }));
    await screen.findByText(/ev_rev_8_1$/);
    act(() => boundary.transition("revoked"));
    expect(screen.queryByText(/ev_rev_8_1$/)).toBeNull();
    expect(screen.queryByText("synthetic-review-source")).toBeNull();
  });
});
