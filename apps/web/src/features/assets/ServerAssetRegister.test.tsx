// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseAssetRegisterPage, type AdaptedAssetPage } from "./assetRegisterAdapter";
import {
  matchesRequestedAssetPage,
  ServerAssetRegister,
  type ServerAssetRegisterQuery,
  type ServerAssetRegisterState,
} from "./ServerAssetRegister";

/**
 * File 43 — DOM and query-contract regression tests for the CONTROLLED view.
 *
 * All asset records and provenance below are synthetic test fixtures. The
 * parent owns API requests, cancellation, authentication, authorization,
 * decoding, and request epochs. These tests do not prove backend behavior,
 * real browser layout, or the authenticity of source records.
 */
afterEach(() => cleanup());

const BASE_QUERY: ServerAssetRegisterQuery = Object.freeze({
  page: 1,
  pageSize: 10,
  search: "",
  risk: "ALL",
  evidence: "ALL",
});

function query(overrides: Partial<ServerAssetRegisterQuery> = {}): ServerAssetRegisterQuery {
  return { ...BASE_QUERY, ...overrides };
}

function wireAsset(index: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const key = String(index).padStart(3, "0");
  return {
    id: `AST-${key}`,
    tag: `V-${key}`,
    name: `Test asset ${key}`,
    assetType: "Pressure vessel",
    location: "Synthetic Unit A",
    riskClassification: {
      level: "CRITICAL",
      basisRecordId: `RISK-BASIS-${key}`,
      assessedAt: "2026-10-20T09:00:00+07:00",
    },
    evidenceAssessment: {
      state: "VALID",
      basisRecordId: `EVID-BASIS-${key}`,
      evaluatedAt: "2026-10-20T08:00:00Z",
    },
    ...overrides,
  };
}

/** Build fixtures THROUGH the actual API adapter, never cast raw JSON to a page. */
function validatedPage(
  items: unknown[] = [wireAsset(1)],
  options: { page?: number; pageSize?: 10 | 25 | 50; totalItems?: number } = {},
): AdaptedAssetPage {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  const totalItems = options.totalItems ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const result = parseAssetRegisterPage({
    items,
    pageInfo: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
    },
  });
  if (!result.ok) {
    throw new Error(`Invalid synthetic page fixture: ${JSON.stringify(result.issues)}`);
  }
  return result.page;
}

function ready(
  page: AdaptedAssetPage = validatedPage(),
  forQuery: ServerAssetRegisterQuery = BASE_QUERY,
): ServerAssetRegisterState {
  return { kind: "ready", page, forQuery };
}

function mount(
  state: ServerAssetRegisterState = ready(),
  requested: ServerAssetRegisterQuery = BASE_QUERY,
) {
  const onQueryChange = vi.fn<(next: ServerAssetRegisterQuery) => void>();
  const view = render(
    <ServerAssetRegister
      query={requested}
      state={state}
      onQueryChange={onQueryChange}
    />,
  );
  return { ...view, onQueryChange };
}

function searchForm(): HTMLElement {
  return screen.getByRole("search", { name: "Search server asset register" });
}

function requestedSearch(value: string): void {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search assets" }), {
    target: { value },
  });
  fireEvent.submit(searchForm());
}

const tenItems = Array.from({ length: 10 }, (_, i) => wireAsset(i + 1));
const firstOfTwelve = validatedPage(tenItems, { totalItems: 12 });
const secondOfTwelve = validatedPage([wireAsset(11), wireAsset(12)], {
  page: 2,
  totalItems: 12,
});

