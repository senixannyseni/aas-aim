// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";
import { AppShell, type AppShellNavigationItem } from "./AppShell";

/**
 * DOM-level regression tests for the presentation-only AIM application shell.
 *
 * These tests cover semantic landmarks, fragment navigation, skip-link targets,
 * real rendered workspace content, and explicit prototype disclosures.
 * They do NOT establish responsive layout behavior (jsdom has no layout engine),
 * production accessibility compliance, authentication, or backend authority.
 */
afterEach(() => {
  cleanup();
});

const localNavigation = [
  { label: "Section one", href: "#section-one" },
  { label: "Section two", href: "#section-two" },
] as const satisfies readonly AppShellNavigationItem[];

function renderShell() {
  return render(
    <AppShell navigation={localNavigation}>
      <h1 id="section-one">Section one</h1>
      <section id="section-two" aria-label="Section two">
        <p>Example workspace content</p>
      </section>
    </AppShell>,
  );
}

describe("AppShell — document landmarks and identity", () => {
  it("renders exactly one banner, main landmark, and contentinfo", () => {
    renderShell();
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
  });

  it("renders the brand name and explanatory subtitle", () => {
    renderShell();
    const banner = screen.getByRole("banner");
    expect(within(banner).getByText("Bandha AIM")).toBeDefined();
    expect(within(banner).getByText("Integrity Assurance Management")).toBeDefined();
  });

  it("keeps the decorative brand mark hidden from assistive technology", () => {
    renderShell();
    const mark = screen.getByRole("banner").querySelector(".aim-brand__mark");
    expect(mark?.textContent).toBe("A");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
  });

  it("labels the interface as a prototype rather than a connected system", () => {
    renderShell();
    const environment = screen.getByText("Interface prototype");
    expect(environment.classList.contains("aim-environment")).toBe(true);
  });

  it("preserves the structural application and workspace classes", () => {
    const { container } = renderShell();
    expect(container.querySelector(".aim-app")).not.toBeNull();
    expect(container.querySelector(".aim-workspace-layout")).not.toBeNull();
    expect(screen.getByRole("main").classList.contains("aim-workspace-content")).toBe(true);
  });

  it("includes an explicit footer disclosure about engineering data", () => {
    renderShell();
    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain("Prototype interface only");
    expect(footer.textContent).toContain("not equipment");
    expect(footer.textContent).toContain("engineering approvals");
  });

  it("does not create buttons, live statuses, or engineering result values", () => {
    renderShell();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("AppShell — keyboard entry and navigation", () => {
  it("provides a skip link targeting its unique main landmark", () => {
    renderShell();
    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");
    expect(skipLink.getAttribute("href")).toBe("#main-content");
    expect(main.id).toBe("main-content");
    expect(document.querySelectorAll("#main-content")).toHaveLength(1);
  });

  it("allows programmatic focus on the main landmark after a skip", () => {
    renderShell();
    const main = screen.getByRole("main") as HTMLElement;
    expect(main.tabIndex).toBe(-1);
    main.focus();
    expect(document.activeElement).toBe(main);
  });

  it("renders a clearly named workspace navigation landmark", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    expect(nav.closest("aside")).not.toBeNull();
    expect(within(nav).getByText("Workspace")).toBeDefined();
  });

  it("renders navigation links in the supplied order with fragment URLs", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    const links = within(nav).getAllByRole("link") as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent)).toEqual(["Section one", "Section two"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#section-one",
      "#section-two",
    ]);
  });

  it("uses native list semantics for navigation links", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    expect(within(nav).getByRole("list").tagName).toBe("UL");
    expect(within(nav).getAllByRole("listitem")).toHaveLength(2);
  });

  it("points every example navigation link to an existing element", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    for (const link of within(nav).getAllByRole("link")) {
      const hash = link.getAttribute("href");
      expect(hash?.startsWith("#")).toBe(true);
      expect(document.getElementById(hash!.slice(1))).not.toBeNull();
    }
  });

  it("does not imply an active route by setting aria-current", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    for (const link of within(nav).getAllByRole("link")) {
      expect(link.getAttribute("aria-current")).toBeNull();
    }
  });

  it("supports an empty navigation list without inventing links", () => {
    render(
      <AppShell navigation={[]}>
        <h1>Empty workspace</h1>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    expect(within(nav).queryByRole("link")).toBeNull();
    expect(within(nav).getByRole("list")).toBeDefined();
    expect(screen.getByRole("main").textContent).toContain("Empty workspace");
  });

  it("updates navigation links when parent props change", () => {
    const { rerender } = renderShell();
    rerender(
      <AppShell navigation={[{ label: "Updated", href: "#new-section" }]}>
        <h1 id="new-section">Updated</h1>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("#new-section");
    expect(within(nav).queryByRole("link", { name: "Section one" })).toBeNull();
  });

  it("renders arbitrary children inside main, not in the navigation or header", () => {
    renderShell();
    const content = screen.getByText("Example workspace content");
    expect(screen.getByRole("main").contains(content)).toBe(true);
    expect(screen.getByRole("banner").contains(content)).toBe(false);
    expect(screen.getByRole("navigation").contains(content)).toBe(false);
  });

  it("preserves the main landmark when child content changes", () => {
    const { rerender } = renderShell();
    const main = screen.getByRole("main");
    rerender(
      <AppShell navigation={localNavigation}>
        <h1 id="section-one">Updated content</h1>
        <p id="section-two">New details</p>
      </AppShell>,
    );
    expect(screen.getByRole("main")).toBe(main);
    expect(within(main).getByText("Updated content")).toBeDefined();
    expect(within(main).getByText("New details")).toBeDefined();
  });
});

