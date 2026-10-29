// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AssetRegister,
  filterAssetRegisterRecords,
  paginateAssetRegisterRecords,
  type AssetRegisterFilters,
  type AssetRegisterRecord,
  type AssetRegisterState,
} from "./AssetRegister";

/**
 * Browser-level regression specifications for the read-only Asset Register.
 *
 * The records below are synthetic TEST FIXTURES ONLY. No tests imply an AIM
 * backend connection, asset safety, data provenance, tenant authorization,
 * or server-side search/pagination guarantees. Data entering this component
 * must be validated at the future versioned API boundary.
 *
 * jsdom verifies DOM behavior, not actual responsive layout or contrast.
 */
afterEach(() => cleanup());

const fixtureAssets: readonly AssetRegisterRecord[] = [
  {
    id: "AST-001", tag: "V-101", name: "Pressure Vessel Alpha",
    assetType: "Pressure vessel", location: "Unit A",
    riskStatus: "CRITICAL", evidenceStatus: "VALID",
  },
  {
    id: "AST-002", tag: "P-202", name: "Feed Pump Beta",
    assetType: "Pump", location: "Unit B",
    riskStatus: "UNKNOWN", evidenceStatus: "STALE",
  },
  {
    id: "AST-003", tag: "E-303", name: "Heat Exchanger Gamma",
    assetType: "Exchanger", location: "Unit A",
    riskStatus: null, evidenceStatus: null,
  },
  {
    id: "AST-004", tag: "TK-404", name: "Storage Tank Delta",
    assetType: "Tank", location: "Unit C",
    riskStatus: "LOW", evidenceStatus: "UNKNOWN",
  },
  {
    id: "AST-005", tag: "C-505", name: "Compressor Epsilon",
    riskStatus: "HIGH", evidenceStatus: "INVALID",
  },
] as const;

const ALL: AssetRegisterFilters = {
  search: "", risk: "ALL", evidence: "ALL",
};

function makeAssets(count: number): readonly AssetRegisterRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const serial = String(index + 1).padStart(3, "0");
    return {
      id: `AST-${serial}`,
      tag: `TAG-${serial}`,
      name: `Test Asset ${serial}`,
      assetType: "Test equipment",
      location: "Test Area",
      riskStatus: "LOW",
      evidenceStatus: "VALID",
    };
  });
}

function renderReady(assets: readonly AssetRegisterRecord[] = fixtureAssets) {
  return render(<AssetRegister state={{ kind: "ready", assets }} />);
}

function registerRegion() {
  return screen.getByRole("region", { name: "Asset register" });
}

function registerTable() {
  return screen.getByRole("table", {
    name: /Asset records supplied to this browser session/,
  });
}

function tagsInTable(): string[] {
  return within(registerTable())
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent ?? "");
}

function search(value: string): void {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search assets" }), {
    target: { value },
  });
}

function selectFilter(name: string, value: string): void {
  fireEvent.change(screen.getByRole("combobox", { name }), {
    target: { value },
  });
}

function expectCount(fragment: string): void {
  expect(screen.getByText((text) => text.includes(fragment))).toBeDefined();
}

