// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AssetOverview,
  type AssetOverviewRecord,
  type AssetOverviewState,
} from "./AssetOverview";

/**
 * DOM-level regression tests for the presentation-only asset overview.
 *
 * These tests verify what is shown, what is deliberately withheld, and which
 * user actions are available. They do not validate untrusted server payloads,
 * prove asset integrity, authorize work, or establish an API connection.
 *
 * Keep jsdom scoped to this suite so non-React scientific formatting tests
 * continue to use the default Node test environment.
 */

afterEach(() => {
  cleanup();
});

const sampleAsset: AssetOverviewRecord = {
  id: "AST-001",
  tag: "V-101",
  name: "Test Vessel",
  assetType: "Pressure vessel",
  location: "Unit A",
  riskStatus: "CRITICAL",
  evidenceStatus: "STALE",
};

function renderReady(asset: AssetOverviewRecord = sampleAsset) {
  return render(<AssetOverview state={{ kind: "ready", asset }} />);
}

function fieldValue(region: HTMLElement, fieldName: string): string | null {
  const term = Array.from(region.querySelectorAll("dt")).find(
    (element) => element.textContent === fieldName,
  );
  expect(term, `Missing definition term: ${fieldName}`).toBeDefined();
  const value = term?.nextElementSibling;
  expect(value?.tagName).toBe("DD");
  return value?.textContent ?? null;
}

