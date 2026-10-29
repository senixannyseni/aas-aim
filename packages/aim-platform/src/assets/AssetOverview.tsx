import type { JSX } from "react";

import { Button } from "@bandha/aim-platform/ui/Button";
import { Card } from "@bandha/aim-platform/ui/Card";
import {
  StatusBadge,
  type EvidenceStatus,
  type RiskStatus,
} from "@bandha/aim-platform/ui/StatusBadge";

/**
 * Presentation-only asset summary. This is NOT an authoritative domain model,
 * persistence schema, or API response contract.
 *
 * An eventual versioned OpenAPI adapter must validate untrusted payloads,
 * tenant access, and status provenance before producing this view model.
 * A missing status is not equivalent to UNKNOWN, LOW risk, or VALID evidence.
 */
export type AssetOverviewRecord = Readonly<{
  id: string;
  tag: string;
  name: string;
  assetType?: string | null;
  location?: string | null;
  riskStatus?: RiskStatus | null;
  evidenceStatus?: EvidenceStatus | null;
}>;

/**
 * Explicit load states; no synthetic asset or engineering data is created.
 * Error details from servers are never rendered directly.
 */
export type AssetOverviewState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "empty"; detail?: string }>
  | Readonly<{ kind: "error"; onRetry?: () => void }>
  | Readonly<{ kind: "ready"; asset: AssetOverviewRecord }>;

export type AssetOverviewProps = Readonly<{
  state: AssetOverviewState;
}>;

function displayOptional(value: string | null | undefined): string {
  return value?.trim() || "Not provided";
}

/**
 * Renders one governed asset context card from an already validated view model.
 * This component does not fetch, infer risk, approve records, or perform
 * engineering calculations. 'Ready' means data was supplied, NOT that an
 * asset or its evidence is technically acceptable.
 */
export function AssetOverview({ state }: AssetOverviewProps): JSX.Element {
  let content: JSX.Element;

  switch (state.kind) {
    case "loading":
      content = (
        <p className="aim-asset-overview__message" role="status">
          Loading asset context…
        </p>
      );
      break;

    case "empty":
      content = (
        <div className="aim-asset-overview__message">
          <p>No asset selected.</p>
          {state.detail && <p>{state.detail}</p>}
        </div>
      );
      break;

    case "error":
      content = (
        <div className="aim-asset-overview__message" role="alert">
          <p>Asset context could not be loaded. No asset information is shown.</p>
          {state.onRetry && (
            <Button type="button" variant="secondary" onClick={state.onRetry}>
              Retry loading
            </Button>
          )}
        </div>
      );
      break;

    case "ready": {
      const asset = state.asset;
      content = (
        <div className="aim-asset-overview">
          <dl className="aim-asset-overview__details">
            <div className="aim-asset-overview__field">
              <dt>Asset name</dt>
              <dd>{displayOptional(asset.name)}</dd>
            </div>
            <div className="aim-asset-overview__field">
              <dt>Asset tag</dt>
              <dd>{displayOptional(asset.tag)}</dd>
            </div>
            <div className="aim-asset-overview__field">
              <dt>Asset ID</dt>
              <dd>{displayOptional(asset.id)}</dd>
            </div>
            <div className="aim-asset-overview__field">
              <dt>Asset type</dt>
              <dd>{displayOptional(asset.assetType)}</dd>
            </div>
            <div className="aim-asset-overview__field">
              <dt>Location</dt>
              <dd>{displayOptional(asset.location)}</dd>
            </div>
          </dl>

          <div className="aim-asset-overview__statuses" role="group" aria-label="Reported status information">
            <div className="aim-asset-overview__status">
              <p>Risk classification</p>
              {asset.riskStatus == null ? (
                <span>Not provided</span>
              ) : (
                <StatusBadge category="risk" status={asset.riskStatus} />
              )}
            </div>
            <div className="aim-asset-overview__status">
              <p>Evidence status</p>
              {asset.evidenceStatus == null ? (
                <span>Not provided</span>
              ) : (
                <StatusBadge category="evidence" status={asset.evidenceStatus} />
              )}
            </div>
          </div>
          <p className="aim-asset-overview__disclaimer">
            Displayed statuses are reported values, not an engineering safety or approval decision.
          </p>
        </div>
      );
      break;
    }

    default: {
      const exhaustive: never = state;
      throw new Error(`Unsupported asset overview state: ${String(exhaustive)}`);
    }
  }

  return (
    <Card
      id="asset-context"
      title="Asset context"
      description="Selected asset and its governed evidence"
      aria-busy={state.kind === "loading"}
    >
      {content}
    </Card>
  );
}