describe("ServerAssetRegister — semantic structure and disconnected states", () => {
  it("has an accessible section heading, description, and disclaimer", () => {
    mount();
    const section = screen.getByRole("region", { name: "Server asset register" });
    const heading = within(section).getByRole("heading", { name: "Server asset register", level: 2 });
    expect(section.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(section.textContent).toContain("server-filtered records");
    expect(section.textContent).toContain("never an equipment-safety or approval decision");
  });

  it("shows an explicit not-connected state without filters or a table", () => {
    mount({ kind: "idle" });
    expect(screen.getByText("Asset Register API is not connected.")).toBeDefined();
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows an optional non-secret explanation while idle", () => {
    mount({ kind: "idle", detail: "No backend configured." });
    expect(screen.getByText("No backend configured.")).toBeDefined();
  });

  it("announces loading and marks the named card busy", () => {
    mount({ kind: "loading" });
    const section = screen.getByRole("region", { name: "Server asset register" });
    expect(section.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Loading the requested asset page");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders filters during loading, but no old pagination controls", () => {
    mount({ kind: "loading" });
    expect(searchForm()).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Risk classification" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Next server page" })).toBeNull();
  });

  it("exposes a matching request error without disclosing backend error text", () => {
    mount({ kind: "error", forQuery: BASE_QUERY });
    expect(screen.getByRole("alert").textContent).toContain("could not be loaded");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry loading" })).toBeNull();
  });

  it("invokes a supplied retry callback exactly once", () => {
    const onRetry = vi.fn();
    mount({ kind: "error", forQuery: BASE_QUERY, onRetry });
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("withholds a stale error for a different query and does not offer its retry", () => {
    const onRetry = vi.fn();
    mount({ kind: "error", forQuery: BASE_QUERY, onRetry }, query({ risk: "CRITICAL" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry loading" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading the requested asset page");
    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe("ServerAssetRegister — current and stale server pages", () => {
  it("recognizes an exact query and page metadata match", () => {
    expect(matchesRequestedAssetPage(BASE_QUERY, ready())).toBe(true);
  });

  const mismatches: readonly (readonly [string, ServerAssetRegisterQuery])[] = [
    ["page", query({ page: 2 })],
    ["page size", query({ pageSize: 25 })],
    ["search", query({ search: "V-101" })],
    ["risk", query({ risk: "CRITICAL" })],
    ["evidence", query({ evidence: "VALID" })],
  ];
  for (const [label, requested] of mismatches) {
    it(`rejects a response for a mismatched ${label}`, () => {
      expect(matchesRequestedAssetPage(requested, ready())).toBe(false);
    });
  }

  it("rejects a state tagged for a new query when page metadata differs", () => {
    const q = query({ page: 2 });
    expect(matchesRequestedAssetPage(q, ready(validatedPage(), q))).toBe(false);
  });

  it("withholds old asset rows and totals when search changes", () => {
    mount(ready(firstOfTwelve), query({ search: "new filter" }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Test asset 001")).toBeNull();
    expect(screen.queryByText(/of 12 matching authorized assets/)).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading the requested asset page");
  });

  it("withholds old results when only the page size changes", () => {
    mount(ready(firstOfTwelve), query({ pageSize: 25 }));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("hides previously visible data during a new request", () => {
    const onQueryChange = vi.fn<(next: ServerAssetRegisterQuery) => void>();
    const view = render(
      <ServerAssetRegister query={BASE_QUERY} state={ready()} onQueryChange={onQueryChange} />,
    );
    expect(screen.getByText("Test asset 001")).toBeDefined();
    view.rerender(
      <ServerAssetRegister
        query={query({ search: "new" })}
        state={{ kind: "loading" }}
        onQueryChange={onQueryChange}
      />,
    );
    expect(screen.queryByText("Test asset 001")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("removes previously visible records when switched to idle", () => {
    const onQueryChange = vi.fn<(next: ServerAssetRegisterQuery) => void>();
    const view = render(
      <ServerAssetRegister query={BASE_QUERY} state={ready()} onQueryChange={onQueryChange} />,
    );
    view.rerender(<ServerAssetRegister query={BASE_QUERY} state={{ kind: "idle" }} onQueryChange={onQueryChange} />);
    expect(screen.queryByText("Test asset 001")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("ServerAssetRegister — validated data and provenance display", () => {
  it("renders seven explicit table columns with an accessible caption", () => {
    mount();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((th: HTMLElement) => th.textContent)).toEqual([
      "Asset tag", "Name", "Asset ID", "Type", "Location", "Risk / basis", "Evidence / basis",
    ]);
    expect(table.querySelector("caption")?.textContent).toContain("reported values");
    expect(screen.getByRole("region", { name: "Scrollable server asset register table" })).toBeDefined();
  });

  it("shows asset identity, type, and location from the decoded page", () => {
    mount();
    const row = screen.getByRole("row", { name: /V-001/ });
    expect(row.textContent).toContain("AST-001");
    expect(row.textContent).toContain("Pressure vessel");
    expect(row.textContent).toContain("Synthetic Unit A");
  });

  it("keeps critical risk separate from valid evidence", () => {
    mount();
    expect(screen.getByText("Risk: Critical")).toBeDefined();
    expect(screen.getByText("Evidence: Valid")).toBeDefined();
    expect(screen.queryByText("Risk: Low")).toBeNull();
  });

  it("displays classification source references and exact timestamps", () => {
    mount();
    const tableText = screen.getByRole("table").textContent ?? "";
    expect(tableText).toContain("RISK-BASIS-001");
    expect(tableText).toContain("2026-10-20T09:00:00+07:00");
    expect(tableText).toContain("EVID-BASIS-001");
    expect(tableText).toContain("2026-10-20T08:00:00Z");
  });

  it("distinguishes absent and explicit null status as Not provided", () => {
    const page = validatedPage([
      wireAsset(1, { riskClassification: null, evidenceAssessment: null }),
      wireAsset(2, { riskClassification: undefined, evidenceAssessment: undefined }),
    ].map((record, index) => {
      if (index === 0) return record;
      const { riskClassification: _risk, evidenceAssessment: _evidence, ...withoutStatuses } = record;
      return withoutStatuses;
    }));
    mount(ready(page));
    // Count data cells only, not filter <option> labels with identical text.
    expect(within(screen.getByRole("table")).getAllByText("Not provided")).toHaveLength(4);
    expect(screen.queryByText("Risk: Unknown")).toBeNull();
  });

  it("renders explicit UNKNOWN classifications, each with its own provenance", () => {
    const page = validatedPage([wireAsset(1, {
      riskClassification: { level: "UNKNOWN", basisRecordId: "RISK-UNKNOWN", assessedAt: "2026-10-20T09:00:00Z" },
      evidenceAssessment: { state: "UNKNOWN", basisRecordId: "EVID-UNKNOWN", evaluatedAt: "2026-10-20T09:30:00Z" },
    })]);
    mount(ready(page));
    expect(screen.getByText("Risk: Unknown")).toBeDefined();
    expect(screen.getByText("Evidence: Unknown")).toBeDefined();
    expect(screen.getByRole("table").textContent).toContain("RISK-UNKNOWN");
    expect(screen.getByRole("table").textContent).toContain("EVID-UNKNOWN");
  });

  it("renders markup-like asset names as inert text", () => {
    const name = "<img src=x onerror=alert(1)>";
    mount(ready(validatedPage([wireAsset(1, { name })])));
    expect(screen.getByText(name)).toBeDefined();
    expect(screen.getByRole("table").querySelector("img")).toBeNull();
  });

  it("does not locally truncate a validated page of ten assets", () => {
    mount(ready(firstOfTwelve));
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(10);
    expect(screen.getByText("Test asset 010")).toBeDefined();
  });

  it("displays server totals rather than treating the received page as the full register", () => {
    mount(ready(firstOfTwelve));
    expect(screen.getByText("Showing 1–10 of 12 matching authorized assets")).toBeDefined();
    expect(screen.getByText("1 / 2")).toBeDefined();
  });

  it("uses the server's current page index when displaying the final page", () => {
    const q = query({ page: 2 });
    mount(ready(secondOfTwelve, q), q);
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByText("Showing 11–12 of 12 matching authorized assets")).toBeDefined();
    expect(screen.getByText("2 / 2")).toBeDefined();
  });

  it("shows a genuine empty authorized register without fabricating rows", () => {
    mount(ready(validatedPage([], { totalItems: 0 })));
    expect(screen.getByText("No assets available in the authorized register.")).toBeDefined();
    expect(screen.getByText("Showing 0–0 of 0 matching authorized assets")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("distinguishes zero filtered results from an empty register", () => {
    const q = query({ search: "unmatched" });
    mount(ready(validatedPage([], { totalItems: 0 }), q), q);
    expect(screen.getByText("No assets match the current server-side query.")).toBeDefined();
    expect(screen.queryByText("No assets available in the authorized register.")).toBeNull();
  });
});

describe("ServerAssetRegister — controlled query interactions", () => {
  it("keeps search edits local until form submission", () => {
    const { onQueryChange } = mount();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search assets" }), {
      target: { value: " V-101 " },
    });
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it("trims submitted search text and requests page one", () => {
    const q = query({ page: 2 });
    const { onQueryChange } = mount(ready(secondOfTwelve, q), q);
    requestedSearch("  Pressure vessel  ");
    expect(onQueryChange).toHaveBeenCalledWith({ ...q, search: "Pressure vessel", page: 1 });
  });

  it("does not submit a query when the search and page are unchanged", () => {
    const { onQueryChange } = mount();
    requestedSearch("   ");
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it("resets page one when submitting unchanged text from page two", () => {
    const q = query({ page: 2, search: "V-101" });
    const { onQueryChange } = mount(ready(secondOfTwelve, q), q);
    requestedSearch("V-101");
    expect(onQueryChange).toHaveBeenCalledWith({ ...q, page: 1 });
  });

  it("resynchronizes the search input after an external query update", () => {
    const handler = vi.fn<(next: ServerAssetRegisterQuery) => void>();
    const view = render(
      <ServerAssetRegister query={BASE_QUERY} state={{ kind: "loading" }} onQueryChange={handler} />,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Search assets" }), {
      target: { value: "unsent draft" },
    });
    view.rerender(<ServerAssetRegister query={query({ search: "external" })} state={{ kind: "loading" }} onQueryChange={handler} />);
    expect((screen.getByRole("searchbox", { name: "Search assets" }) as HTMLInputElement).value).toBe("external");
    expect(handler).not.toHaveBeenCalled();
  });

  it("requests a new risk filter without discarding other filters", () => {
    const q = query({ page: 2, search: "pump", evidence: "STALE" });
    const { onQueryChange } = mount(ready(secondOfTwelve, q), q);
    fireEvent.change(screen.getByRole("combobox", { name: "Risk classification" }), {
      target: { value: "CRITICAL" },
    });
    expect(onQueryChange).toHaveBeenCalledWith({ ...q, page: 1, risk: "CRITICAL" });
  });

  it("requests a new evidence filter without discarding risk or search", () => {
    const q = query({ page: 2, search: "pump", risk: "HIGH" });
    const { onQueryChange } = mount(ready(secondOfTwelve, q), q);
    fireEvent.change(screen.getByRole("combobox", { name: "Evidence status" }), {
      target: { value: "UNKNOWN" },
    });
    expect(onQueryChange).toHaveBeenCalledWith({ ...q, page: 1, evidence: "UNKNOWN" });
  });

  it("exposes distinct UNKNOWN and NOT_PROVIDED filter choices", () => {
    mount();
    const riskSelect = screen.getByRole("combobox", { name: "Risk classification" });
    const evidenceSelect = screen.getByRole("combobox", { name: "Evidence status" });
    expect(within(riskSelect).getByRole("option", { name: "Unknown" })).toBeDefined();
    expect(within(riskSelect).getByRole("option", { name: "Not provided" })).toBeDefined();
    expect(within(evidenceSelect).getByRole("option", { name: "Unknown" })).toBeDefined();
    expect(within(evidenceSelect).getByRole("option", { name: "Not provided" })).toBeDefined();
  });

  it("requests the next server page without locally filtering or changing totals", () => {
    const { onQueryChange } = mount(ready(firstOfTwelve));
    fireEvent.click(screen.getByRole("button", { name: "Next server page" }));
    expect(onQueryChange).toHaveBeenCalledWith({ ...BASE_QUERY, page: 2 });
    expect(screen.getByText("Showing 1–10 of 12 matching authorized assets")).toBeDefined();
  });

  it("requests the previous server page from page two", () => {
    const q = query({ page: 2 });
    const { onQueryChange } = mount(ready(secondOfTwelve, q), q);
    fireEvent.click(screen.getByRole("button", { name: "Previous server page" }));
    expect(onQueryChange).toHaveBeenCalledWith({ ...q, page: 1 });
  });

  it("disables Previous on the first server page", () => {
    mount(ready(firstOfTwelve));
    const previous = screen.getByRole("button", { name: "Previous server page" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
  });

  it("disables Next on the last server page", () => {
    const q = query({ page: 2 });
    mount(ready(secondOfTwelve, q), q);
    const next = screen.getByRole("button", { name: "Next server page" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it("changing page size resets to page one while preserving filters", () => {
    const q = query({ page: 2, risk: "CRITICAL", search: "pump" });
    const { onQueryChange } = mount(ready(secondOfTwelve, q), q);
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "25" },
    });
    expect(onQueryChange).toHaveBeenCalledWith({ ...q, page: 1, pageSize: 25 });
  });

  it("derives unique associated input IDs for separate register instances", () => {
    render(
      <div>
        <ServerAssetRegister query={BASE_QUERY} state={{ kind: "loading" }} onQueryChange={vi.fn()} />
        <ServerAssetRegister query={BASE_QUERY} state={{ kind: "loading" }} onQueryChange={vi.fn()} />
      </div>,
    );
    const searchInputs = screen.getAllByRole("searchbox", { name: "Search assets" });
    expect(searchInputs).toHaveLength(2);
    expect(searchInputs[0]?.id).not.toBe(searchInputs[1]?.id);
    expect(document.getElementById(searchInputs[0]?.id ?? "")).toBe(searchInputs[0]);
  });
});