describe("AssetRegister — deterministic filtering contract", () => {
  it("returns every record when filters are ALL and search is empty", () => {
    const result = filterAssetRegisterRecords(fixtureAssets, ALL);
    expect(result).toHaveLength(5);
    expect(result.map((asset) => asset.id)).toEqual(fixtureAssets.map((asset) => asset.id));
  });

  it("searches the asset ID, tag, name, type, and location", () => {
    for (const query of ["AST-001", "V-101", "alpha", "Pressure vessel", "Unit A"]) {
      const ids = filterAssetRegisterRecords(fixtureAssets, { ...ALL, search: query })
        .map((asset) => asset.id);
      expect(ids).toContain("AST-001");
    }
  });

  it("ignores case and outer whitespace in search", () => {
    const result = filterAssetRegisterRecords(fixtureAssets, {
      ...ALL, search: "   v-101   ",
    });
    expect(result.map((asset) => asset.id)).toEqual(["AST-001"]);
  });

  it("requires all whitespace-separated terms to match, regardless of field", () => {
    const result = filterAssetRegisterRecords(fixtureAssets, {
      ...ALL, search: "unit A vessel",
    });
    expect(result.map((asset) => asset.id)).toEqual(["AST-001"]);
  });

  it("returns no records for a search that matches nothing", () => {
    expect(filterAssetRegisterRecords(fixtureAssets, {
      ...ALL, search: "NOT-A-REAL-ASSET",
    })).toEqual([]);
  });

  it("filters an explicit UNKNOWN risk independently of missing risk", () => {
    const unknown = filterAssetRegisterRecords(fixtureAssets, { ...ALL, risk: "UNKNOWN" });
    const missing = filterAssetRegisterRecords(fixtureAssets, { ...ALL, risk: "NOT_PROVIDED" });
    expect(unknown.map((asset) => asset.id)).toEqual(["AST-002"]);
    expect(missing.map((asset) => asset.id)).toEqual(["AST-003"]);
  });

  it("filters explicit UNKNOWN evidence independently of missing evidence", () => {
    const unknown = filterAssetRegisterRecords(fixtureAssets, { ...ALL, evidence: "UNKNOWN" });
    const missing = filterAssetRegisterRecords(fixtureAssets, { ...ALL, evidence: "NOT_PROVIDED" });
    expect(unknown.map((asset) => asset.id)).toEqual(["AST-004"]);
    expect(missing.map((asset) => asset.id)).toEqual(["AST-003"]);
  });

  it("treats absent optional statuses as NOT_PROVIDED", () => {
    const absent: AssetRegisterRecord = { id: "A", tag: "A", name: "Absent statuses" };
    const result = filterAssetRegisterRecords([absent], {
      ...ALL, risk: "NOT_PROVIDED", evidence: "NOT_PROVIDED",
    });
    expect(result).toHaveLength(1);
  });

  it("retains valid evidence even when asset risk is critical", () => {
    const result = filterAssetRegisterRecords(fixtureAssets, {
      ...ALL, risk: "CRITICAL", evidence: "VALID",
    });
    expect(result.map((asset) => asset.id)).toEqual(["AST-001"]);
  });

  it("combines search and both filters as a logical AND", () => {
    expect(filterAssetRegisterRecords(fixtureAssets, {
      search: "pump unit B", risk: "UNKNOWN", evidence: "STALE",
    }).map((asset) => asset.id)).toEqual(["AST-002"]);
    expect(filterAssetRegisterRecords(fixtureAssets, {
      search: "pump unit B", risk: "LOW", evidence: "STALE",
    })).toHaveLength(0);
  });

  it("does not modify its input array or records", () => {
    const frozen = Object.freeze(fixtureAssets.map((asset) => Object.freeze({ ...asset })));
    filterAssetRegisterRecords(frozen, { ...ALL, search: "unit" });
    expect(frozen.map((asset) => asset.id)).toEqual(fixtureAssets.map((asset) => asset.id));
  });

  it("preserves the original source order in the filtered result", () => {
    const result = filterAssetRegisterRecords(fixtureAssets, {
      ...ALL, search: "Unit",
    });
    expect(result.map((asset) => asset.id)).toEqual(["AST-001", "AST-002", "AST-003", "AST-004"]);
  });
});