describe("App — integrated initial workspace", () => {
  it("renders one top-level overview heading", () => {
    render(<App />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe("AIM overview");
  });

  it("renders exactly the four intended navigation destinations", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    const links = within(nav).getAllByRole("link") as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent)).toEqual([
      "Overview",
      "Asset register",
      "Asset context",
      "Assurance lifecycle",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#overview",
      "#asset-register",
      "#asset-context",
      "#assurance-lifecycle",
    ]);
  });

  it("resolves all integrated fragment links to unique real elements", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    for (const link of within(nav).getAllByRole("link")) {
      const href = link.getAttribute("href");
      expect(href?.startsWith("#")).toBe(true);
      expect(document.querySelectorAll(`[id="${href!.slice(1)}"]`)).toHaveLength(1);
    }
  });

  it("mounts the server-paginated register with a disconnected default", () => {
    render(<App />);
    const region = screen.getByRole("region", { name: "Server asset register" });
    expect(within(region).getByRole("heading", { level: 2, name: "Server asset register" })).toBeDefined();
    expect(region.textContent).toContain("Asset Register API is not connected.");
    expect(region.textContent).toContain("No authenticated Asset Register API connection");
    expect(region.querySelector("table")).toBeNull();
    expect(region.closest("#asset-register")).not.toBeNull();
    expect(within(region).queryByRole("searchbox")).toBeNull();
  });

  it("renders a named Asset context region with an honest empty state", () => {
    render(<App />);
    const region = screen.getByRole("region", { name: "Asset context" });
    expect(region.id).toBe("asset-context");
    expect(within(region).getByRole("heading", { level: 2, name: "Asset context" })).toBeDefined();
    expect(region.textContent).toContain("No asset selected");
    expect(region.textContent).toContain("not connected to an AIM API");
  });

  it("renders a named Assurance lifecycle region labeled as conceptual", () => {
    render(<App />);
    const region = screen.getByRole("region", { name: "Assurance lifecycle" });
    expect(region.id).toBe("assurance-lifecycle");
    expect(region.textContent).toContain("Conceptual information flow, not live workflow status");
    expect(within(region).getByRole("heading", { level: 2, name: "Assurance lifecycle" })).toBeDefined();
  });

  it("renders all eight conceptual stages in their declared order", () => {
    render(<App />);
    const lifecycle = screen.getByRole("region", { name: "Assurance lifecycle" });
    const list = within(lifecycle).getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Evidence",
      "Condition",
      "Degradation",
      "Risk",
      "Decision",
      "Action",
      "Verification",
      "Reassessment",
    ]);
  });

  it("keeps lifecycle labels separate from interactive controls", () => {
    render(<App />);
    const lifecycle = screen.getByRole("region", { name: "Assurance lifecycle" });
    expect(within(lifecycle).queryByRole("button")).toBeNull();
    expect(within(lifecycle).queryByRole("link")).toBeNull();
  });

  it("renders the three named cards inside one main workspace", () => {
    render(<App />);
    const main = screen.getByRole("main");
    const regions = within(main).getAllByRole("region");
    expect(regions).toHaveLength(3);
    expect(regions.map((region) => region.getAttribute("id"))).toEqual([
      null,
      "asset-context",
      "assurance-lifecycle",
    ]);
    expect(regions[0]?.closest("#asset-register")).not.toBeNull();
  });

  it("discloses the frontend/backend authority boundary without invented results", () => {
    render(<App />);
    const main = screen.getByRole("main");
    expect(main.textContent).toContain("Engineering calculations, authorization, approvals");
    expect(screen.getByRole("contentinfo").textContent).toContain("not equipment safety decisions");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