describe("AssetOverview — accessible region and loading state", () => {
  it("renders a named section with its visible heading and description", () => {
    render(<AssetOverview state={{ kind: "empty" }} />);

    const region = screen.getByRole("region", { name: "Asset context" });
    const heading = screen.getByRole("heading", { name: "Asset context", level: 2 });
    const description = screen.getByText("Selected asset and its governed evidence");

    expect(region.tagName).toBe("SECTION");
    expect(region.id).toBe("asset-context");
    expect(region.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(region.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("announces loading through role=status and aria-busy", () => {
    render(<AssetOverview state={{ kind: "loading" }} />);

    const region = screen.getByRole("region", { name: "Asset context" });
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(within(region).getByRole("status").textContent).toBe(
      "Loading asset context…",
    );
  });

  it("does not render asset fields, statuses or retry controls while loading", () => {
    render(<AssetOverview state={{ kind: "loading" }} />);

    const region = screen.getByRole("region", { name: "Asset context" });
    expect(region.querySelector("dl")).toBeNull();
    expect(within(region).queryByRole("group", { name: "Reported status information" })).toBeNull();
    expect(within(region).queryByRole("button")).toBeNull();
    expect(within(region).queryByRole("alert")).toBeNull();
  });
});

describe("AssetOverview — empty and error states", () => {
  it("shows a specific empty-state message rather than inventing an asset", () => {
    render(<AssetOverview state={{ kind: "empty" }} />);

    const region = screen.getByRole("region", { name: "Asset context" });
    expect(region.getAttribute("aria-busy")).toBe("false");
    expect(within(region).getByText("No asset selected.")).toBeDefined();
    expect(region.querySelector("dl")).toBeNull();
  });

  it("displays an explicitly provided empty-state explanation", () => {
    render(
      <AssetOverview
        state={{ kind: "empty", detail: "This prototype is not connected to an AIM API." }}
      />,
    );
    expect(screen.getByText("This prototype is not connected to an AIM API.")).toBeDefined();
  });

  it("does not insert a detail paragraph if none is provided", () => {
    render(<AssetOverview state={{ kind: "empty" }} />);
    const region = screen.getByRole("region", { name: "Asset context" });
    expect(region.querySelectorAll(".aim-asset-overview__message p")).toHaveLength(1);
  });

  it("keeps an empty state free of error and busy announcements", () => {
    render(<AssetOverview state={{ kind: "empty" }} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a safe error disclosure in an alert, without displaying an asset", () => {
    render(<AssetOverview state={{ kind: "error" }} />);

    const region = screen.getByRole("region", { name: "Asset context" });
    const alert = within(region).getByRole("alert");
    expect(alert.textContent).toContain(
      "Asset context could not be loaded. No asset information is shown.",
    );
    expect(region.getAttribute("aria-busy")).toBe("false");
    expect(region.querySelector("dl")).toBeNull();
  });

  it("does not invent a Retry button when no retry callback exists", () => {
    render(<AssetOverview state={{ kind: "error" }} />);
    expect(screen.queryByRole("button", { name: "Retry loading" })).toBeNull();
  });

  it("renders an explicit secondary Retry button when a callback exists", () => {
    render(<AssetOverview state={{ kind: "error", onRetry: vi.fn() }} />);
    const button = screen.getByRole("button", { name: "Retry loading" }) as HTMLButtonElement;
    expect(button.type).toBe("button");
    expect(button.classList.contains("aim-button--secondary")).toBe(true);
    expect(button.disabled).toBe(false);
  });

  it("invokes the provided retry callback exactly once per activation", () => {
    const onRetry = vi.fn();
    render(<AssetOverview state={{ kind: "error", onRetry }} />);
    screen.getByRole("button", { name: "Retry loading" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("removes error alert and retry controls when the state becomes empty", () => {
    const { rerender } = render(
      <AssetOverview state={{ kind: "error", onRetry: vi.fn() }} />,
    );
    rerender(<AssetOverview state={{ kind: "empty" }} />);

    expect(screen.getByText("No asset selected.")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("AssetOverview — available data presentation", () => {
  it("renders the five asset attributes as a semantic definition list", () => {
    renderReady();
    const region = screen.getByRole("region", { name: "Asset context" });
    const list = region.querySelector("dl");
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll("dt")).toHaveLength(5);
    expect(list?.querySelectorAll("dd")).toHaveLength(5);
  });

  it("displays the supplied identity fields unchanged", () => {
    renderReady();
    const region = screen.getByRole("region", { name: "Asset context" });
    expect(fieldValue(region, "Asset name")).toBe("Test Vessel");
    expect(fieldValue(region, "Asset tag")).toBe("V-101");
    expect(fieldValue(region, "Asset ID")).toBe("AST-001");
  });

  it("displays optional asset type and location when provided", () => {
    renderReady();
    const region = screen.getByRole("region", { name: "Asset context" });
    expect(fieldValue(region, "Asset type")).toBe("Pressure vessel");
    expect(fieldValue(region, "Location")).toBe("Unit A");
  });

  it("uses Not provided when optional attributes are omitted", () => {
    renderReady({ id: "A-1", tag: "T-1", name: "Example" });
    const region = screen.getByRole("region", { name: "Asset context" });
    expect(fieldValue(region, "Asset type")).toBe("Not provided");
    expect(fieldValue(region, "Location")).toBe("Not provided");
  });

  it("uses Not provided for explicitly null optional attributes", () => {
    renderReady({ ...sampleAsset, assetType: null, location: null });
    const region = screen.getByRole("region", { name: "Asset context" });
    expect(fieldValue(region, "Asset type")).toBe("Not provided");
    expect(fieldValue(region, "Location")).toBe("Not provided");
  });

  it("uses Not provided for blank or whitespace-only attributes", () => {
    renderReady({
      ...sampleAsset,
      id: "  ",
      tag: "",
      name: "\t",
      assetType: "  ",
      location: "\n",
    });
    const region = screen.getByRole("region", { name: "Asset context" });
    for (const label of ["Asset name", "Asset tag", "Asset ID", "Asset type", "Location"]) {
      expect(fieldValue(region, label)).toBe("Not provided");
    }
  });

  it("keeps the status information in a separately named group", () => {
    renderReady();
    const group = screen.getByRole("group", { name: "Reported status information" });
    expect(within(group).getByText("Risk classification")).toBeDefined();
    expect(within(group).getByText("Evidence status")).toBeDefined();
  });

  it("does not invent risk or evidence status when neither was provided", () => {
    renderReady({ id: "A-1", tag: "T-1", name: "Example" });
    const group = screen.getByRole("group", { name: "Reported status information" });
    expect(within(group).getAllByText("Not provided")).toHaveLength(2);
    expect(group.querySelectorAll(".aim-status-badge")).toHaveLength(0);
  });

  it("does not invent an evidence classification if only risk is supplied", () => {
    renderReady({ ...sampleAsset, evidenceStatus: null });
    const group = screen.getByRole("group", { name: "Reported status information" });
    expect(within(group).getByText("Risk: Critical")).toBeDefined();
    expect(within(group).getByText("Not provided")).toBeDefined();
    expect(group.querySelectorAll(".aim-status-badge")).toHaveLength(1);
  });

  it("does not invent a risk classification if only evidence is supplied", () => {
    renderReady({ ...sampleAsset, riskStatus: null });
    const group = screen.getByRole("group", { name: "Reported status information" });
    expect(within(group).getByText("Not provided")).toBeDefined();
    expect(within(group).getByText("Evidence: Stale")).toBeDefined();
    expect(group.querySelectorAll(".aim-status-badge")).toHaveLength(1);
  });

  it("renders provided risk and evidence as different badge classes", () => {
    renderReady();
    const group = screen.getByRole("group", { name: "Reported status information" });
    expect(within(group).getByText("Risk: Critical").classList.contains(
      "aim-status-badge--risk-critical",
    )).toBe(true);
    expect(within(group).getByText("Evidence: Stale").classList.contains(
      "aim-status-badge--evidence-stale",
    )).toBe(true);
  });

  it("displays explicit UNKNOWN statuses rather than Not provided", () => {
    renderReady({ ...sampleAsset, riskStatus: "UNKNOWN", evidenceStatus: "UNKNOWN" });
    const group = screen.getByRole("group", { name: "Reported status information" });
    expect(within(group).getByText("Risk: Unknown")).toBeDefined();
    expect(within(group).getByText("Evidence: Unknown")).toBeDefined();
    expect(within(group).queryByText("Not provided")).toBeNull();
  });

  it("does not equate valid evidence with low risk or engineering acceptance", () => {
    renderReady({ ...sampleAsset, riskStatus: "CRITICAL", evidenceStatus: "VALID" });
    const group = screen.getByRole("group", { name: "Reported status information" });
    expect(within(group).getByText("Risk: Critical")).toBeDefined();
    expect(within(group).getByText("Evidence: Valid")).toBeDefined();
    expect(within(group).queryByText("Risk: Low")).toBeNull();
  });

  it("always includes the explicit engineering safety and approval disclaimer", () => {
    renderReady();
    expect(screen.getByText(
      "Displayed statuses are reported values, not an engineering safety or approval decision.",
    )).toBeDefined();
  });

  it("does not expose markup supplied inside a view-model text field as HTML", () => {
    renderReady({ ...sampleAsset, name: "<script>invalid markup</script>" });
    const region = screen.getByRole("region", { name: "Asset context" });
    expect(fieldValue(region, "Asset name")).toBe("<script>invalid markup</script>");
    expect(region.querySelector("script")).toBeNull();
  });

  it("keeps the card non-busy and avoids loading or error announcements when ready", () => {
    renderReady();
    const region = screen.getByRole("region", { name: "Asset context" });
    expect(region.getAttribute("aria-busy")).toBe("false");
    expect(within(region).queryByRole("status")).toBeNull();
    expect(within(region).queryByRole("alert")).toBeNull();
  });

  it("updates the displayed asset without retaining previous record or status", () => {
    const { rerender } = renderReady();
    const updated: AssetOverviewRecord = {
      id: "AST-002",
      tag: "P-202",
      name: "Another Asset",
      riskStatus: "LOW",
      evidenceStatus: "VALID",
    };
    rerender(<AssetOverview state={{ kind: "ready", asset: updated }} />);

    const region = screen.getByRole("region", { name: "Asset context" });
    expect(fieldValue(region, "Asset ID")).toBe("AST-002");
    expect(fieldValue(region, "Asset tag")).toBe("P-202");
    expect(within(region).getByText("Risk: Low")).toBeDefined();
    expect(within(region).getByText("Evidence: Valid")).toBeDefined();
    expect(within(region).queryByText("Test Vessel")).toBeNull();
    expect(within(region).queryByText("Risk: Critical")).toBeNull();
  });

  it("clears previously rendered asset data when returning to loading", () => {
    const { rerender } = renderReady();
    rerender(<AssetOverview state={{ kind: "loading" }} />);

    const region = screen.getByRole("region", { name: "Asset context" });
    expect(region.querySelector("dl")).toBeNull();
    expect(within(region).queryByText("Test Vessel")).toBeNull();
    expect(region.getAttribute("aria-busy")).toBe("true");
  });
});

// Deliberate compilation failures: the discriminated-state and status types
// must prevent invalid combinations even before an API adapter exists.
if (false) {
  // @ts-expect-error A ready state must provide an asset record.
  const readyWithoutAsset: AssetOverviewState = { kind: "ready" };
  void readyWithoutAsset;

  // @ts-expect-error A loading state cannot masquerade as an asset-bearing state.
  const loadingWithAsset: AssetOverviewState = { kind: "loading", asset: sampleAsset };
  void loadingWithAsset;

  // @ts-expect-error A risk status cannot be an evidence-quality status.
  const wrongRisk: AssetOverviewRecord = { ...sampleAsset, riskStatus: "INVALID" };
  void wrongRisk;

  // @ts-expect-error An evidence status cannot be a risk classification.
  const wrongEvidence: AssetOverviewRecord = { ...sampleAsset, evidenceStatus: "CRITICAL" };
  void wrongEvidence;

  // @ts-expect-error A record requires a stable identity.
  const noId: AssetOverviewRecord = { tag: "P-1", name: "Pump" };
  void noId;
}
