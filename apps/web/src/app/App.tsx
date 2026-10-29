import type { JSX } from "react";

import { AssetOverview, type AssetOverviewState } from "../features/assets/AssetOverview";
import { AuthenticatedAssetRegister } from "../features/assets/AuthenticatedAssetRegister";
import type { AuthSessionBoundary } from "../shared/auth/authSession";
import { Card } from "../shared/ui/Card";
import { AppShell, type AppShellNavigationItem } from "./AppShell";

// Presentation labels only, not an executable engineering state machine.
const lifecycleStages = [
  "Evidence",
  "Condition",
  "Degradation",
  "Risk",
  "Decision",
  "Action",
  "Verification",
  "Reassessment",
] as const;

// Every navigation destination exists in the rendered page.
const navigation = [
  { label: "Overview", href: "#overview" },
  { label: "Asset register", href: "#asset-register" },
  { label: "Asset context", href: "#asset-context" },
  { label: "Assurance lifecycle", href: "#assurance-lifecycle" },
] as const satisfies readonly AppShellNavigationItem[];

// The initial screen has no selected asset or API connection. A future data
// boundary will provide loading/error/ready states after validating responses.
const initialAssetState = {
  kind: "empty",
  detail: "This prototype is not connected to an AIM API.",
} as const satisfies AssetOverviewState;

/**
 * Application-level injection point for a TRUSTED identity integration.
 *
 * File 54 — the browser bootstrap deliberately passes no boundary, so the
 * Asset Register is disconnected and makes no requests by default. A future
 * identity adapter must own the session lifecycle; passing a boundary is not
 * evidence that the Java backend has authenticated or authorized the user.
 *
 * Never create a synthetic boundary, token or asset list inside App.
 */
export type AppProps = Readonly<{
  authBoundary?: AuthSessionBoundary | null;
}>;

/** Initial browser workspace. No backend access or fabricated engineering data. */
export default function App({ authBoundary = null }: AppProps): JSX.Element {
  return (
    <AppShell navigation={navigation}>
      <div className="aim-page-introduction">
        <p className="aim-page-eyebrow">Engineering workspace</p>
        <h1 id="overview" className="aim-page-title">AIM overview</h1>
        <p className="aim-page-intro">
          The browser presents information and requests actions. Engineering
          calculations, authorization, approvals, and controlled records belong
          to the authoritative backend.
        </p>
      </div>

      <div className="aim-content-stack">
        {/* Keep the existing fragment navigation stable while the new server
            register owns its accessible Card heading and session scope. */}
        <div id="asset-register">
          <AuthenticatedAssetRegister boundary={authBoundary} />
        </div>

        <AssetOverview state={initialAssetState} />

        <Card
          id="assurance-lifecycle"
          title="Assurance lifecycle"
          description="Conceptual information flow, not live workflow status"
        >
          <ol className="aim-lifecycle-list" role="list">
            {lifecycleStages.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>
        </Card>
      </div>
    </AppShell>
  );
}
