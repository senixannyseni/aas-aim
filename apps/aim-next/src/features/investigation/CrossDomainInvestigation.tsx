import {useMemo,useState, type JSX} from "react";
import {projectCrossDomainInvestigation, type CrossDomainInput, type InvestigationSourceState} from "./crossDomainInvestigationModel";
import {EngineeringEvidenceNavigator} from "./EngineeringEvidenceNavigator";
import type {EngineeringEvidence} from "./engineeringEvidenceModel";

type Props = CrossDomainInput & Readonly<{activeDomain:"AIR"|"COR"|"INS";onNavigate:(screenId:string)=>void}>;
const screens={AIR:"SCR-AIR-003",COR:"SCR-COR-001",INS:"SCR-INS-001"} as const;
const sourceMessage=(state:InvestigationSourceState,kind:string):string=>state==="disconnected"?
  `No independently scoped ${kind} source is connected. No cross-domain records can be displayed.`:
  state==="rejected"?`The entire ${kind} snapshot was rejected. No partial records are disclosed.`:
  `No ${kind} records for this asset appear in the supplied authorized scope. This does not establish that none exist.`;
/** One contextual rail shared by three canonical workspaces. No new screen identity. */
export function CrossDomainInvestigation(props:Props):JSX.Element|null{
  const [selectedCorrosionId,setSelectedCorrosionId]=useState<string|null>(null);
  const [selectedInspectionId,setSelectedInspectionId]=useState<string|null>(null);
  const outcome=useMemo(()=>projectCrossDomainInvestigation(props),[
    props.navigationScopeKey,props.crossDomainScopeKey,props.assetScopeKey,
    props.corrosionScopeKey,props.inspectionScopeKey,props.selectedAssetId,
    props.assetSnapshot,props.corrosionSnapshot,props.inspectionSnapshot,
  ]);
  if(outcome.kind==="disabled"||outcome.kind==="unselected")return null;
  if(outcome.kind==="rejected")return <div className="investigation-rail" role="alert">Asset investigation unavailable: the complete asset source was rejected.</div>;
  const {asset,corrosion,inspection}=outcome.context;
  const openOwningRecord=(evidence:EngineeringEvidence)=>{
    if(evidence.domain==="COR")setSelectedCorrosionId(evidence.ownerRecordId);
    else setSelectedInspectionId(evidence.ownerRecordId);
    props.onNavigate(screens[evidence.domain]);
  };
  const circuit=corrosion.records.find(x=>x.id===selectedCorrosionId)??null;
  const requirement=inspection.records.find(x=>x.id===selectedInspectionId)??null;
  return <section className="investigation-rail" aria-label="Asset to Corrosion to Inspection investigation">
    <div className="investigation-heading">
      <div><span className="next-eyebrow">PHASE 46.4 · SOURCE-BOUND INVESTIGATION</span>
        <h2>{asset.tag} <span>· {asset.name}</span></h2>
        <p>One authorized asset identity · three independent read-only domain views</p></div>
      <code>{asset.id}</code>
    </div>
    <nav className="investigation-steps" aria-label="Cross-domain investigation stages">
      {(["AIR","COR","INS"] as const).map((domain,i)=><button key={domain} type="button"
        aria-current={props.activeDomain===domain?"step":undefined}
        aria-label={`0${i+1} ${domain==="AIR"?"Asset":domain==="COR"?"Corrosion":"Inspection"}`}
        onClick={()=>props.onNavigate(screens[domain])}>
        <span aria-hidden="true">0{i+1}</span><strong>{domain==="AIR"?"Asset":domain==="COR"?"Corrosion":"Inspection"}</strong>
        <small>{domain==="AIR"?"Authorized identity":domain==="COR"?corrosion.state:inspection.state}</small>
      </button>)}
    </nav>
    {props.activeDomain==="AIR"&&<div className="investigation-body" aria-label="Asset context">
      <p>Selected asset: <strong>{asset.tag}</strong>. Lifecycle reported by AIR: <strong>{asset.state}</strong>. Master-data revision: <strong>{asset.revision??"Not provided"}</strong>.</p>
      <p>Follow independently authorized COR and INS source records. The matching asset ID does not establish technical causation, an engineering conclusion or permission to open unavailable data.</p>
    </div>}
    {props.activeDomain==="COR"&&<div className="investigation-body" aria-label="Related corrosion records">
      <h3>Corrosion circuits for {asset.tag}</h3>
      {corrosion.records.length===0?<p role="status">{sourceMessage(corrosion.state,"corrosion")}</p>:<>
        <p>{corrosion.records.length} circuit(s) explicitly linked to this asset in the authorized COR source.</p>
        <div className="investigation-list">{corrosion.records.slice(0,40).map(c=><button key={c.id} type="button" aria-pressed={circuit?.id===c.id}
          onClick={()=>setSelectedCorrosionId(c.id)}><strong>{c.code}</strong><span>{c.name}</span><small>{c.state} · revision {c.revision}</small></button>)}</div>
        {corrosion.records.length>40&&<p>Showing first 40 of {corrosion.records.length} authorized circuits.</p>}
        {circuit&&<div className="investigation-detail"><h4>{circuit.code} · source context</h4><dl>
          <div><dt>Loop basis</dt><dd>{circuit.loopBasis}</dd></div>
          <div><dt>Monitoring locations</dt><dd>{circuit.locationCount}</dd></div>
          <div><dt>Recorded readings (all qualities)</dt><dd>{circuit.recordedReadings}</dd></div>
          <div><dt>Calculation references</dt><dd>{circuit.calculationReferences.length===0?"Not supplied":circuit.calculationReferences.map(x=>`${x.id} · ${x.status} · rev ${x.revision} · ${x.basisReference}`).join("; ")}</dd></div>
        </dl><p>Calculation references are not a corrosion-rate approval or an inspection due date. Review governing decisions in INS.</p></div>}
      </>}
    </div>}
    {props.activeDomain==="INS"&&<div className="investigation-body" aria-label="Related inspection records">
      <h3>Inspection requirements for {asset.tag}</h3>
      {inspection.records.length===0?<p role="status">{sourceMessage(inspection.state,"inspection")}</p>:<>
        <p>{inspection.records.length} requirement(s) explicitly linked to this asset in the authorized INS source.</p>
        <div className="investigation-list">{inspection.records.slice(0,40).map(r=><button key={r.id} type="button" aria-pressed={requirement?.id===r.id}
          onClick={()=>setSelectedInspectionId(r.id)}><strong>{r.code}</strong><span>{r.status} · revision {r.revision}</span><small>INS due: {r.governingTechnicalDueAt??"Not supplied"}</small></button>)}</div>
        {inspection.records.length>40&&<p>Showing first 40 of {inspection.records.length} authorized requirements.</p>}
        {requirement&&<div className="investigation-detail"><h4>{requirement.code} · inspection authority</h4><dl>
          <div><dt>Requirement basis</dt><dd>{requirement.basisReference}</dd></div>
          <div><dt>INS governing technical due (reported)</dt><dd>{requirement.governingTechnicalDueAt??"Not supplied"}</dd></div>
          <div><dt>Due-decision basis</dt><dd>{requirement.governingBasis??"Not supplied"}</dd></div>
          <div><dt>Recorded events</dt><dd>{requirement.eventCount}</dd></div>
          <div><dt>Events with approved/granted credit review</dt><dd>{requirement.reviewedCreditCount}</dd></div>
        </dl><h5>Reported due-date candidates (not governing)</h5>
          {requirement.dueCandidates.length===0?<p>No due candidates supplied.</p>:
            <ul>{requirement.dueCandidates.map(x=><li key={x.id}>{x.source} · {x.dueAt} · {x.basisReference}</li>)}</ul>}
          <p>INS controls the governing due decision. COR candidates, field completion and review are not automatically inspection credit.</p>
        </div>}
      </>}
    </div>}
    <EngineeringEvidenceNavigator
      key={JSON.stringify([props.navigationScopeKey,props.crossDomainScopeKey,props.assetScopeKey,
        props.corrosionScopeKey,props.inspectionScopeKey,asset.id])}
      context={outcome.context} onOpenOwningRecord={openOwningRecord}/>
    <p className="investigation-disclaimer">Navigation only · never fetches unscoped records, authorizes a command, infers an absent result, or grants engineering approval. All domain-source access must be enforced upstream.</p>
  </section>;
}