describe("AssetRegister — deterministic pagination contract", () => {
  it("returns the first ten records by default-sized page", () => {
    const result = paginateAssetRegisterRecords(makeAssets(23), 1, 10);
    expect(result.items).toHaveLength(10);
    expect(result.items[0]?.id).toBe("AST-001");
    expect([result.first, result.last, result.page, result.pageCount]).toEqual([1, 10, 1, 3]);
  });

  it("returns the correct second and final pages", () => {
    const records = makeAssets(23);
    const middle = paginateAssetRegisterRecords(records, 2, 10);
    const last = paginateAssetRegisterRecords(records, 3, 10);
    expect([middle.first, middle.last, middle.items[0]?.id]).toEqual([11, 20, "AST-011"]);
    expect([last.first, last.last, last.items.length]).toEqual([21, 23, 3]);
  });

  it("clamps requested pages that exceed the last page", () => {
    const result = paginateAssetRegisterRecords(makeAssets(11), 99, 10);
    expect([result.page, result.pageCount, result.first, result.last]).toEqual([2, 2, 11, 11]);
  });

  it("returns an empty page with zero-based counts but a defined page number", () => {
    const result = paginateAssetRegisterRecords([], 1, 10);
    expect(result).toEqual({ items: [], page: 1, pageCount: 1, first: 0, last: 0 });
  });

  it("supports 10, 25, and 50 rows per page", () => {
    const records = makeAssets(60);
    expect(paginateAssetRegisterRecords(records, 1, 10).items).toHaveLength(10);
    expect(paginateAssetRegisterRecords(records, 1, 25).items).toHaveLength(25);
    expect(paginateAssetRegisterRecords(records, 1, 50).items).toHaveLength(50);
  });

  it("rejects zero, negative, fractional, or nonfinite page numbers", () => {
    for (const page of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => paginateAssetRegisterRecords(makeAssets(3), page, 10)).toThrow(RangeError);
    }
  });

  it("rejects an unsupported page size even when runtime data bypasses typing", () => {
    // @ts-expect-error 15 is intentionally not a supported page size
    expect(() => paginateAssetRegisterRecords(makeAssets(3), 1, 15)).toThrow(RangeError);
  });

  it("never mutates or reorders the source records", () => {
    const records = Object.freeze(makeAssets(25));
    paginateAssetRegisterRecords(records, 2, 10);
    expect(records[0]?.id).toBe("AST-001");
    expect(records[24]?.id).toBe("AST-025");
  });
});

