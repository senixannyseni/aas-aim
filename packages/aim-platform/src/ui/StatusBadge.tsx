import type { ComponentPropsWithRef } from "react";

/**
 * Read-only status presentation. This is NOT a status evaluator or authority.
 *
 * Risk, evidence, workflow, and approval are independent AIM concepts:
 *   - VALID evidence never means LOW risk;
 *   - APPROVED workflow never means GRANTED authorization;
 *   - neither implies that equipment is safe.
 *
 * These values must come from a validated, versioned backend contract/adapter.
 * Never cast untrusted API JSON directly to StatusBadgeProps.
 */
export type RiskStatus = "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNKNOWN";
export type EvidenceStatus =
  | "VALID"
  | "STALE"
  | "INVALID"
  | "UNAVAILABLE"
  | "MISSING"
  | "UNKNOWN";
export type WorkflowStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "SUPERSEDED"
  | "UNKNOWN";
export type ApprovalStatus = "PENDING" | "GRANTED" | "DENIED" | "REVOKED" | "UNKNOWN";

type NativeSpanProps = Omit<
  ComponentPropsWithRef<"span">,
  "children" | "dangerouslySetInnerHTML" | "aria-label" | "aria-labelledby"
> & {
  children?: never;
  dangerouslySetInnerHTML?: never;
  "aria-label"?: never;
  "aria-labelledby"?: never;
};

/** Discriminated union prevents mixing categories and values at compile time. */
export type StatusBadgeProps = NativeSpanProps &
  (
    | { category: "risk"; status: RiskStatus }
    | { category: "evidence"; status: EvidenceStatus }
    | { category: "workflow"; status: WorkflowStatus }
    | { category: "approval"; status: ApprovalStatus }
  );

type Presentation = Readonly<{ label: string; token: string }>;

const presentation = {
  risk: {
    LOW: { label: "Low", token: "risk-low" },
    MODERATE: { label: "Moderate", token: "risk-moderate" },
    HIGH: { label: "High", token: "risk-high" },
    CRITICAL: { label: "Critical", token: "risk-critical" },
    UNKNOWN: { label: "Unknown", token: "risk-unknown" },
  },
  evidence: {
    VALID: { label: "Valid", token: "evidence-valid" },
    STALE: { label: "Stale", token: "evidence-stale" },
    INVALID: { label: "Invalid", token: "evidence-invalid" },
    UNAVAILABLE: { label: "Unavailable", token: "evidence-unavailable" },
    MISSING: { label: "Missing", token: "evidence-missing" },
    UNKNOWN: { label: "Unknown", token: "evidence-unknown" },
  },
  workflow: {
    DRAFT: { label: "Draft", token: "workflow-draft" },
    IN_REVIEW: { label: "In review", token: "workflow-in-review" },
    APPROVED: { label: "Approved", token: "workflow-approved" },
    COMPLETED: { label: "Completed", token: "workflow-completed" },
    REJECTED: { label: "Rejected", token: "workflow-rejected" },
    SUPERSEDED: { label: "Superseded", token: "workflow-superseded" },
    UNKNOWN: { label: "Unknown", token: "workflow-unknown" },
  },
  approval: {
    PENDING: { label: "Pending", token: "approval-pending" },
    GRANTED: { label: "Granted", token: "approval-granted" },
    DENIED: { label: "Denied", token: "approval-denied" },
    REVOKED: { label: "Revoked", token: "approval-revoked" },
    UNKNOWN: { label: "Unknown", token: "approval-unknown" },
  },
} as const satisfies {
  risk: Record<RiskStatus, Presentation>;
  evidence: Record<EvidenceStatus, Presentation>;
  workflow: Record<WorkflowStatus, Presentation>;
  approval: Record<ApprovalStatus, Presentation>;
};

function getPresentation(props: StatusBadgeProps): Presentation {
  switch (props.category) {
    case "risk":
      return presentation.risk[props.status];
    case "evidence":
      return presentation.evidence[props.status];
    case "workflow":
      return presentation.workflow[props.status];
    case "approval":
      return presentation.approval[props.status];
  }
}

/**
 * A non-interactive status label. Both category and value remain visible in text,
 * so no meaning depends solely on color. Native span attributes/ref are forwarded.
 * No implicit role="status": that ARIA live-region behavior is only appropriate
 * when a particular screen deliberately announces asynchronous changes.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const detail = getPresentation(props);
  const { category, status, className, ...spanProps } = props;
  const label = `${category[0]?.toUpperCase() ?? ""}${category.slice(1)}: ${detail.label}`;
  const classes = ["aim-status-badge", `aim-status-badge--${detail.token}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span {...spanProps} className={classes}>
      {label}
    </span>
  );
}
