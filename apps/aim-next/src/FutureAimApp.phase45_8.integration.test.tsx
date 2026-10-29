// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FutureAimApp from "./FutureAimApp";
import { ASSET_INVESTIGATION_HASH } from "./shared/data/assetInvestigationNavigation";
import { createControlledAssetApi } from "./shared/data/fixtures/controlledAssetApi";
import { createAuthSessionBoundary, type AuthSessionBoundary } from "@bandha/aim-platform/auth/authSession";
import { SCREEN_BY_ID } from "./screenRegistry";

const boundaries = new Set<AuthSessionBoundary>();
function navigate(hash: string) {
  window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
  fireEvent(window, new Event("hashchange"));
}
function setup() {
  const fixture = createControlledAssetApi();
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: fixture.fetchImpl });
  boundaries.add(boundary);
  const view = render(<FutureAimApp assetInvestigationBoundary={boundary} navigationScopeKey="synthetic-site-a" />);
  act(() => boundary.activate({ subjectKey: "synthetic-user", tenantKey: "site-a", sessionKey: "fixture-session", getAccessToken: () => "fixture-site-a" }));
  return { fixture, boundary, view };
}
afterEach(() => {
  cleanup();
  for (const boundary of boundaries) boundary.dispose();
  boundaries.clear();
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
});

describe("Phase 45.8 optional investigation navigation", () => {
  it("does not expose an authorized route or fetch when no boundary is supplied", async () => {
    navigate(ASSET_INVESTIGATION_HASH);
    render(<FutureAimApp navigationScopeKey="synthetic-site-a" />);
    expect(screen.queryByRole("button", { name: "Authorized Asset investigation" })).toBeNull();
    expect(await screen.findByRole("heading", { name: /One integrity system/i })).toBeTruthy();
    expect(SCREEN_BY_ID.size).toBe(78);
  });

  it("does not expose the route when a boundary is supplied without trusted navigation scope", () => {
    const fixture = createControlledAssetApi();
    const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: fixture.fetchImpl });
    boundaries.add(boundary);
    navigate(ASSET_INVESTIGATION_HASH);
    render(<FutureAimApp assetInvestigationBoundary={boundary} />);
    expect(screen.queryByRole("button", { name: "Authorized Asset investigation" })).toBeNull();
    expect(screen.getByRole("heading", { name: /One integrity system/i })).toBeTruthy();
    expect(fixture.requests()).toHaveLength(0);
  });

  it("loads only after entering the opt-in route, and returns to the canonical AIR screen", async () => {
    const { fixture, view } = setup();
    expect(fixture.requests()).toHaveLength(0);
    fireEvent.click(within(screen.getByLabelText("Primary navigation"))
      .getByRole("button", { name: "Authorized Asset investigation" }));
    expect(window.location.hash).toBe(ASSET_INVESTIGATION_HASH);
    expect(await screen.findByRole("heading", { name: "Asset investigation" })).toBeTruthy();
    const open = await screen.findByRole("button", { name: /Open V-101/ });
    fireEvent.click(open);
    const detail = await screen.findByRole("region", { name: "Selected Asset Detail" });
    await waitFor(() => expect(within(detail).getByText("synthetic-review-source")).toBeTruthy());
    expect(fixture.requests().some(request => request.route === "detail")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Return to Asset Register screen" }));
    expect(window.location.hash).toBe("#/screens/SCR-AIR-001");
    expect(screen.queryByRole("region", { name: "Selected Asset Detail" })).toBeNull();
    expect(view.container.querySelector(".next-screen-preview .next-section-head h2")?.textContent).toBe("Asset Register");
  });

  it("supports back/forward hash navigation without promoting the synthetic fixture into the default app", async () => {
    setup();
    navigate(ASSET_INVESTIGATION_HASH);
    expect(await screen.findByRole("heading", { name: "Asset investigation" })).toBeTruthy();
    navigate("#/screens/SCR-RBI-001");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Asset investigation" })).toBeNull());
    navigate(ASSET_INVESTIGATION_HASH);
    expect(await screen.findByRole("heading", { name: "Asset investigation" })).toBeTruthy();
  });

  it("removes detail and the opt-in route after trusted navigation scope is withdrawn", async () => {
    const { boundary, view } = setup();
    navigate(ASSET_INVESTIGATION_HASH);
    fireEvent.click(await screen.findByRole("button", { name: /Open V-101/ }));
    await screen.findByText("synthetic-review-source");
    act(() => boundary.transition("revoked"));
    await waitFor(() => expect(screen.queryByText("synthetic-review-source")).toBeNull());
    view.rerender(<FutureAimApp assetInvestigationBoundary={boundary} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /One integrity system/i })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Authorized Asset investigation" })).toBeNull();
  });
});
