import {useState,type JSX} from "react";
import type {DiscoveryResult} from "../discovery/discoveryModel";
import {matchDiscoveryContext,parseRecordContextSnapshot,relatedAuthorizedResults,type RecordContextSnapshot} from "./recordContextModel";

type Panel = "EVIDENCE"|"REVISIONS"|"RELATED";
export type SharedRecordDossierProps=Readonly<{
  snapshot?:unknown;scopeKey?:string|undefined;record:DiscoveryResult;
  visibleResults:readonly DiscoveryResult[];onSelectRelated:(searchId:string)=>void;
}>;
function Content({snapshot,record,visibleResults,onSelectRelated}:{snapshot:RecordContextSnapshot;record:DiscoveryResult;
  visibleResults:readonly DiscoveryResult[];onSelectRelated:(searchId:string)=>void}):JSX.Element{
  const [panel,setPanel]=useState<Panel>("EVIDENCE");
  const match=matchDiscoveryContext(record,snapshot);
  if(match.state!=="MATCHED"&&match.state==="NOT_SUPPLIED")return <p className="dossier-empty" role="status">No shared record dossier supplied for this authorized search result. Evidence existence or absence cannot be inferred.</p>;
  if(match.state!=="MATCHED")return <p className="dossier-alert" role="alert">Search record and shared dossier have mismatched identity, revision, state or source. Shared details are withheld.</p>;
  const evidence=snapshot.evidence.filter(e=>e.recordId===match.record.id);
  const revisions=snapshot.revisions.filter(r=>r.recordId===match.record.id).sort((a,b)=>Date.parse(b.changedAt)-Date.parse(a.changedAt));
  const related=relatedAuthorizedResults(record.id,snapshot,visibleResults);
  return <section className="dossier-panel" aria-label="Shared record dossier">
    <p className="dossier-scope">SOURCE-BACKED · READ-ONLY · {match.record.domain} · {match.record.revision}</p>
    <div className="dossier-tabs" role="group" aria-label="Shared record sections">
      {(["EVIDENCE","REVISIONS","RELATED"] as const).map(tab=><button key={tab} type="button" aria-pressed={panel===tab} className={panel===tab?"active":""} onClick={()=>setPanel(tab)}>{tab=== "REVISIONS"?"Revision history":tab==="RELATED"?"Related records":"Evidence"}</button>)}
    </div>
    {panel==="EVIDENCE"&&<div className="dossier-items" aria-label="Evidence references">
      {evidence.length===0?<p className="dossier-empty">No evidence references were supplied in this authorized dossier. This is not proof that evidence does not exist.</p>:evidence.map(e=><article className="dossier-entry" key={e.id}>
        <header><strong>{e.kind}</strong><span className={`discover-state state-${e.state.toLowerCase()}`}>{e.state}</span></header>
        <dl><div><dt>Evidence reference</dt><dd>{e.evidenceRef}</dd></div><div><dt>Source</dt><dd>{e.sourceRef}</dd></div>
        <div><dt>Associated revision</dt><dd>{revisions.find(r=>r.id===e.revisionId)?.revision??"Unavailable"}</dd></div>
        <div><dt>Recorded</dt><dd>{e.recordedAt}</dd></div>{e.sha256&&<div><dt>Claimed SHA-256</dt><dd><code>{e.sha256}</code></dd></div>}</dl>
      </article>)}
      <p className="dossier-footnote">References and digests are source metadata only. This UI cannot retrieve files, validate file bytes, or certify evidence.</p>
    </div>}
    {panel==="REVISIONS"&&<div className="dossier-items" aria-label="Revision history entries">
      {revisions.map(r=><article className="dossier-entry" key={r.id}>
        <header><strong>{r.revision} {r.revision===record.revision?"· Current source revision":""}</strong><span>{r.reviewState}</span></header>
        <dl><div><dt>Changed</dt><dd>{r.changedAt}</dd></div><div><dt>Change basis</dt><dd>{r.changeRef}</dd></div>
          <div><dt>Source</dt><dd>{r.sourceRef}</dd></div><div><dt>Predecessor</dt><dd>{revisions.find(p=>p.id===r.priorRevisionId)?.revision??"Not supplied"}</dd></div>
          {r.reviewerRef&&<div><dt>Recorded reviewer</dt><dd>{r.reviewerRef}</dd></div>}
          {r.reviewedAt&&<div><dt>Reviewed at</dt><dd>{r.reviewedAt}</dd></div>}
        </dl>
      </article>)}
      <p className="dossier-footnote">Review metadata is not an approval credential. Only the owning engineering service can establish authorization.</p>
    </div>}
    {panel==="RELATED"&&<div className="dossier-items" aria-label="Related authorized records">
      {related.length===0?<p className="dossier-empty">No related record is available in the current authorized search results and filters. Hidden or unlisted records are not disclosed.</p>:related.map(({relation,target})=><article className="dossier-entry" key={relation.id}>
        <header><strong>{relation.kind}</strong><span>{target.domain}</span></header>
        <p>{target.title} · {target.objectRef}</p><p className="dossier-source">Basis: {relation.basisRef} · {relation.recordedAt}</p>
        <button type="button" onClick={()=>onSelectRelated(target.id)}>Inspect related record ({target.domain})</button>
      </article>)}
      <p className="dossier-footnote">Related records are selectable only when separately present in the scope-authorized search result set and current filters. This is not a cross-tenant lookup.</p>
    </div>}
  </section>;
}
export function SharedRecordDossier({snapshot,scopeKey,record,visibleResults,onSelectRelated}:SharedRecordDossierProps):JSX.Element{
  if(snapshot==null)return <p className="dossier-empty" role="status">Shared evidence and revision index disconnected; no dossier references supplied.</p>;
  const parsed=parseRecordContextSnapshot(snapshot,scopeKey??"");
  if(!parsed.ok)return <div className="dossier-alert" role="alert">Shared evidence/revision dataset rejected. No partial dossier or related records are displayed.</div>;
  return <Content key={`${record.id}\u0000${record.revision}`} snapshot={parsed.snapshot} record={record} visibleResults={visibleResults} onSelectRelated={onSelectRelated}/>;
}