describe("AssetRegister — structure, load states and safe errors", () => {
  it("exposes an accessible named section and descriptive heading", () => {
    render(<AssetRegister state={{ kind: "empty" }} />);
    const region = registerRegion();
    const heading = screen.getByRole("heading", { name: "Asset register", level: 2 });
    const description = screen.getByText("Browse supplied asset records and reported classifications");
    expect(region.id).toBe("asset-register");
    expect(region.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(region.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("marks loading as busy and announces loading without displaying stale rows", () => {
    render(<AssetRegister state={{ kind: "loading" }} />);
    expect(registerRegion().getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Loading asset register");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("shows a clear empty state when no records are available", () => {
    render(<AssetRegister state={{ kind: "empty" }} />);
    expect(screen.getByText("No assets available.")).toBeDefined();
    expect(registerRegion().getAttribute("aria-busy")).toBe("false");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows explicitly supplied empty-state explanation verbatim as text", () => {
    render(<AssetRegister state={{ kind: "empty", detail: "API not connected." }} />);
    expect(screen.getByText("API not connected.")).toBeDefined();
  });

  it("treats a ready state with zero assets as empty, with no filters", () => {
    renderReady([]);
    expect(screen.getByText("No assets available.")).toBeDefined();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a generic error without rendering asset rows or raw server details", () => {
    render(<AssetRegister state={{ kind: "error" }} />);
    expect(screen.getByRole("alert").textContent).toContain("could not be loaded");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry loading" })).toBeNull();
  });

  it("offers retry only when provided and invokes it exactly once", () => {
    const onRetry = vi.fn();
    render(<AssetRegister state={{ kind: "error", onRetry }} />);
    const retry = screen.getByRole("button", { name: "Retry loading" }) as HTMLButtonElement;
    expect(retry.type).toBe("button");
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("removes previously rendered records when state becomes loading or error", () => {
    const { rerender } = renderReady();
    expect(registerTable()).toBeDefined();
    rerender(<AssetRegister state={{ kind: "loading" }} />);
    expect(screen.queryByRole("table")).toBeNull();
    rerender(<AssetRegister state={{ kind: "error" }} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("AssetRegister — table semantics, reported status and safe rendering", () => {
  it("displays one row per supplied asset plus a table header", () => {
    renderReady();
    expect(within(registerTable()).getAllByRole("row")).toHaveLength(6);
    expect(tagsInTable()).toEqual(["V-101", "P-202", "E-303", "TK-404", "C-505"]);
  });

  it("provides every expected named column header", () => {
    renderReady();
    for (const column of ["Asset tag", "Name", "Asset ID", "Type", "Location", "Risk", "Evidence"]) {
      expect(within(registerTable()).getByRole("columnheader", { name: column })).toBeDefined();
    }
  });

  it("exposes an accessible scrollable table region", () => {
    renderReady();
    const scrollable = screen.getByRole("region", { name: "Scrollable asset register table" });
    expect(scrollable.tabIndex).toBe(0);
    expect(scrollable.contains(registerTable())).toBe(true);
  });

  it("keeps critical risk and valid evidence visible as separate classifications", () => {
    renderReady();
    const row = within(registerTable()).getByRole("rowheader", { name: "V-101" }).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Risk: Critical")).toBeDefined();
    expect(within(row as HTMLElement).getByText("Evidence: Valid")).toBeDefined();
  });

  it("renders UNKNOWN distinctly from missing classification", () => {
    renderReady();
    const unknownRow = within(registerTable()).getByRole("rowheader", { name: "P-202" }).closest("tr");
    const missingRow = within(registerTable()).getByRole("rowheader", { name: "E-303" }).closest("tr");
    expect(within(unknownRow as HTMLElement).getByText("Risk: Unknown")).toBeDefined();
    expect(within(missingRow as HTMLElement).getAllByText("Not provided")).toHaveLength(2);
    expect(within(missingRow as HTMLElement).queryByText("Risk: Unknown")).toBeNull();
  });

  it("uses Not provided for absent optional type and location", () => {
    renderReady();
    const row = within(registerTable()).getByRole("rowheader", { name: "C-505" }).closest("tr");
    expect(within(row as HTMLElement).getAllByText("Not provided")).toHaveLength(2);
  });

  it("renders untrusted markup-like names as text, never as a DOM element", () => {
    const asset: AssetRegisterRecord = {
      id: "AST-X", tag: "X-001", name: '<img src=x onerror="alert(1)">',
    };
    renderReady([asset]);
    expect(registerTable().querySelector("img")).toBeNull();
    expect(within(registerTable()).getByText(asset.name)).toBeDefined();
  });

  it("discloses that statuses and local filtering do not grant engineering authority", () => {
    renderReady();
    expect(registerRegion().textContent).toContain("not equipment safety or approval decisions");
    expect(registerRegion().textContent).toContain("only records already provided");
  });
});

describe("AssetRegister — interactive search and filtering", () => {
  it("finds a record by case-insensitive tag", () => {
    renderReady();
    search("p-202");
    expect(tagsInTable()).toEqual(["P-202"]);
    expectCount("1–1 of 1 matching assets (5 total)");
  });

  it("searches across multiple fields with AND terms", () => {
    renderReady();
    search("unit a gamma");
    expect(tagsInTable()).toEqual(["E-303"]);
  });

  it("shows filter-no-results separately from no-assets-available", () => {
    renderReady();
    search("does-not-exist");
    expect(screen.getByRole("status").textContent).toContain("No assets match");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("No assets available.")).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Search assets" })).toBeDefined();
  });

  it("filters explicit unknown risk without including missing risk", () => {
    renderReady();
    selectFilter("Risk classification", "UNKNOWN");
    expect(tagsInTable()).toEqual(["P-202"]);
  });

  it("filters missing risk without including explicit UNKNOWN", () => {
    renderReady();
    selectFilter("Risk classification", "NOT_PROVIDED");
    expect(tagsInTable()).toEqual(["E-303"]);
  });

  it("filters explicit unknown evidence separately from missing evidence", () => {
    renderReady();
    selectFilter("Evidence status", "UNKNOWN");
    expect(tagsInTable()).toEqual(["TK-404"]);
    selectFilter("Evidence status", "NOT_PROVIDED");
    expect(tagsInTable()).toEqual(["E-303"]);
  });

  it("applies risk, evidence and free-text filters together", () => {
    renderReady();
    selectFilter("Risk classification", "CRITICAL");
    selectFilter("Evidence status", "VALID");
    search("unit a vessel");
    expect(tagsInTable()).toEqual(["V-101"]);
    selectFilter("Evidence status", "STALE");
    expect(screen.getByText("No assets match the current search and filters.")).toBeDefined();
  });

  it("restores matching rows when search and filters are reset", () => {
    renderReady();
    search("NOTHING");
    search("");
    expect(tagsInTable()).toHaveLength(5);
    selectFilter("Risk classification", "HIGH");
    expect(tagsInTable()).toEqual(["C-505"]);
    selectFilter("Risk classification", "ALL");
    expect(tagsInTable()).toHaveLength(5);
  });
});

describe("AssetRegister — interactive pagination and changing data", () => {
  it("displays ten rows on page one, with Previous disabled", () => {
    renderReady(makeAssets(23));
    expect(tagsInTable()).toHaveLength(10);
    expectCount("Showing 1–10 of 23 matching assets");
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it("advances page by page and disables Next on the final page", () => {
    renderReady(makeAssets(23));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(tagsInTable()[0]).toBe("TAG-011");
    expectCount("Showing 11–20 of 23 matching assets");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(tagsInTable()).toEqual(["TAG-021", "TAG-022", "TAG-023"]);
    expectCount("Showing 21–23 of 23 matching assets");
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it("navigates backwards without skipping pages", () => {
    renderReady(makeAssets(21));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(tagsInTable()[0]).toBe("TAG-001");
    expectCount("Showing 1–10 of 21 matching assets");
  });

  it("updates the selected row count and resets to page one", () => {
    renderReady(makeAssets(26));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    selectFilter("Rows per page", "25");
    expect(tagsInTable()).toHaveLength(25);
    expect(tagsInTable()[0]).toBe("TAG-001");
    expectCount("Showing 1–25 of 26 matching assets");
  });

  it("resets to page one when search changes", () => {
    renderReady(makeAssets(23));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    search("TAG-002");
    expect(tagsInTable()).toEqual(["TAG-002"]);
    expectCount("Showing 1–1 of 1 matching assets (23 total)");
  });

  it("resets to page one when risk filter changes", () => {
    const records: AssetRegisterRecord[] = makeAssets(21).map((asset, index) => ({
      ...asset, riskStatus: index === 20 ? "CRITICAL" : "LOW",
    }));
    renderReady(records);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    selectFilter("Risk classification", "CRITICAL");
    expect(tagsInTable()).toEqual(["TAG-021"]);
  });

  it("clamps the current page after new data reduces the result count", () => {
    const { rerender } = renderReady(makeAssets(23));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    rerender(<AssetRegister state={{ kind: "ready", assets: makeAssets(4) }} />);
    expect(tagsInTable()).toEqual(["TAG-001", "TAG-002", "TAG-003", "TAG-004"]);
    expectCount("Showing 1–4 of 4 matching assets");
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it("updates all displayed rows when the supplied dataset changes", () => {
    const { rerender } = renderReady(fixtureAssets.slice(0, 2));
    expect(tagsInTable()).toEqual(["V-101", "P-202"]);
    rerender(<AssetRegister state={{ kind: "ready", assets: fixtureAssets.slice(3) }} />);
    expect(tagsInTable()).toEqual(["TK-404", "C-505"]);
    expect(screen.queryByText("V-101")).toBeNull();
  });
});

describe("AssetRegister — compile-time state constraints", () => {
  it("accepts the four declared states as a discriminated union", () => {
    const states: readonly AssetRegisterState[] = [
      { kind: "loading" },
      { kind: "empty" },
      { kind: "error" },
      { kind: "ready", assets: fixtureAssets },
    ];
    expect(states.map((state) => state.kind)).toEqual(["loading", "empty", "error", "ready"]);
  });

  it("enforces the ready-state payload and status categories at compile time", () => {
    if (false) {
      // @ts-expect-error ready requires assets, not an asset field
      const missingReady: AssetRegisterState = { kind: "ready" };
      // @ts-expect-error risk statuses cannot be evidence statuses
      const wrongStatus: AssetRegisterRecord = { id: "A", name: "X", tag: "X", riskStatus: "VALID" };
      // @ts-expect-error invalid page sizes cannot be assigned
      const wrongPageSize: import("./AssetRegister").AssetRegisterPageSize = 15;
      void missingReady;
      void wrongStatus;
      void wrongPageSize;
    }
    expect(true).toBe(true);
  });
});
