import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AuthSessionBoundary } from "@bandha/aim-platform/auth/authSession";
import { ServerAssetRegister } from "@bandha/aim-platform/assets/ServerAssetRegister";
import type { AdaptedAssetPage } from "@bandha/aim-platform/assets/assetRegisterAdapter";
import { projectAssetRegisterPage, selectionIsVisible, selectVisibleAsset,
  type AssetPageSelection } from "./assetRegisterReadModel";
import { useAuthenticatedAssetPage } from "./useAuthenticatedAssetPage";
import { useAuthorizedAssetDetail } from "./useAuthorizedAssetDetail";
import { AuthorizedAssetEvidenceInspector } from "./AuthorizedAssetEvidenceInspector";

/**
 * An independently mountable Stage 45.4 integration slice.
 * Stage 45.8 mounts this optionally inside the AIM Next shell without
 * adding a canonical engineering screen or granting authentication.
 * The server must separately authorize the detail endpoint when implemented.
 */
type SourceBoundSelection = Readonly<{
  selection: AssetPageSelection;
  /** Identity of the validated register response that opened this detail. */
  sourcePage: AdaptedAssetPage;
}>;

export function AuthenticatedAssetInvestigation({ boundary }: Readonly<{
  boundary: AuthSessionBoundary | null;
}>): JSX.Element {
  const { phase, sessionRevision, register } = useAuthenticatedAssetPage(boundary);
  const [storedSelection, setStoredSelection] = useState<SourceBoundSelection | null>(null);
  // A changed list query or session cancels the previous inspection explicitly.
  useEffect(() => { setStoredSelection(null); }, [sessionRevision,
    register.query.page, register.query.pageSize, register.query.search,
    register.query.risk, register.query.evidence]);
  const sourcePage = phase === "authenticated" && register.state.kind === "ready"
    ? register.state.page : null;
  const page = sourcePage === null ? null : projectAssetRegisterPage(sourcePage);
  // A selection is valid only under the EXACT decoded page that opened it.
  // A same-query refresh replaces the source page, invalidating the detail
  // synchronously even before the reset effect runs. This is conservative:
  // the same asset must be explicitly reopened after any list refresh.
  const selection = page !== null && storedSelection !== null &&
    sourcePage === storedSelection.sourcePage &&
    selectionIsVisible(storedSelection.selection, page, sessionRevision)
    ? storedSelection.selection : null;
  const detail = useAuthorizedAssetDetail(boundary, selection);

  return <section aria-label="Authorized asset investigation">
    <h2>Asset investigation</h2>
    <p>Read-only preview. Authentication, asset access and engineering authority belong to the backend.</p>
    <p role="status">Session: {phase}</p>
    <button type="button" disabled={phase !== "authenticated"}
      onClick={register.retry}>Refresh Asset Register</button>
    <ServerAssetRegister {...register} />
    {page !== null && sourcePage !== null && <section aria-label="Open authorized Asset Detail">
      <h3>Open Asset Detail</h3>
      <p>Choose an asset returned in this authorized register page. Detail access is checked independently.</p>
      <ul>{page.items.map(item => <li key={item.assetId}>
        <button type="button" onClick={() => {
          const selected = selectVisibleAsset(page, item.assetId, sessionRevision);
          setStoredSelection(selected === null ? null : { selection: selected, sourcePage });
        }}>
          Open {item.tag} — {item.name}
        </button>
      </li>)}</ul>
    </section>}
    {selection !== null && <section aria-label="Selected Asset Detail">
      <h3>Asset Detail</h3>
      <button type="button" onClick={() => setStoredSelection(null)}>Close detail</button>
      {detail.state.kind === "loading" && <p role="status">Loading authorized asset detail…</p>}
      {detail.state.kind === "error" && <div role="alert">
        <p>Asset Detail unavailable: {detail.state.failure.kind.replaceAll("_", " ")}.</p>
        {detail.state.failure.kind !== "access_denied" &&
          detail.state.failure.kind !== "authentication_required" &&
          <button type="button" onClick={detail.retry}>Retry Asset Detail</button>}
      </div>}
      {detail.state.kind === "ready" && <dl>
        <dt>Asset ID</dt><dd>{detail.state.detail.asset.id}</dd>
        <dt>Asset tag</dt><dd>{detail.state.detail.asset.tag}</dd>
        <dt>Asset name</dt><dd>{detail.state.detail.asset.name}</dd>
        <dt>Displayed revision</dt><dd>{detail.state.detail.revision.label} ({detail.state.detail.revision.state})</dd>
        <dt>Revision identity</dt><dd>{detail.state.detail.revision.id}</dd>
        <dt>Source reference</dt><dd>{detail.state.detail.revision.sourceReference}</dd>
        <dt>Current governing revision ID (reported)</dt>
        <dd>{detail.state.detail.governingRevisionId ?? "Not supplied"}</dd>
      </dl>}
      {detail.state.kind === "ready" && <AuthorizedAssetEvidenceInspector
        key={`${detail.state.detail.asset.id}:${detail.state.detail.revision.id}:${sessionRevision}`}
        boundary={boundary} detail={detail.state.detail} sessionRevision={sessionRevision} />}
    </section>}
  </section>;
}
