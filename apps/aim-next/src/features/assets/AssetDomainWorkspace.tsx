import {useMemo,useState,type JSX,type ReactNode} from "react";
import {ASSET_KINDS,ASSET_STATES,assetHierarchy,filterAssetRecords,parseAssetSnapshot,previewAssetImport,
  type AssetRecord,type AssetSnapshot,type AssetKind,type AssetState,type AssetFilter} from "./assetModel";

export type AssetDomainWorkspaceProps = Readonly<{
  screenId:string;
  /** A trusted upstream caller must supply tenant-authorized records. This UI never grants access. */
  snapshot?:unknown;
  onNavigate:(screenId:string)=>void;
  selectedAssetId?:string|undefined;
  onAssetSelect?:(assetId:string)=>void;
}>;
const EMPTY:AssetSnapshot=Object.freeze({assets:Object.freeze([]),relationships:Object.freeze([]),history:Object.freeze([])});
const EMPTY_FILTER:AssetFilter={search:"",kind:"ALL",state:"ALL",sort:"TAG_ASC"};
const DISPLAY_PAGE_SIZE=12;
function Empty({title,detail}:{title:string;detail:string}):JSX.Element {
  return <div className="air-empty" role="status"><span className="air-empty-symbol" aria-hidden="true">◇</span><strong>{title}</strong><p>{detail}</p></div>;
}
function Status({state}:{state:AssetState}):JSX.Element {return <span className={`air-status air-status-${state.toLowerCase()}`}>{state}</span>;}
function NavButton({to,onNavigate,children}:{to:string;onNavigate:(id:string)=>void;children:ReactNode}):JSX.Element {
  return <button type="button" className="air-link" onClick={()=>onNavigate(to)}>{children} <span aria-hidden="true">↗</span></button>;
}
function Identity({asset}:{asset:AssetRecord}):JSX.Element {
  return <div className="air-identity"><span className="air-equipment-mark">{asset.kind==="EQUIPMENT"?"EQ":"CP"}</span>
    <div><strong>{asset.tag}</strong><span>{asset.name}</span><small>{asset.id}</small></div><Status state={asset.state}/></div>;
}
function SmallField({label,value}:{label:string;value:string|undefined}):JSX.Element {
  return <div className="air-attribute"><span>{label}</span><strong>{value||"Not provided"}</strong></div>;
}
function AssetRegister({data,onOpen}:{data:AssetSnapshot;onOpen:(asset:AssetRecord)=>void}):JSX.Element {
  const [filters,setFilters]=useState<AssetFilter>(EMPTY_FILTER);
  const [page,setPage]=useState(1);
  const filtered=useMemo(()=>filterAssetRecords(data.assets,filters),[data.assets,filters]);
  const lastPage=Math.max(1,Math.ceil(filtered.length/DISPLAY_PAGE_SIZE));
  const activePage=Math.min(page,lastPage);
  const visible=filtered.slice((activePage-1)*DISPLAY_PAGE_SIZE,activePage*DISPLAY_PAGE_SIZE);
  const change=(update:Partial<AssetFilter>)=>{setFilters(f=>({...f,...update}));setPage(1);};
  return <div className="air-view">
    <div className="air-metrics"><div><span>Supplied assets</span><strong>{data.assets.length}</strong></div><div><span>Equipment</span><strong>{data.assets.filter(a=>a.kind==="EQUIPMENT").length}</strong></div><div><span>Components</span><strong>{data.assets.filter(a=>a.kind==="COMPONENT").length}</strong></div><div><span>Unknown lifecycle</span><strong>{data.assets.filter(a=>a.state==="UNKNOWN").length}</strong></div></div>
    <div className="air-toolbar"><label>Find asset<input type="search" placeholder="Tag, equipment, system, material…" value={filters.search} onChange={e=>change({search:e.target.value})}/></label>
      <label>Object type<select value={filters.kind} onChange={e=>change({kind:e.target.value as AssetKind|"ALL"})}><option value="ALL">All objects</option>{ASSET_KINDS.map(k=><option key={k}>{k}</option>)}</select></label>
      <label>Lifecycle<select value={filters.state} onChange={e=>change({state:e.target.value as AssetState|"ALL"})}><option value="ALL">All states</option>{ASSET_STATES.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Order<select value={filters.sort} onChange={e=>change({sort:e.target.value as AssetFilter["sort"]})}><option value="TAG_ASC">Tag A–Z</option><option value="TAG_DESC">Tag Z–A</option><option value="NAME_ASC">Name A–Z</option></select></label>
    </div>
    {filtered.length===0?<Empty title={data.assets.length===0?"No assets supplied":"No matching assets"} detail={data.assets.length===0?"An authorized source must supply asset records. The design preview does not generate equipment data.":"Change the filters to broaden the results."}/>:<>
      <div className="air-table-scroll" role="region" aria-label="Asset register table" tabIndex={0}><table className="air-table"><caption className="next-sr-only">Authorized asset records supplied to this frontend, sorted locally.</caption><thead><tr><th scope="col">Asset tag</th><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Functional location</th><th scope="col">Lifecycle</th><th scope="col">Details</th></tr></thead><tbody>{visible.map(a=><tr key={a.id}><th scope="row">{a.tag}</th><td>{a.name}</td><td>{a.kind}</td><td>{a.functionalLocation??"Not provided"}</td><td><Status state={a.state}/></td><td><button type="button" onClick={()=>onOpen(a)} aria-label={`Open ${a.tag} workspace`}>Open ↗</button></td></tr>)}</tbody></table></div>
      <div className="air-pagination"><span>Showing {(activePage-1)*DISPLAY_PAGE_SIZE+1}–{Math.min(activePage*DISPLAY_PAGE_SIZE,filtered.length)} of {filtered.length} locally matching supplied records</span><div><button type="button" disabled={activePage===1} onClick={()=>setPage(Math.max(1,activePage-1))}>Previous</button><span>Page {activePage} / {lastPage}</span><button type="button" disabled={activePage===lastPage} onClick={()=>setPage(Math.min(lastPage,activePage+1))}>Next</button></div></div>
    </>}
    <p className="air-footnote">Local exploration of an already authorized snapshot. These counts are not enterprise totals; no backend query or save occurs here.</p>
  </div>;
}
function AssetHierarchy({data,onOpen}:{data:AssetSnapshot;onOpen:(asset:AssetRecord)=>void}):JSX.Element {
  const [mode,setMode]=useState<"PHYSICAL"|"SYSTEM"|"LOCATION">("PHYSICAL");
  const [expanded,setExpanded]=useState<ReadonlySet<string>>(()=>new Set());
  const rows=useMemo(()=>assetHierarchy(data.assets),[data.assets]);
  const groups=useMemo(()=>{
    const map=new Map<string,AssetRecord[]>();for(const a of data.assets){const key=mode==="SYSTEM"?a.system??"Unassigned system":a.functionalLocation??"Unassigned location";const v=map.get(key)??[];v.push(a);map.set(key,v);}
    return [...map].sort((a,b)=>a[0].localeCompare(b[0]));
  },[data.assets,mode]);
  const toggle=(id:string)=>setExpanded(p=>{const next=new Set(p);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const children=new Set(data.assets.map(a=>a.parentId).filter(Boolean));
  const visibleRows=useMemo(()=>{
    const openDepth:boolean[]=[];
    return rows.filter(({asset,depth})=>{
      const visible=depth===0||openDepth[depth-1]===true;
      openDepth[depth]=visible&&expanded.has(asset.id);
      return visible;
    });
  },[rows,expanded]);
  return <div className="air-view"><div className="air-switch" role="group" aria-label="Hierarchy view">
    {(["PHYSICAL","SYSTEM","LOCATION"] as const).map(m=><button type="button" key={m} className={mode===m?"active":""} aria-pressed={mode===m} onClick={()=>setMode(m)}>{m==="PHYSICAL"?"Physical structure":m==="SYSTEM"?"Systems":"Functional locations"}</button>)}
    </div>{data.assets.length===0?<Empty title="No hierarchy supplied" detail="Asset structure, systems, and functional locations require authoritative AIR records."/>:
    mode==="PHYSICAL"?<div className="air-tree" role="tree" aria-label="Physical asset hierarchy">{visibleRows.map(({asset,depth})=>{
      const expandable=children.has(asset.id);
      return <div key={asset.id} role="treeitem" aria-level={depth+1} aria-expanded={expandable?expanded.has(asset.id):undefined} className="air-tree-row" style={{paddingInlineStart:`${depth*24+12}px`}}>
        {expandable?<button type="button" aria-label={`${expanded.has(asset.id)?"Collapse":"Expand"} ${asset.tag}`} onClick={()=>toggle(asset.id)}>{expanded.has(asset.id)?"▾":"▸"}</button>:<span className="air-tree-spacer"/>}
        <button type="button" onClick={()=>onOpen(asset)}><b>{asset.tag}</b><span>{asset.name}</span></button><Status state={asset.state}/>
      </div>;
    })}</div>:<div className="air-groups">{groups.map(([group,assets])=><section key={group}><h3>{group} <small>{assets.length} assets</small></h3>{assets.sort((a,b)=>a.tag.localeCompare(b.tag)).map(a=><button type="button" key={a.id} onClick={()=>onOpen(a)}><b>{a.tag}</b><span>{a.name}</span><Status state={a.state}/></button>)}</section>)}</div>}
    <p className="air-footnote">Hierarchy and memberships are rendered from explicit supplied records. The UI does not infer physical or functional relationships.</p>
  </div>;
}
function AssetDetail({data,asset,onNavigate}:{data:AssetSnapshot;asset:AssetRecord|null;onNavigate:(id:string)=>void}):JSX.Element {
  const [tab,setTab]=useState<"DETAIL"|"COMPONENTS"|"RELATIONS"|"HISTORY">("DETAIL");
  if(!asset)return <Empty title="No asset selected" detail="Open an asset from the register or hierarchy to inspect its supplied master-data context."/>;
  const children=data.assets.filter(a=>a.parentId===asset.id);
  const relations=data.relationships.filter(r=>r.sourceId===asset.id||r.targetId===asset.id);
  const history=data.history.filter(h=>h.assetId===asset.id).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
  const ids=new Map(data.assets.map(a=>[a.id,a]));
  return <div className="air-view"><Identity asset={asset}/><div className="air-switch" role="tablist" aria-label="Asset information">
    {(["DETAIL","COMPONENTS","RELATIONS","HISTORY"] as const).map(t=><button type="button" role="tab" key={t} aria-selected={tab===t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t==="DETAIL"?"Master data":t==="COMPONENTS"?`Children (${children.length})`:t==="RELATIONS"?`Links (${relations.length})`:`History (${history.length})`}</button>)}
  </div>
  {tab==="DETAIL"?<><div className="air-attributes"><SmallField label="Identity" value={asset.id}/><SmallField label="Kind" value={asset.kind}/><SmallField label="Revision" value={asset.revision}/><SmallField label="Parent" value={asset.parentId?ids.get(asset.parentId)?.tag:undefined}/><SmallField label="System" value={asset.system}/><SmallField label="Functional location" value={asset.functionalLocation}/><SmallField label="Material" value={asset.material}/><SmallField label="Design code" value={asset.designCode}/><SmallField label="Manufacturer" value={asset.manufacturer}/></div><div className="air-nav-row"><NavButton to="SCR-AIR-004" onNavigate={onNavigate}>Prepare master-data draft</NavButton><NavButton to="SCR-AIR-002" onNavigate={onNavigate}>View hierarchy</NavButton></div><p className="air-footnote">Cross-domain integrity information is not duplicated into AIR. Open its owning domain workspace for assessments, evidence and decisions.</p></>:
  tab==="COMPONENTS"?children.length===0?<Empty title="No child assets supplied" detail="There are no component relationships in this authorized snapshot."/>:<div className="air-list">{children.map(a=><Identity key={a.id} asset={a}/>)}</div>:
  tab==="RELATIONS"?relations.length===0?<Empty title="No verified links supplied" detail="Relationships require explicit references and provenance."/>:<div className="air-list">{relations.map(r=><div key={r.id} className="air-evidence-row"><b>{r.kind.replaceAll("_"," ")}</b><span>{ids.get(r.sourceId)?.tag} → {ids.get(r.targetId)?.tag}</span><small>Source: {r.sourceReference}</small></div>)}</div>:
  history.length===0?<Empty title="No history supplied" detail="No referenced lifecycle events are available for this asset."/>:<ol className="air-timeline">{history.map(h=><li key={h.id}><time dateTime={h.occurredAt}>{new Date(h.occurredAt).toLocaleDateString("en-GB",{year:"numeric",month:"short",day:"2-digit",timeZone:"UTC"})}</time><strong>{h.description}</strong><small>Source: {h.sourceReference}</small></li>)}</ol>}
  </div>;
}
function EditDraft({asset}:{asset:AssetRecord|null}):JSX.Element {
  const [draft,setDraft]=useState<{name:string;material:string;designCode:string;functionalLocation:string}>({name:asset?.name??"",material:asset?.material??"",designCode:asset?.designCode??"",functionalLocation:asset?.functionalLocation??""});
  const [sourceId,setSourceId]=useState(asset?.id??"");
  if(!asset)return <Empty title="No master record selected" detail="Choose an asset from the register first. No backend editing is connected."/>;
  const values=sourceId===asset.id?draft:{name:asset.name,material:asset.material??"",designCode:asset.designCode??"",functionalLocation:asset.functionalLocation??""};
  const update=(field:keyof typeof values,value:string)=>{setSourceId(asset.id);setDraft(p=>({...((sourceId===asset.id)?p:values),[field]:value}));};
  return <div className="air-view"><Identity asset={asset}/><div className="air-warning"><strong>Local, unsaved draft</strong><p>These inputs demonstrate AIR master-data editing only. No authoritative record, tag, lifecycle or asset identity can be changed here.</p></div>
    <form className="air-edit" onSubmit={e=>e.preventDefault()} aria-label="Unsaved asset master-data draft">
      {(["name","material","designCode","functionalLocation"] as const).map(k=><label key={k}>{({name:"Asset name",material:"Material",designCode:"Design code",functionalLocation:"Functional location"})[k]}<input value={values[k]} maxLength={400} onChange={e=>update(k,e.target.value)}/></label>)}
      <div className="air-actions"><button type="button" onClick={()=>{setSourceId(asset.id);setDraft({name:asset.name,material:asset.material??"",designCode:asset.designCode??"",functionalLocation:asset.functionalLocation??""});}}>Reset draft</button><button type="button" disabled>Save to authoritative register unavailable</button></div>
    </form><p className="air-footnote">Physical replacement requires a new identity and revision semantics. This form never silently changes lifecycle state.</p></div>;
}
const CSV_TEMPLATE="id,tag,name,kind,state,parentId,system,functionalLocation";
function ImportPreview({data}:{data:AssetSnapshot}):JSX.Element {
  const [csv,setCsv]=useState(CSV_TEMPLATE+"\n");
  const preview=useMemo(()=>previewAssetImport(csv,data.assets),[csv,data.assets]);
  return <div className="air-view"><div className="air-warning"><strong>Staging / validation preview only</strong><p>Paste CSV to validate structure and identity against supplied assets. No upload, persistence, approval, retirement or promotion occurs.</p></div>
    <label className="air-csv-label">CSV staging input<textarea rows={8} spellCheck={false} aria-label="CSV staging input" value={csv} onChange={e=>setCsv(e.target.value)} maxLength={1024*1024}/></label>
    <div className="air-import-summary"><span>Parsed source rows <b>{preview.totalRows}</b></span><span>Valid staged candidates <b>{preview.rows.length}</b></span><span>Validation issues <b>{preview.issues.length}</b></span></div>
    {preview.issues.length>0?<div className="air-issues" role="alert"><strong>Cannot promote this batch</strong><ul>{preview.issues.map((issue,i)=><li key={`${issue}-${i}`}>{issue}</li>)}</ul></div>:
      preview.rows.length>0?<div className="air-table-scroll" role="region" aria-label="Import staging preview" tabIndex={0}><table className="air-table"><thead><tr><th>ID</th><th>Tag</th><th>Name</th><th>Kind</th><th>State</th></tr></thead><tbody>{preview.rows.slice(0,50).map(a=><tr key={a.id}><td>{a.id}</td><td>{a.tag}</td><td>{a.name}</td><td>{a.kind}</td><td>{a.state}</td></tr>)}</tbody></table><p className="air-footnote">Showing at most 50 of {preview.rows.length} staged candidates.</p></div>:
      <Empty title="No import candidates" detail="Use the exact column headers shown above and paste asset records to preview validation."/>}
    <button type="button" className="air-disabled-action" disabled>Authorize and commit import unavailable</button>
  </div>;
}
function Relationships({data,asset,onOpen}:{data:AssetSnapshot;asset:AssetRecord|null;onOpen:(asset:AssetRecord)=>void}):JSX.Element {
  const byId=new Map(data.assets.map(a=>[a.id,a]));
  const related=asset?data.relationships.filter(r=>r.sourceId===asset.id||r.targetId===asset.id):data.relationships;
  return <div className="air-view">
    {asset?<Identity asset={asset}/>:<p className="air-footnote">Select an asset in the register to focus the relationship explorer. Showing all supplied explicit relationships.</p>}
    {related.length===0?<Empty title="No source-backed relationships supplied" detail="Relationships require authoritative source records. This explorer does not invent graph edges."/>:
      <div className="air-relations">{related.map(r=><div key={r.id} className="air-relation-card"><div className="air-connector"><button type="button" onClick={()=>onOpen(byId.get(r.sourceId)!)}>{byId.get(r.sourceId)?.tag}</button><span>{r.kind.replaceAll("_"," ")} →</span><button type="button" onClick={()=>onOpen(byId.get(r.targetId)!)}>{byId.get(r.targetId)?.tag}</button></div><small>Source reference: {r.sourceReference}</small></div>)}</div>}
    <p className="air-footnote">Visual association is not engineering evidence and cannot mutate the linked objects.</p></div>;
}
export function AssetDomainWorkspace({screenId,snapshot,onNavigate,selectedAssetId,onAssetSelect}:AssetDomainWorkspaceProps):JSX.Element {
  const parsed=useMemo(()=>snapshot==null?null:parseAssetSnapshot(snapshot),[snapshot]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const data=parsed?.ok?parsed.snapshot:EMPTY;
  const asset=data.assets.find(a=>a.id===(selectedAssetId??selectedId))??null;
  function open(assetRecord:AssetRecord):void{setSelectedId(assetRecord.id);onAssetSelect?.(assetRecord.id);onNavigate("SCR-AIR-003");}
  if(parsed&&!parsed.ok)return <div className="air-view"><div role="alert" className="air-issues"><strong>Asset snapshot rejected</strong><p>One or more records, references or hierarchy links are malformed. No partial asset data is displayed.</p><ul>{parsed.issues.slice(0,8).map((issue,i)=><li key={i}>{issue}</li>)}</ul></div></div>;
  const connected=parsed?.ok===true;
  return <section className="air-workspace" aria-label="Asset Integrity Registry workspace">
    <div className="air-context-strip"><span className="air-kicker">AIR · ASSET INTEGRITY REGISTRY</span><span>{connected?"Snapshot supplied · read-only":"No data source connected"}</span>{asset&&<span>Selected: <b>{asset.tag}</b></span>}</div>
    {!connected&&<div className="air-disconnected" role="status">AIR data source not connected. The interfaces below are functional, but no actual equipment, relationships or history have been supplied.</div>}
    {screenId==="SCR-AIR-001"?<AssetRegister data={data} onOpen={open}/>:
    screenId==="SCR-AIR-002"?<AssetHierarchy data={data} onOpen={open}/>:
    screenId==="SCR-AIR-003"?<AssetDetail data={data} asset={asset} onNavigate={onNavigate}/>:
    screenId==="SCR-AIR-004"?<EditDraft key={asset?.id??"none"} asset={asset}/>:
    screenId==="SCR-AIR-005"?<ImportPreview data={data}/>:
    screenId==="SCR-AIR-006"?<Relationships data={data} asset={asset} onOpen={open}/>:
    <Empty title="Unknown AIR screen" detail="No frontend is registered for this screen identifier."/>}
    {asset&&screenId!=="SCR-AIR-003"&&screenId!=="SCR-AIR-004"&&<button type="button" className="air-context-shortcut" onClick={()=>onNavigate("SCR-AIR-003")}>Open selected asset workspace · {asset.tag} ↗</button>}
  </section>;
}
