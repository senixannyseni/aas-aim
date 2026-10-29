// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge, type StatusBadgeProps } from "./StatusBadge";

/**
 * UI-contract regression tests for the non-interactive status badge.
 *
 * These tests prove that the component displays the supplied category/status
 * without mixing classifications or relying on color alone. They do NOT
 * validate external API responses or establish engineering authority.
 */
afterEach(() => {
  cleanup();
});

type StatusCase = Readonly<{
  props: StatusBadgeProps;
  label: string;
  modifier: string;
}>;

// Explicitly enumerate the controlled vocabulary so that adding/removing a
// status requires a conscious test update, not just a snapshot regeneration.
const statusCases = [
  { props: { category: "risk", status: "LOW" }, label: "Risk: Low", modifier: "risk-low" },
  { props: { category: "risk", status: "MODERATE" }, label: "Risk: Moderate", modifier: "risk-moderate" },
  { props: { category: "risk", status: "HIGH" }, label: "Risk: High", modifier: "risk-high" },
  { props: { category: "risk", status: "CRITICAL" }, label: "Risk: Critical", modifier: "risk-critical" },
  { props: { category: "risk", status: "UNKNOWN" }, label: "Risk: Unknown", modifier: "risk-unknown" },

  { props: { category: "evidence", status: "VALID" }, label: "Evidence: Valid", modifier: "evidence-valid" },
  { props: { category: "evidence", status: "STALE" }, label: "Evidence: Stale", modifier: "evidence-stale" },
  { props: { category: "evidence", status: "INVALID" }, label: "Evidence: Invalid", modifier: "evidence-invalid" },
  { props: { category: "evidence", status: "UNAVAILABLE" }, label: "Evidence: Unavailable", modifier: "evidence-unavailable" },
  { props: { category: "evidence", status: "MISSING" }, label: "Evidence: Missing", modifier: "evidence-missing" },
  { props: { category: "evidence", status: "UNKNOWN" }, label: "Evidence: Unknown", modifier: "evidence-unknown" },

  { props: { category: "workflow", status: "DRAFT" }, label: "Workflow: Draft", modifier: "workflow-draft" },
  { props: { category: "workflow", status: "IN_REVIEW" }, label: "Workflow: In review", modifier: "workflow-in-review" },
  { props: { category: "workflow", status: "APPROVED" }, label: "Workflow: Approved", modifier: "workflow-approved" },
  { props: { category: "workflow", status: "COMPLETED" }, label: "Workflow: Completed", modifier: "workflow-completed" },
  { props: { category: "workflow", status: "REJECTED" }, label: "Workflow: Rejected", modifier: "workflow-rejected" },
  { props: { category: "workflow", status: "SUPERSEDED" }, label: "Workflow: Superseded", modifier: "workflow-superseded" },
  { props: { category: "workflow", status: "UNKNOWN" }, label: "Workflow: Unknown", modifier: "workflow-unknown" },

  { props: { category: "approval", status: "PENDING" }, label: "Approval: Pending", modifier: "approval-pending" },
  { props: { category: "approval", status: "GRANTED" }, label: "Approval: Granted", modifier: "approval-granted" },
  { props: { category: "approval", status: "DENIED" }, label: "Approval: Denied", modifier: "approval-denied" },
  { props: { category: "approval", status: "REVOKED" }, label: "Approval: Revoked", modifier: "approval-revoked" },
  { props: { category: "approval", status: "UNKNOWN" }, label: "Approval: Unknown", modifier: "approval-unknown" },
] as const satisfies readonly StatusCase[];

describe("StatusBadge — controlled status vocabulary", () => {
  it.each(statusCases)("renders $label with its own semantic modifier", ({ props, label, modifier }) => {
    render(<StatusBadge {...props} data-testid="status-badge" />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.textContent).toBe(label);
    expect(screen.getByText(label)).toBe(badge);
    expect(badge.classList.contains("aim-status-badge")).toBe(true);
    expect(badge.classList.contains(`aim-status-badge--${modifier}`)).toBe(true);
  });

  it("does not equate valid evidence with low risk", () => {
    render(
      <div>
        <StatusBadge category="evidence" status="VALID" data-testid="evidence" />
        <StatusBadge category="risk" status="CRITICAL" data-testid="risk" />
      </div>,
    );

    expect(screen.getByTestId("evidence").textContent).toBe("Evidence: Valid");
    expect(screen.getByTestId("risk").textContent).toBe("Risk: Critical");
    expect(screen.getByTestId("evidence").className).not.toContain("risk-");
  });

  it("does not equate approved workflow with granted approval", () => {
    render(
      <div>
        <StatusBadge category="workflow" status="APPROVED" data-testid="workflow" />
        <StatusBadge category="approval" status="DENIED" data-testid="approval" />
      </div>,
    );

    expect(screen.getByTestId("workflow").textContent).toBe("Workflow: Approved");
    expect(screen.getByTestId("approval").textContent).toBe("Approval: Denied");
  });
});

