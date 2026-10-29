// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { Card, type CardProps } from "./Card";

/**
 * DOM-level regression tests for the reusable AIM information panel.
 *
 * A Card is an accessible, named section with visible content and optional
 * actions. Tests do not imply that any displayed information is authoritative,
 * or that mounting an action grants permission to perform it.
 *
 * jsdom is selected locally so the engineering formatter tests can continue
 * to use Vitest's default Node environment.
 */
afterEach(() => {
  cleanup();
});

describe("Card — semantic structure and headings", () => {
  it("renders a named native section with an h2 heading by default", () => {
    render(<Card title="Asset context">No asset selected</Card>);

    const region = screen.getByRole("region", { name: "Asset context" });
    const heading = screen.getByRole("heading", { level: 2, name: "Asset context" });

    expect(region.tagName).toBe("SECTION");
    expect(region.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(heading.id.length).toBeGreaterThan(0);
    expect(heading.classList.contains("aim-card__title")).toBe(true);
    expect(region.classList.contains("aim-card")).toBe(true);
    expect(region.textContent).toContain("No asset selected");
  });

  it("supports a level-three heading without changing the region name", () => {
    render(<Card title="Inspection records" headingLevel={3}>None</Card>);

    expect(screen.getByRole("heading", { level: 3, name: "Inspection records" }).tagName).toBe("H3");
    expect(screen.getByRole("region", { name: "Inspection records" })).toBeDefined();
  });

  it("supports a level-four heading for deeply nested workspaces", () => {
    render(<Card title="Evidence details" headingLevel={4}>Not loaded</Card>);

    expect(screen.getByRole("heading", { level: 4, name: "Evidence details" }).tagName).toBe("H4");
    expect(screen.getByRole("region", { name: "Evidence details" })).toBeDefined();
  });

  it("rejects an empty heading rather than silently creating an unnamed section", () => {
    expect(() => render(<Card title="">Content</Card>)).toThrow("Card title must not be empty.");
  });

  it("rejects headings containing only whitespace", () => {
    expect(() => render(<Card title={" \t  "}>Content</Card>)).toThrow("Card title must not be empty.");
  });

  it("renders nested content in a dedicated body container", () => {
    render(
      <Card title="Engineering evidence">
        <p>Measurements not yet loaded.</p>
        <ul><li>Inspection history</li><li>Documents</li></ul>
      </Card>,
    );

    const region = screen.getByRole("region", { name: "Engineering evidence" });
    const body = region.querySelector(".aim-card__body");

    expect(body?.querySelector("p")?.textContent).toBe("Measurements not yet loaded.");
    expect(body?.querySelectorAll("li").length).toBe(2);
    expect(region.querySelector(".aim-card__header")).not.toBeNull();
  });

  it("does not make the container an interactive control", () => {
    render(<Card title="Read-only information">Content</Card>);

    const region = screen.getByRole("region", { name: "Read-only information" });
    expect(region.getAttribute("tabindex")).toBeNull();
    expect(region.getAttribute("role")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Card — description and accessible relationships", () => {
  it("renders a visible description linked by aria-describedby", () => {
    render(<Card title="Asset context" description="Current engineering workspace">Content</Card>);

    const region = screen.getByRole("region", { name: "Asset context" });
    const description = screen.getByText("Current engineering workspace");

    expect(description.tagName).toBe("P");
    expect(description.classList.contains("aim-card__description")).toBe(true);
    expect(description.id.length).toBeGreaterThan(0);
    expect(region.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("does not set aria-describedby when no description exists", () => {
    render(<Card title="No description">Content</Card>);

    const region = screen.getByRole("region", { name: "No description" });
    expect(region.getAttribute("aria-describedby")).toBeNull();
    expect(region.querySelector(".aim-card__description")).toBeNull();
  });

  it("does not create an empty description for whitespace-only text", () => {
    render(<Card title="No description" description={" \t "}>Content</Card>);

    const region = screen.getByRole("region", { name: "No description" });
    expect(region.getAttribute("aria-describedby")).toBeNull();
    expect(region.querySelector(".aim-card__description")).toBeNull();
  });

  it("trims the visible description without changing its accessible link", () => {
    render(<Card title="Details" description="  Inspection evidence  ">Content</Card>);

    const region = screen.getByRole("region", { name: "Details" });
    const description = screen.getByText("Inspection evidence");
    expect(description.textContent).toBe("Inspection evidence");
    expect(region.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("preserves an external aria-describedby ID when no description is supplied", () => {
    render(
      <div>
        <p id="external-explanation">Values are illustrative.</p>
        <Card title="Summary" aria-describedby="external-explanation">Content</Card>
      </div>,
    );

    expect(screen.getByRole("region", { name: "Summary" }).getAttribute("aria-describedby"))
      .toBe("external-explanation");
  });

  it("combines visible and external descriptions without losing either reference", () => {
    render(
      <div>
        <p id="external-explanation">Source review pending.</p>
        <Card
          title="Summary"
          description="Last recorded data"
          aria-describedby="external-explanation"
        >
          Content
        </Card>
      </div>,
    );

    const region = screen.getByRole("region", { name: "Summary" });
    const generatedDescription = screen.getByText("Last recorded data");
    expect(region.getAttribute("aria-describedby"))
      .toBe(`${generatedDescription.id} external-explanation`);
  });

  it("removes the generated description reference when description is removed", () => {
    const { rerender } = render(
      <Card title="Summary" description="Previous context">Content</Card>,
    );
    const region = screen.getByRole("region", { name: "Summary" });
    expect(region.getAttribute("aria-describedby")).not.toBeNull();

    rerender(<Card title="Summary">Content</Card>);

    expect(screen.getByRole("region", { name: "Summary" })).toBe(region);
    expect(region.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByText("Previous context")).toBeNull();
  });
});

describe("Card — explicit actions", () => {
  it("renders a real button in its header action slot", () => {
    const onClick = vi.fn();
    render(
      <Card title="Record details" actions={<Button onClick={onClick}>Open record</Button>}>
        Content
      </Card>,
    );

    const region = screen.getByRole("region", { name: "Record details" });
    const button = screen.getByRole("button", { name: "Open record" });
    expect(button.closest(".aim-card__actions")).not.toBeNull();
    expect(button.closest(".aim-card__header")).not.toBeNull();
    expect(region.contains(button)).toBe(true);

    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not invent an action when none was provided", () => {
    render(<Card title="Unchanged content">Content</Card>);

    const region = screen.getByRole("region", { name: "Unchanged content" });
    expect(region.querySelector(".aim-card__actions")).toBeNull();
  });

  it("does not render an empty actions container for null actions", () => {
    render(<Card title="Unchanged content" actions={null}>Content</Card>);

    expect(screen.getByRole("region", { name: "Unchanged content" })
      .querySelector(".aim-card__actions")).toBeNull();
  });

  it("allows multiple explicit actions without making the card itself clickable", () => {
    render(
      <Card
        title="Evidence"
        actions={<><Button>View</Button><Button variant="secondary">Export</Button></>}
      >
        Records
      </Card>,
    );

    const region = screen.getByRole("region", { name: "Evidence" });
    expect(region.querySelectorAll(".aim-card__actions button").length).toBe(2);
    expect(screen.getByRole("button", { name: "View" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Export" })).toBeDefined();
    expect(region.getAttribute("onclick")).toBeNull();
  });
});

describe("Card — native attributes, refs, and React updates", () => {
  it("forwards native section attributes and data attributes", () => {
    render(
      <Card
        title="Asset register"
        id="asset-register"
        lang="en"
        dir="ltr"
        data-testid="asset-card"
      >
        Content
      </Card>,
    );

    const region = screen.getByTestId("asset-card");
    expect(region.id).toBe("asset-register");
    expect(region.getAttribute("lang")).toBe("en");
    expect(region.getAttribute("dir")).toBe("ltr");
    expect(region.getAttribute("aria-labelledby")).toBe(
      screen.getByRole("heading", { name: "Asset register" }).id,
    );
  });

  it("merges caller-defined classes with the AIM card class", () => {
    render(<Card title="Site context" className="compact-site-card">Content</Card>);

    const classes = screen.getByRole("region", { name: "Site context" }).classList;
    expect(classes.contains("aim-card")).toBe(true);
    expect(classes.contains("compact-site-card")).toBe(true);
  });

  it("forwards its ref to the real section element", () => {
    const ref = createRef<HTMLElement>();
    render(<Card ref={ref} title="Data quality">Content</Card>);

    expect(ref.current).toBe(screen.getByRole("region", { name: "Data quality" }));
    expect(ref.current?.tagName).toBe("SECTION");
  });

  it("assigns unique, correctly associated IDs to multiple cards", () => {
    render(
      <>
        <Card title="Asset" description="Selected equipment">Content A</Card>
        <Card title="Inspection" description="History">Content B</Card>
      </>,
    );

    const asset = screen.getByRole("region", { name: "Asset" });
    const inspection = screen.getByRole("region", { name: "Inspection" });
    const assetHeading = screen.getByRole("heading", { name: "Asset" });
    const inspectionHeading = screen.getByRole("heading", { name: "Inspection" });

    expect(assetHeading.id).not.toBe(inspectionHeading.id);
    expect(asset.getAttribute("aria-labelledby")).toBe(assetHeading.id);
    expect(inspection.getAttribute("aria-labelledby")).toBe(inspectionHeading.id);
    expect(asset.getAttribute("aria-describedby")).not.toBe(inspection.getAttribute("aria-describedby"));
  });

  it("keeps the same section and ID when its title changes", () => {
    const { rerender } = render(<Card title="Initial title">Content</Card>);
    const section = screen.getByRole("region", { name: "Initial title" });
    const headingId = screen.getByRole("heading", { name: "Initial title" }).id;

    rerender(<Card title="Updated title">Content</Card>);

    expect(screen.getByRole("region", { name: "Updated title" })).toBe(section);
    expect(screen.getByRole("heading", { name: "Updated title" }).id).toBe(headingId);
    expect(section.getAttribute("aria-labelledby")).toBe(headingId);
  });

  it("updates the heading level without losing the region's accessible name", () => {
    const { rerender } = render(<Card title="Integrity review" headingLevel={2}>Content</Card>);
    const section = screen.getByRole("region", { name: "Integrity review" });

    rerender(<Card title="Integrity review" headingLevel={3}>Content</Card>);

    expect(screen.getByRole("region", { name: "Integrity review" })).toBe(section);
    expect(screen.getByRole("heading", { name: "Integrity review", level: 3 })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Integrity review", level: 2 })).toBeNull();
  });
});

// Compile-time contracts: these intentional errors must be rejected by tsc.
// The branch never executes at runtime.
if (false) {
  // @ts-expect-error A heading is required for an accessible Card section.
  const missingTitle: CardProps = { children: "Body" };
  void missingTitle;

  // @ts-expect-error Heading levels outside the supported page hierarchy are rejected.
  const invalidHeading: CardProps = { title: "Title", headingLevel: 1, children: "Body" };
  void invalidHeading;

  // @ts-expect-error Title must be plain text, not arbitrary React markup.
  const nonTextTitle: CardProps = { title: 42, children: "Body" };
  void nonTextTitle;

  // @ts-expect-error The visible heading is the accessible label; aria-label cannot override it.
  const overridingAriaLabel: CardProps = { title: "Risk review", children: "Body", "aria-label": "Everything safe" };
  void overridingAriaLabel;

  // @ts-expect-error Callers must not override aria-labelledby independently of the heading.
  const overridingLabelledBy: CardProps = { title: "Risk review", children: "Body", "aria-labelledby": "other-heading" };
  void overridingLabelledBy;

  // @ts-expect-error Arbitrary HTML injection is not part of this safe component API.
  const unsafeHtml: CardProps = { title: "Risk review", children: "Body", dangerouslySetInnerHTML: { __html: "<b>untrusted</b>" } };
  void unsafeHtml;
}
