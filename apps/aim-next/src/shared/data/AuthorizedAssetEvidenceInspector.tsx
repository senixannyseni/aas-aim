import { useId, useState, type JSX } from "react";
import type { AuthSessionBoundary } from "@bandha/aim-platform/auth/authSession";
import type { AssetDetailReadModel } from "./assetDetailReadModel";
import { useAuthorizedAssetEvidence } from "./useAuthorizedAssetEvidence";
import type { EvidenceGroup } from "./assetEvidenceReadModel";

type EvidenceViewProps = Readonly<{
  boundary: AuthSessionBoundary | null;
  detail: AssetDetailReadModel;
  sessionRevision: number;
  group: EvidenceGroup;
}>;

/**
 * One group owns its own bounded cursor trail. The keyed component is fully
 * remounted on group switch so an old snapshot/cursor cannot silently become
 * active again when the user returns to a previous evidence group.
 */
function EvidencePagePanel({ boundary, detail, sessionRevision, group }: EvidenceViewProps): JSX.Element {
  const data = useAuthorizedAssetEvidence(boundary, {
    assetId: detail.asset.id, revisionId: detail.revision.id, group, sessionRevision,
  });
  return <section aria-label={`${group === "HISTORICAL" ? "Historical" : "Displayed revision"} evidence page results`} aria-busy={data.state.kind === "loading"}>
    {data.state.kind === "idle" && <p role="status">Evidence is not connected to an authorized session.</p>}
    {data.state.kind === "loading" && <p role="status">Loading authorized evidence references…</p>}
    {data.state.kind === "error" && <div role="alert">
      <p>Evidence references unavailable: {data.state.failure.kind.replaceAll("_", " ")}.</p>
      {data.state.failure.kind !== "access_denied" &&
        data.state.failure.kind !== "authentication_required" &&
        <button type="button" onClick={data.retry}>
          {data.state.failure.kind === "source_generation_changed"
            ? "Restart evidence from page 1" : "Retry evidence"}
        </button>}
    </div>}
    {data.state.kind === "ready" && <>
      <p role="status">Page {data.state.pageNumber}; {data.state.page.items.length} reference(s) on this page.
        Counts cover only returned authorized references, not all evidence that may exist.</p>
      {data.state.page.items.length === 0 ? <p>No authorized evidence references returned for this revision scope.</p> :
        <ul>{data.state.page.items.map(item => <li key={item.id}>
          <article>
            <h5>{item.kind} — {item.id}</h5>
            <dl>
              <dt>Associated revision</dt><dd>{item.revisionId}</dd>
              <dt>Association</dt><dd>{item.association === "USED_AS_BASIS" ?
                "Reported as a technical basis" : "Associated only"}</dd>
              <dt>Evidence quality</dt><dd>{item.quality}</dd>
              <dt>Source availability</dt><dd>{item.availability}</dd>
              <dt>Recorded at</dt><dd>{item.recordedAt}</dd>
              <dt>Source reference</dt><dd>{item.sourceReference ?? "Unavailable"}</dd>
              <dt>Basis reference</dt><dd>{item.basisReference ?? "Not asserted"}</dd>
            </dl>
          </article>
        </li>)}</ul>}
      <nav aria-label="Evidence page controls">
        <button type="button" disabled={!data.hasPreviousPage} onClick={data.previousPage}>Previous page</button>
        <button type="button" disabled={!data.hasNextPage} onClick={data.nextPage}>Next page</button>
      </nav>
    </>}
  </section>;
}

/**
 * Read-only source metadata. Source references are deliberately text, not
 * clickable URLs; list membership never independently grants source access.
 * Source bodies require a separately authorized endpoint outside this stage.
 */
export function AuthorizedAssetEvidenceInspector({ boundary, detail, sessionRevision }: Readonly<{
  boundary: AuthSessionBoundary | null;
  detail: AssetDetailReadModel;
  sessionRevision: number;
}>): JSX.Element {
  const [group, setGroup] = useState<EvidenceGroup>("DISPLAYED_REVISION");
  // Unique even if multiple inspectors share the same asset/session.
  const groupName = useId();
  return <section aria-label="Authorized asset evidence">
    <h4>Evidence references</h4>
    <p>These are source-reported associations, not independent proof of engineering fitness or access to source contents.</p>
    <fieldset>
      <legend>Evidence revision scope</legend>
      <label><input type="radio" name={groupName}
        checked={group === "DISPLAYED_REVISION"}
        onChange={() => setGroup("DISPLAYED_REVISION")} /> Displayed revision</label>
      <label><input type="radio" name={groupName}
        checked={group === "HISTORICAL"}
        onChange={() => setGroup("HISTORICAL")} /> Historical predecessors</label>
    </fieldset>
    <p>Displayed revision: {detail.revision.label} ({detail.revision.state}).
      Governing revision ID reported: {detail.governingRevisionId ?? "not supplied"}.</p>
    <EvidencePagePanel key={group} boundary={boundary} detail={detail}
      sessionRevision={sessionRevision} group={group} />
    <p>Navigation is bounded to 100 pages per evidence scope. Evidence beyond that window
      requires a future server-side search or export workflow.</p>
    <p>Unavailable references are not treated as valid readings. Restricted evidence must not be included in this authorized list.</p>
  </section>;
}