describe("StatusBadge — native attributes and accessibility", () => {
  it("renders status in visible text rather than depending on color or title", () => {
    render(<StatusBadge category="risk" status="CRITICAL" />);

    const badge = screen.getByText("Risk: Critical");
    expect(badge.textContent).toBe("Risk: Critical");
    expect(badge.getAttribute("title")).toBeNull();
  });

  it("does not implicitly turn a static badge into an ARIA live region", () => {
    render(<StatusBadge category="workflow" status="IN_REVIEW" />);

    const badge = screen.getByText("Workflow: In review");
    expect(badge.getAttribute("role")).toBeNull();
    expect(badge.getAttribute("aria-live")).toBeNull();
  });

  it("preserves the caller's native span attributes", () => {
    render(
      <StatusBadge
        category="evidence"
        status="STALE"
        id="sensor-quality"
        title="Reported evidence freshness"
        lang="en"
        data-testid="status-badge"
      />,
    );

    const badge = screen.getByTestId("status-badge");
    expect(badge.id).toBe("sensor-quality");
    expect(badge.title).toBe("Reported evidence freshness");
    expect(badge.getAttribute("lang")).toBe("en");
    expect(badge.textContent).toBe("Evidence: Stale");
  });

  it("merges a caller's class with the controlled semantic classes", () => {
    render(<StatusBadge category="risk" status="HIGH" className="compact-cell" />);

    const classes = screen.getByText("Risk: High").classList;
    expect(classes.contains("aim-status-badge")).toBe(true);
    expect(classes.contains("aim-status-badge--risk-high")).toBe(true);
    expect(classes.contains("compact-cell")).toBe(true);
  });

  it("forwards the React ref to the actual span element", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<StatusBadge ref={ref} category="approval" status="PENDING" />);

    expect(ref.current).toBe(screen.getByText("Approval: Pending"));
    expect(ref.current?.tagName).toBe("SPAN");
  });

  it("updates the semantic class when a status changes", () => {
    const { rerender } = render(
      <StatusBadge category="risk" status="HIGH" data-testid="status-badge" />,
    );
    const badge = screen.getByTestId("status-badge");

    rerender(<StatusBadge category="risk" status="LOW" data-testid="status-badge" />);

    expect(screen.getByTestId("status-badge")).toBe(badge);
    expect(badge.textContent).toBe("Risk: Low");
    expect(badge.classList.contains("aim-status-badge--risk-low")).toBe(true);
    expect(badge.classList.contains("aim-status-badge--risk-high")).toBe(false);
  });

  it("updates both label and class when switching categories", () => {
    const { rerender } = render(
      <StatusBadge category="workflow" status="APPROVED" data-testid="status-badge" />,
    );

    rerender(<StatusBadge category="approval" status="PENDING" data-testid="status-badge" />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.textContent).toBe("Approval: Pending");
    expect(badge.classList.contains("aim-status-badge--approval-pending")).toBe(true);
    expect(badge.classList.contains("aim-status-badge--workflow-approved")).toBe(false);
  });
});

// These intentional compiler failures are checked by the TypeScript build.
// They never execute in a test run. They complement, but do not replace,
// validation of incoming untrusted API payloads.
if (false) {
  // @ts-expect-error INVALID is an evidence status, not a risk status.
  const mixedStatus: StatusBadgeProps = { category: "risk", status: "INVALID" };
  void mixedStatus;

  // @ts-expect-error Category must be one of the four controlled vocabularies.
  const unsupportedCategory: StatusBadgeProps = { category: "inspection", status: "VALID" };
  void unsupportedCategory;

  // @ts-expect-error Callers may not override the controlled visible label.
  const overriddenLabel: StatusBadgeProps = { category: "risk", status: "LOW", children: "Safe" };
  void overriddenLabel;

  // @ts-expect-error Callers may not replace text with an aria-label.
  const fakeAccessibleName: StatusBadgeProps = { category: "risk", status: "LOW", "aria-label": "Safe" };
  void fakeAccessibleName;
}
