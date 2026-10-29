import {useMemo,useState,type JSX} from "react";
import {DOMAINS,type DomainCode} from "../../capabilityRegistry";
import {DISCOVERY_STATES,filterDiscoveryResults,parseDiscoverySnapshot,type DiscoveryResult,type DiscoveryState} from "./discoveryModel";
import {SharedRecordDossier} from "../record-context/SharedRecordDossier";

export type UniversalSearchWorkspaceProps=Readonly<{
  snapshot?:unknown;
  recordContextSnapshot?:unknown;
  onOpenRecord?:(record:DiscoveryResult)=>void;
  scopeKey?:string|undefined;
  selectedAssetId?:string|undefined;
  onNavigate:(screenId:string)=>void;
  onSelectAsset:(assetId:string)=>void;
  authorizedAssetIds:readonly string[];
}>;
const PAGE_SIZE=20;
function ResultDetail({record,onNavigate,onOpenRecord,onSelectAsset,authorizedAssetIds,recordContextSnapshot,scopeKey,visibleResults,onSelectRelated}:{record:DiscoveryResult|undefined;onNavigate:(id:string)=>void;onOpenRecord?:((record:DiscoveryResult)=>void)|undefined;onSelectAsset:(id:string)=>void;authorizedAssetIds:readonly string[];recordContextSnapshot?:unknown;scopeKey?:string|undefined;visibleResults:readonly DiscoveryResult[];onSelectRelated:(id:string)=>void}):JSX.Element{
  if(!record)return <div className="discover-empty">Select a result to inspect its source reference, revision and state.</div>;
  return <div className="discover-detail"><span className="discover-eyebrow">SOURCE-BACKED OBJECT</span><h3>{record.title}</h3>
    <dl>{([ ["Canonical domain",record.domain],["Object type",record.objectType],["Object reference",record.objectRef],["Display state",record.state],["Source reference",record.sourceRef],["Revision",record.revision],["Asset reference",record.assetId??"Not provided"],["Occurred at",record.occurredAt??"Not provided"] ] as [string,string][]).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <div className="discover-actions"><button type="button" onClick={()=>onOpenRecord?onOpenRecord(record):onNavigate(record.screenId)}>Open owning screen ({record.screenId})</button>
      {record.assetId&&authorizedAssetIds.includes(record.assetId)&&<button type="button" onClick={()=>onSelectAsset(record.assetId!)}>Set asset navigation context</button>}</div>
    <p className="discover-rule">The owning screen opens without automatically selecting or authorizing this record. Search is a read-only projection, not a domain mutation or permission grant.</p>
    <SharedRecordDossier record={record} snapshot={recordContextSnapshot} scopeKey={scopeKey} visibleResults={visibleResults} onSelectRelated={onSelectRelated}/>
  </div>;
}
function SearchResults({records,selectedAssetId,onNavigate,onOpenRecord,onSelectAsset,authorizedAssetIds,recordContextSnapshot,scopeKey}:{records:readonly DiscoveryResult[];selectedAssetId?:string|undefined;onNavigate:(id:string)=>void;onOpenRecord?:((record:DiscoveryResult)=>void)|undefined;onSelectAsset:(id:string)=>void;authorizedAssetIds:readonly string[];recordContextSnapshot?:unknown;scopeKey?:string|undefined}):JSX.Element{
  const [query,setQuery]=useState("");const [domain,setDomain]=useState<DomainCode|"ALL">("ALL");const [state,setState]=useState<DiscoveryState|"ALL">("ALL");
  const [restrictAsset,setRestrictAsset]=useState(false);const [page,setPage]=useState(0);const [selectedId,setSelectedId]=useState<string|null>(null);
  const filtered=useMemo(()=>filterDiscoveryResults(records,{query,domain,state,assetId:restrictAsset?selectedAssetId:undefined}),[records,query,domain,state,restrictAsset,selectedAssetId]);
  const safePage=Math.min(page,Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1));
  const selected=filtered.find(r=>r.id===selectedId);
  return <div className="discover-layout"><section className="discover-panel"><span className="discover-eyebrow">GOV-012 · AUTHORIZED SEARCH RESULTS</span><h3>Universal object discovery</h3>
    <p className="discover-muted">Search supplied, scope-authorized object references. No hidden domain requests or unverified cross-tenant aggregation occurs.</p>
    <div className="discover-filters"><label>Search objects<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Tag, object, function, source..."/></label>
      <label>Domain<select value={domain} onChange={e=>{setDomain(e.target.value as DomainCode|"ALL");setPage(0);}}><option value="ALL">All domains</option>{DOMAINS.map(d=><option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}</select></label>
      <label>Evidence state<select value={state} onChange={e=>{setState(e.target.value as DiscoveryState|"ALL");setPage(0);}}><option value="ALL">All states</option>{DISCOVERY_STATES.map(s=><option key={s}>{s}</option>)}</select></label></div>
    <label className="discover-asset-filter"><input type="checkbox" disabled={!selectedAssetId} checked={!!selectedAssetId&&restrictAsset} onChange={e=>{setRestrictAsset(e.target.checked);setPage(0);}}/> Restrict to selected asset {selectedAssetId?`(${selectedAssetId})`:"(no asset selected)"}</label>
    <p className="discover-muted" role="status">{filtered.length} authorized result(s) · Page {safePage+1} of {Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))}</p>
    <div className="discover-results" role="region" aria-label="Universal search results">{filtered.slice(safePage*PAGE_SIZE,(safePage+1)*PAGE_SIZE).map(record=><button type="button" key={record.id} aria-pressed={record.id===selected?.id} className={record.id===selected?.id?"is-active":""} onClick={()=>setSelectedId(record.id)}><span><strong>{record.title}</strong><small>{record.domain} · {record.objectType} · {record.objectRef}</small></span><span className={`discover-state state-${record.state.toLowerCase()}`}>{record.state}</span></button>)}{filtered.length===0&&<p className="discover-empty">No matching authorized results. This does not establish that an object is absent outside your authorized source snapshot.</p>}</div>
    <div className="discover-actions"><button type="button" disabled={safePage===0} onClick={()=>setPage(v=>Math.max(0,v-1))}>Previous</button><button type="button" disabled={(safePage+1)*PAGE_SIZE>=filtered.length} onClick={()=>setPage(v=>v+1)}>Next</button></div>
  </section><aside className="discover-panel"><ResultDetail record={selected} onNavigate={onNavigate} onOpenRecord={onOpenRecord} onSelectAsset={onSelectAsset} authorizedAssetIds={authorizedAssetIds} recordContextSnapshot={recordContextSnapshot} scopeKey={scopeKey} visibleResults={filtered} onSelectRelated={id=>{setSelectedId(id);}}/></aside></div>;
}
export function UniversalSearchWorkspace({snapshot,recordContextSnapshot,scopeKey,selectedAssetId,onNavigate,onOpenRecord,onSelectAsset,authorizedAssetIds}:UniversalSearchWorkspaceProps):JSX.Element{
  if(snapshot==null)return <div className="discover-disconnected" role="status"><strong>Universal Search disconnected</strong><p>No authorized search index was supplied. Results and object existence cannot be inferred from domain navigation or mock fixtures.</p></div>;
  const result=parseDiscoverySnapshot(snapshot,scopeKey??"");
  if(!result.ok)return <div className="discover-rejected" role="alert"><strong>Search snapshot rejected</strong><p>Search scope or source integrity is invalid. No partial results will be shown.</p><small>{result.issues.slice(0,5).join(" · ")}</small></div>;
  return <SearchResults key={result.snapshot.scopeKey} records={result.snapshot.records} selectedAssetId={selectedAssetId} onNavigate={onNavigate} onOpenRecord={onOpenRecord} onSelectAsset={onSelectAsset} authorizedAssetIds={authorizedAssetIds} recordContextSnapshot={recordContextSnapshot} scopeKey={scopeKey}/>;
}
