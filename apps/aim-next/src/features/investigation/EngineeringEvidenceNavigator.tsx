import {useEffect,useId,useMemo,useRef,useState,type JSX} from "react";
import type {CrossDomainContext} from "./crossDomainInvestigationModel";
import type {EngineeringEvidence,EvidenceDomain} from "./engineeringEvidenceModel";
import {paginateEvidence} from "./evidencePagination";
import {filterIndexedEvidence,evidencePosition,EVIDENCE_QUERY_LIMIT} from "./evidenceQuickFind";
import {compareIndexedEvidence,type ComparisonStatus} from "./evidenceComparison";
import {buildEvidenceChronology,entriesForChronology,type ChronologyMode} from "./evidenceChronology";
import {inspectEvidenceConsistency,type ConsistencyKind} from "./evidenceConsistency";
import {summarizeAuthorizedInvestigation} from "./evidenceInvestigationSummary";
import {traceIndexedEvidence,type TraceGroup} from "./evidenceTrace";
import {EVIDENCE_PAGE_SIZE} from "./evidencePagination";
import {EngineeringInvestigationCase} from "./EngineeringInvestigationCase";
import {describeSourceOrigin} from "./evidenceOriginPresentation";
import {INVESTIGATION_FOCUS_OPTIONS,visibleInvestigationPanels,focusForSourceInspection,type InvestigationFocus} from "./investigationFocusModel";
import type {EvidenceHandoffKind,EvidenceHandoffRequest} from "./investigationHandoffModel";
import {investigationJourney} from "./investigationJourneyModel";
import {nextEvidenceFocusIndex,shouldReturnToEvidenceRow} from "./investigationKeyboardModel";

type Props=Readonly<{
  context:CrossDomainContext;
  onOpenOwningRecord:(evidence:EngineeringEvidence)=>void;
}>;
const sourceWarning=(name:string,state:string)=>state==="rejected"?
  `${name} source rejected; no references are disclosed.`:
  state==="disconnected"?`${name} source not connected in this authorized scope.`:null;
const authorityDescription=(item:EngineeringEvidence)=>item.authority==="DUE_CANDIDATE"?
  "This is an INS-reported candidate, not the governing technical due date.":
  item.authority==="GOVERNING_INS_DECISION"?
  "The reported governing technical due comes from the INS owning source; this UI does not approve it.":
  item.authority==="TECHNICAL_REVIEW"?
  "This is a reported technical review. Inspection credit must be read from the approved owning-source review, not inferred from a reference.":
  "This is a source reference, not a verified document, engineering approval, or dereferenceable URL.";

/** Scoped, bounded reference directory with reachable local pages; not a backend search. */
export function EngineeringEvidenceNavigator({context,onOpenOwningRecord}:Props):JSX.Element{
  // All-sections is the compatibility default. Focus modes never unmount the case.
  const [focusMode,setFocusMode]=useState<InvestigationFocus>("ALL");
  const [handoff,setHandoff]=useState<EvidenceHandoffRequest|null>(null);
  const [reviewRequest,setReviewRequest]=useState(0);
  const handoffSequence=useRef(0);
  const focusPanels=visibleInvestigationPanels(focusMode);
  const focusLabel=INVESTIGATION_FOCUS_OPTIONS.find(option=>option.id===focusMode)!.label;
  const [filter,setFilter]=useState<"ALL"|EvidenceDomain>("ALL");
  const [pageIndex,setPageIndex]=useState(0);
  const [query,setQuery]=useState("");
  const [chronologyMode,setChronologyMode]=useState<ChronologyMode>("SOURCE_INDEX");
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [comparisonA,setComparisonA]=useState<string|null>(null);
  const [comparisonB,setComparisonB]=useState<string|null>(null);
  const [consistencyKind,setConsistencyKind]=useState<"ALL"|ConsistencyKind>("ALL");
  const [consistencyPage,setConsistencyPage]=useState(0);
  const detailId=useId();
  const provenanceHeadingRef=useRef<HTMLHeadingElement>(null);
  const sourceListRef=useRef<HTMLDivElement>(null);
  const quickFindRef=useRef<HTMLInputElement>(null);
  const lastFocusedInspectorSequence=useRef(0);
  const previousFocusMode=useRef<InvestigationFocus>("ALL");
  const [focusSequence,setFocusSequence]=useState(0);
  const {corrosion,inspection}=context.evidence;
  const entries=useMemo(()=>[
    ...(context.corrosion.state==="ready"?corrosion.entries:[]),
    ...(context.inspection.state==="ready"?inspection.entries:[]),
  ],[corrosion.entries,inspection.entries,context.corrosion.state,context.inspection.state]);
  const scoped=useMemo(()=>filter==="ALL"?entries:entries.filter(x=>x.domain===filter),[entries,filter]);
  const chronology=useMemo(()=>buildEvidenceChronology(scoped),[scoped]);
  const consistency=useMemo(()=>inspectEvidenceConsistency(scoped),[scoped]);
  const summary=useMemo(()=>summarizeAuthorizedInvestigation(context),[context]);
  const consistencyFiltered=useMemo(()=>consistencyKind==="ALL"?consistency.observations:consistency.observations.filter(x=>x.kind===consistencyKind),[consistency,consistencyKind]);
  const consistencyPageCount=Math.max(1,Math.ceil(consistencyFiltered.length/10));
  const consistencySlice=consistencyFiltered.slice(consistencyPage*10,(consistencyPage+1)*10);
  const visible=useMemo(()=>entriesForChronology(chronology,chronologyMode),[chronology,chronologyMode]);
  const searched=useMemo(()=>filterIndexedEvidence(visible,query),[visible,query]);
  const page=useMemo(()=>paginateEvidence(searched,pageIndex),[searched,pageIndex]);
  // Never retain details from a now-hidden page or withdrawn domain scope.
  const selected=page.entries.find(x=>x.key===selectedKey)??null;
  const journey=useMemo(()=>investigationJourney(entries,selected?.key??null),[entries,selected?.key]);
  const position=useMemo(()=>evidencePosition(searched,selected?.key??null),[searched,selected?.key]);
  const trace=useMemo(()=>traceIndexedEvidence(scoped,selected?.key??null),[scoped,selected?.key]);
  // Focus an explicitly requested provenance inspector once, not on every later re-render.
  useEffect(()=>{
    if(focusSequence<=lastFocusedInspectorSequence.current||!selected)return;
    lastFocusedInspectorSequence.current=focusSequence;
    provenanceHeadingRef.current?.focus();
  },[focusSequence,selected]);
  const focusCurrentEvidenceRow=()=>{
    const rowIndex=page.entries.findIndex(item=>item.key===selected?.key);
    const rows=sourceListRef.current?.querySelectorAll<HTMLButtonElement>("button[data-evidence-row]");
    const target=rowIndex>=0?rows?.item(rowIndex):null;
    if(target){target.focus();return;}
    quickFindRef.current?.focus();
  };
  // Restore keyboard focus when returning from the case; do not persist or mutate selection.
  useEffect(()=>{
    if(focusMode==="EVIDENCE"&&previousFocusMode.current==="CASE")focusCurrentEvidenceRow();
    previousFocusMode.current=focusMode;
  },[focusMode]);
  const comparison=useMemo(()=>compareIndexedEvidence(scoped,comparisonA,comparisonB),[scoped,comparisonA,comparisonB]);
  const total=(context.corrosion.state==="ready"?corrosion.total:0)+(context.inspection.state==="ready"?inspection.total:0);
  const corpusIncomplete=(context.corrosion.state==="ready"&&corrosion.truncated)||(context.inspection.state==="ready"&&inspection.truncated);
  const selectDomain=(domain:"ALL"|EvidenceDomain)=>{
    setFilter(domain);setPageIndex(0);setSelectedKey(null);setChronologyMode("SOURCE_INDEX");setComparisonA(null);setComparisonB(null);setConsistencyKind("ALL");setConsistencyPage(0);setQuery("");
  };
  const selectChronologyMode=(mode:ChronologyMode)=>{
    setChronologyMode(mode);setPageIndex(0);setSelectedKey(null);
  };
  const movePage=(next:number)=>{
    setPageIndex(next);setSelectedKey(null);
  };
  // Local result navigation never resolves a guessed reference or crosses source scope.
  const inspectFilteredKey=(key:string|null)=>{
    if(!key)return;
    const index=searched.findIndex(item=>item.key===key);
    if(index<0)return;
    setPageIndex(Math.floor(index/EVIDENCE_PAGE_SIZE));setSelectedKey(key);
    setFocusSequence(sequence=>sequence+1);
  };
  // The target must still exist in the current, independently authorized index.
  // Navigate within the existing component; never reconstruct a record from its ID.
  const inspectIndexedReference=(target:EngineeringEvidence)=>{
    const idx=entries.findIndex(item=>item.key===target.key &&
      item.domain===target.domain && item.ownerRecordId===target.ownerRecordId);
    if(idx<0)return;
    setFocusMode(focusForSourceInspection);
    setFilter("ALL");setChronologyMode("SOURCE_INDEX");setQuery("");
    setPageIndex(Math.floor(idx/EVIDENCE_PAGE_SIZE));setSelectedKey(target.key);
    setFocusSequence(sequence=>sequence+1);
  };
  // Request only an indexed key; the case rechecks the current authorized evidence
  // before adding it. All notes remain unsubmitted, editable working text.
  const startHandoff=(item:EngineeringEvidence,kind:EvidenceHandoffKind)=>{
    if(!entries.some(entry=>entry.key===item.key&&entry.domain===item.domain&&entry.ownerRecordId===item.ownerRecordId))return;
    handoffSequence.current+=1;
    setHandoff({sequence:handoffSequence.current,evidenceKey:item.key,kind});
    setFocusMode("CASE");
  };
  const openDraftReview=()=>{setFocusMode("CASE");setReviewRequest(current=>current+1);};
  const traceGroup=(label:string,description:string,group:TraceGroup)=><div className="engineering-evidence-trace-group" key={label}>
    <h5>{label} · {group.indexedCount}</h5>
    <p>{description}</p>
    {group.entries.length>0?<div className="engineering-evidence-trace-actions">
      {group.entries.map(item=><button type="button" key={item.key} onClick={()=>inspectIndexedReference(item)}>
        Inspect {item.kind} · {item.sourceRecordId} · {item.reference}
      </button>)}
    </div>:<p>No additional references in this category within the bounded current index.</p>}
    {group.limited&&<p role="status">Only the first {group.entries.length} of {group.indexedCount} indexed references are shown in this category.</p>}
  </div>;
  const compareStatus=(status:ComparisonStatus)=>status==="BOTH_NOT_SUPPLIED"?"Both not supplied":
    status==="ONE_NOT_SUPPLIED"?"One not supplied":
    status==="SAME_REPORTED_TEXT"?"Same reported text":"Different reported text";
  return <details className="engineering-evidence" aria-label="Shared engineering evidence navigator">
    <summary><strong>Engineering evidence navigator</strong><span>{total} reported reference(s) in the supplied selected-asset scope</span></summary>
    <div className="engineering-evidence-content">
      <p className="engineering-evidence-lede">References retain their owning domain and original source-record identity. These are not verified document downloads, inferred cross-domain joins, or approved engineering decisions.</p>
      {sourceWarning("COR",context.corrosion.state)&&<p role="status">{sourceWarning("COR",context.corrosion.state)}</p>}
      {sourceWarning("INS",context.inspection.state)&&<p role="status">{sourceWarning("INS",context.inspection.state)}</p>}
      <div className="engineering-workspace-control-deck" aria-label="Investigation navigation and selected working context">
      <div className="engineering-workspace-intro">
        <div><span className="engineering-workspace-kicker">INVESTIGATION WORKSPACE</span>
          <h3>Explore, review, prepare</h3>
          <p>Focus on one task at a time. Moving between views does not save, authorize, or approve an engineering case.</p>
        </div>
        <div className="engineering-workspace-source-stats" aria-label="Authorized index availability">
          <span>Indexed <strong>{summary.indexed}</strong></span>
          <span>COR <strong>{context.corrosion.state}</strong></span>
          <span>INS <strong>{context.inspection.state}</strong></span>
        </div>
      </div>
      <div className="engineering-workspace-focus" role="group" aria-label="Investigation workspace focus">
        {INVESTIGATION_FOCUS_OPTIONS.map(({id,label,helper},i)=><button type="button"
          key={id} aria-pressed={focusMode===id} onClick={()=>setFocusMode(id)}>
          <span className="engineering-workspace-focus-step">{id==="ALL"?"↗":`0${i+1}`}</span>
          <span className="engineering-workspace-focus-copy"><strong>{label}</strong>
          <small>{helper}</small></span>
        </button>)}
      </div>
      <p className="engineering-workspace-focus-status" role="status" aria-live="polite">Viewing: {focusLabel} · source scope remains unchanged.</p>
      <nav className="engineering-journey-bridge" aria-label="Source to case working path">
        <div className="engineering-journey-context">
          <span className="engineering-journey-eyebrow">CURRENT WORKING CONTEXT · AUTHORIZED INDEX ONLY</span>
          {journey.pointer?<>
            <span className="engineering-origin-tag" data-origin={journey.pointer.domain}>{journey.pointer.domain} · source-reported</span>
            <strong>{journey.pointer.reference}</strong>
            <small>{journey.pointer.kind} · owning record {journey.pointer.ownerRecordId}</small>
          </>:<><strong>No source currently selected</strong><small>Choose a reference in the Evidence Explorer to attach its pointer to a draft.</small></>}
        </div>
        <div className="engineering-journey-actions" role="group" aria-label="Continue the investigation">
          <button type="button" onClick={()=>setFocusMode("EVIDENCE")}>1 · Explore evidence</button>
          <button type="button" disabled={!selected} onClick={()=>{if(selected)startHandoff(selected,"QUESTION");}}>2 · Draft a question</button>
          <button type="button" onClick={openDraftReview}>3 · Review working material</button>
        </div>
        <p className="engineering-journey-boundary">Working navigation only · source authority and engineering review remain with the owning systems.</p>
      </nav>
      </div>
      <section className="engineering-workspace-panel" aria-label="Case and review working area" hidden={!focusPanels.caseWork}>
        <header className="engineering-workspace-panel-title"><span>03 / WORKING CASE</span><h4>Organize review material</h4><p>Temporary notes and selected evidence remain mounted when you change views.</p></header>
      <EngineeringInvestigationCase assetId={context.asset.id} entries={entries} selected={selected}
        focusRequested={focusMode==="CASE"} handoffRequest={handoff} reviewRequest={reviewRequest} onReturnToEvidence={()=>setFocusMode("EVIDENCE")} sourceCoverage={[
          {domain:"COR",state:context.corrosion.state,indexed:context.corrosion.state==="ready"?corrosion.entries.length:0,totalReported:context.corrosion.state==="ready"?corrosion.total:0,truncated:context.corrosion.state==="ready"&&corrosion.truncated},
          {domain:"INS",state:context.inspection.state,indexed:context.inspection.state==="ready"?inspection.entries.length:0,totalReported:context.inspection.state==="ready"?inspection.total:0,truncated:context.inspection.state==="ready"&&inspection.truncated},
        ]}
        onInspect={inspectIndexedReference} onOpenOwningRecord={onOpenOwningRecord}/>
      </section>
      <section className="engineering-workspace-panel" aria-label="Source observations working area" hidden={!focusPanels.observations}>
        <header className="engineering-workspace-panel-title"><span>02 / SOURCE OBSERVATIONS</span><h4>Understand the evidence</h4><p>Reported field patterns, chronology coverage, and bounded-source limitations—not technical findings.</p></header>
      <details className="engineering-investigation-summary" aria-label="Selected asset investigation summary">
        <summary><strong>Investigation summary</strong><span>{summary.indexed} indexed reference(s) · {summary.observationsTotal} exact-text observation(s)</span></summary>
        <p>Read-only overview for the selected authorized asset <code>{summary.assetId}</code>. Counts describe the bounded, supplied COR/INS source indexes—not all records, verified documents, an engineering assessment, or a completed review.</p>
        <dl className="engineering-investigation-summary-metrics">
          <div><dt>Indexed references</dt><dd>{summary.indexed} of {summary.totalReported} reported</dd></div>
          <div><dt>Independently connected sources</dt><dd>{summary.independentlyAvailableSources} of 2</dd></div>
          <div><dt>Orderable source timestamps</dt><dd>{summary.reportedSourceTimes}</dd></div>
          <div><dt>Orderable due targets (not decisions)</dt><dd>{summary.dueTargets}</dd></div>
          <div><dt>Unplaced timestamps</dt><dd>{summary.timestampNotSupplied+summary.timestampNotOrderable}</dd></div>
          <div><dt>Reported-text observations</dt><dd>{summary.observationsTotal}</dd></div>
        </dl>
        <h4>Independent source coverage</h4>
        <ul className="engineering-investigation-summary-sources">
          {summary.sources.map(source=><li key={source.domain}>
            <strong>{source.domain}</strong> · {source.state} · {source.indexed} of {source.totalReported} reported references indexed
            {source.truncated&&<span> · index limit reached</span>}
          </li>)}
        </ul>
        <p><strong>Reported field availability:</strong> source timestamp not supplied {summary.timestampNotSupplied}; timestamp unorderable {summary.timestampNotOrderable}; revision not supplied {summary.revisionNotSupplied}; supporting reference not supplied {summary.supportingReferenceNotSupplied}. These fields are not necessarily required for every source record.</p>
        <p><strong>Exact-text patterns:</strong> revision variations {summary.observationCounts.REVISION_VARIATION}; state variations {summary.observationCounts.STATE_VARIATION}; reference reuse across owners {summary.observationCounts.REFERENCE_REUSE}. No pattern here establishes a technical conflict.</p>
        {summary.reviewPaths.length>0&&<section aria-label="Source records associated with reported-text observations">
          <h4>Source records to inspect</h4>
          <p>Examples from the bounded consistency index, not priority-ranked work items. Use the owning service to establish context.</p>
          <div className="engineering-investigation-summary-actions">
            {summary.reviewPaths.map(path=><div key={path.key} className="engineering-evidence-trace-action-pair">
              <button type="button" onClick={()=>onOpenOwningRecord(path.example)}>
                View {path.example.domain} · {path.example.ownerRecordId} · {path.kind.replaceAll('_',' ').toLowerCase()}
              </button>
              <button type="button" onClick={()=>inspectIndexedReference(path.example)}>
                Trace {path.example.domain} · {path.example.ownerRecordId} in indexed evidence
              </button>
            </div>)}
          </div>
        </section>}
        {summary.observationsTotal===0&&<p>No matching exact-text patterns in the indexed sources. This does not establish consistency or completeness.</p>}
        {(summary.limited||summary.observationsLimited)&&<p role="status">This summary is incomplete because the reference index or observation list is bounded. Consult each authorized owning source for complete information.</p>}
        {summary.independentlyAvailableSources<2&&<p role="status">One or more independent sources are unavailable or rejected. The summary cannot establish absent records from those sources.</p>}
        <p>Comparing two references requires explicit selection in the evidence list below. A comparison never creates an approval, source join, or governing INS due date.</p>
        <p>Comparison slots: {(comparisonA?1:0)+(comparisonB?1:0)} of 2 selected.</p>
      </details>
      <details className="engineering-evidence-consistency" aria-label="Reported evidence consistency observations">
        <summary>Reported reference consistency <span>{consistency.counts.REVISION_VARIATION+consistency.counts.STATE_VARIATION+consistency.counts.REFERENCE_REUSE} observation(s)</span></summary>
        <p>Exact reported-text patterns in the current authorized, bounded index only. These observations are not conflicts proven by engineering review, not document identity, and not supersession, inspection credit or approval.</p>
        <dl>
          <div><dt>Indexed references examined</dt><dd>{consistency.examinedReferences}</dd></div>
          <div><dt>Revision text variations</dt><dd>{consistency.counts.REVISION_VARIATION}</dd></div>
          <div><dt>State text variations</dt><dd>{consistency.counts.STATE_VARIATION}</dd></div>
          <div><dt>Reference text reused across owners</dt><dd>{consistency.counts.REFERENCE_REUSE}</dd></div>
        </dl>
        <div className="engineering-evidence-consistency-filters" role="group" aria-label="Filter reported consistency observations">
          {([['ALL','All observations'],['REVISION_VARIATION','Revision variations'],['STATE_VARIATION','State variations'],['REFERENCE_REUSE','Reference text reused']] as const).map(([kind,label])=><button key={kind} type="button" aria-pressed={consistencyKind===kind}
            onClick={()=>{setConsistencyKind(kind);setConsistencyPage(0);}}>{label}</button>)}
        </div>
        {consistency.observations.length===0?<p role="status">No exact-text patterns identified in the available indexed references. This does not establish consistency or completeness.</p>:consistencyFiltered.length===0?<p role="status">No indexed observations in this category.</p>:<>
          <p role="status" aria-live="polite">Showing observations {consistencyPage*10+1}–{Math.min((consistencyPage+1)*10,consistencyFiltered.length)} of {consistencyFiltered.length}</p>
          <ol className="engineering-evidence-consistency-list" aria-label="Reported consistency observations">
            {consistencySlice.map(note=><li key={note.key}>
              <strong>{note.kind==='REVISION_VARIATION'?'Revision text variation':note.kind==='STATE_VARIATION'?'State text variation':'Reference text reused across owners'}</strong>
              <p className="engineering-evidence-consistency-reference">Reported reference: {note.reference}</p>
              {note.ownerDomain&&<p>Owning record: {note.ownerDomain} · {note.ownerRecordId}</p>}
              <p>{note.summary}</p>
              <p>{note.indexedCount} indexed reference(s) in this pattern; displaying up to three sources.</p>
              <div className="engineering-evidence-consistency-sources">
                {note.examples.map(e=><div key={e.key} className="engineering-evidence-trace-action-pair">
                  <button type="button" onClick={()=>onOpenOwningRecord(e)}>
                    View {e.domain} · {e.ownerRecordId} · {e.sourceRecordId} in owning workspace
                  </button>
                  <button type="button" onClick={()=>inspectIndexedReference(e)}>
                    Trace {e.domain} · {e.ownerRecordId} · {e.sourceRecordId} in indexed evidence
                  </button>
                </div>)}
              </div>
            </li>)}
          </ol>
          {consistencyPageCount>1&&<nav className="engineering-evidence-pagination" aria-label="Consistency observation pages">
            <button type="button" disabled={consistencyPage===0} onClick={()=>setConsistencyPage(x=>Math.max(0,x-1))}>Previous observations</button>
            <span>Page {consistencyPage+1} of {consistencyPageCount}</span>
            <button type="button" disabled={consistencyPage+1>=consistencyPageCount} onClick={()=>setConsistencyPage(x=>Math.min(consistencyPageCount-1,x+1))}>Next observations</button>
          </nav>}
        </>}
        {(consistency.limited||corpusIncomplete)&&<p role="status">Observations may be incomplete: this view limits the number of displayed patterns and each authorized source index is bounded. Review the owning services for further evidence.</p>}
      </details>
      </section>
      <section className="engineering-workspace-panel" aria-label="Evidence explorer working area" hidden={!focusPanels.evidence}>
        <header className="engineering-workspace-panel-title"><span>01 / EVIDENCE EXPLORER</span><h4>Trace the reported source</h4><p>Filter, inspect provenance, follow within-owner references, and compare reported text.</p></header>
      <div className="engineering-evidence-filter" role="group" aria-label="Filter engineering references by owning domain">
        {(["ALL","COR","INS"] as const).map(domain=><button key={domain} type="button"
          aria-pressed={filter===domain} onClick={()=>selectDomain(domain)}>
          {domain==="ALL"?"All supplied":domain} <span>{domain==="ALL"?total:domain==="COR"?(context.corrosion.state==="ready"?corrosion.total:0):(context.inspection.state==="ready"?inspection.total:0)}</span>
        </button>)}
      </div>
      {corpusIncomplete&&<p role="status">The bounded source index omits additional references. Displayed entries are not exhaustive; review the owning service for the full source.</p>}
      <details className="engineering-evidence-chronology" aria-label="Evidence chronology and field coverage">
        <summary>Reported-time chronology &amp; field coverage</summary>
        <p>Chronology uses only timezone-qualified source timestamps in the current bounded index. Reported due-date targets are shown separately from source times. This is not an event history, technical sequence, missing-required-field audit, or engineering review.</p>
        <dl>
          <div><dt>Indexed references</dt><dd>{chronology.coverage.indexed}</dd></div>
          <div><dt>Reported source times</dt><dd>{chronology.sourceTimes.length}</dd></div>
          <div><dt>Reported due-date targets</dt><dd>{chronology.dueTargets.length}</dd></div>
          <div><dt>Timestamp not supplied</dt><dd>{chronology.coverage.timestampNotSupplied}</dd></div>
          <div><dt>Timestamp not orderable</dt><dd>{chronology.coverage.timestampUnorderable}</dd></div>
          <div><dt>Revision not supplied</dt><dd>{chronology.coverage.revisionNotSupplied}</dd></div>
          <div><dt>Supporting reference not supplied</dt><dd>{chronology.coverage.supportingReferenceNotSupplied}</dd></div>
        </dl>
        <p>These are field-availability observations only. A revision or supporting reference may not apply to every record. No gap here proves a technical deficiency.</p>
      </details>
      {scoped.length>0&&<div className="engineering-evidence-time-controls" role="group" aria-label="Evidence chronology view">
        {([
          ["SOURCE_INDEX","Source index",chronology.sourceOrder.length],
          ["SOURCE_TIMES","Reported source times · newest first",chronology.sourceTimes.length],
          ["DUE_TARGETS","Due targets · earliest first",chronology.dueTargets.length],
          ["UNPLACED","Unplaced timestamps",chronology.unplaced.length],
        ] as const).map(([mode,label,count])=><button key={mode} type="button" aria-pressed={chronologyMode===mode}
          onClick={()=>selectChronologyMode(mode)}>{label} <span>{count}</span></button>)}
      </div>}
      {scoped.length>0&&<div className="engineering-evidence-quick-find" role="search" aria-label="Find within indexed engineering evidence">
        <label htmlFor={`${detailId}-quick-find`}>Find within indexed references <small>Local, authorized subset only</small></label>
        <div className="engineering-evidence-quick-find-controls">
          <input ref={quickFindRef} id={`${detailId}-quick-find`} type="search" maxLength={EVIDENCE_QUERY_LIMIT}
            value={query} onChange={event=>{setQuery(event.target.value);setPageIndex(0);setSelectedKey(null);}}
            placeholder="Reference, owner ID, source ID, kind or state"/>
          {query&&<button type="button" onClick={()=>{setQuery("");setPageIndex(0);setSelectedKey(null);}}>Clear search</button>}
        </div>
        <p role="status" aria-live="polite" aria-atomic="true">
          {query.trim()?`${searched.length} matching indexed reference(s) of ${visible.length} in this view.`:
            `Browsing ${visible.length} indexed reference(s) in this view.`}
          {corpusIncomplete?' Some owning-source entries are beyond the bounded index.':''}
        </p>
      </div>}
      {scoped.length===0?<p role="status">No references available from the selected, authorized source scope. This does not establish that no evidence exists.</p>:visible.length===0?<p role="status">No indexed references in this chronology category. This does not establish source completeness or technical compliance.</p>:searched.length===0?<p role="status">No matches within this indexed view. Clear or revise the local search; this does not establish that the owning source has no matching records.</p>:<>
        <p className="engineering-evidence-page-count" role="status" aria-live="polite" aria-atomic="true">
          Showing indexed references {page.first}–{page.last} of {page.indexedCount} · page {page.pageIndex+1} of {page.pageCount}
        </p>
        <p id={`${detailId}-keyboard-guide`} className="engineering-evidence-keyboard-hint">Keyboard: focus a reference, use ↑/↓ or Home/End to move within this page, and Enter/Space to inspect. Use Escape in source detail to return to its reference.</p>
        <div className="engineering-visual-browser" aria-label="Indexed evidence and source detail">
          <div className="engineering-visual-results">
          <div ref={sourceListRef} className="engineering-evidence-list" role="group" aria-label="Reported source references" aria-describedby={`${detailId}-keyboard-guide`}>
          {page.entries.map((item,index)=><button key={item.key} type="button" data-evidence-row=""
            aria-label={`${item.domain} · ${item.kind} ${item.reference} · source ${item.sourceRecordId} · ${item.status}`}
            onKeyDown={event=>{
              const nextIndex=nextEvidenceFocusIndex(event.key,index,page.entries.length);
              if(nextIndex===null)return;
              event.preventDefault();
              sourceListRef.current?.querySelectorAll<HTMLButtonElement>("button[data-evidence-row]").item(nextIndex)?.focus();
            }}
            aria-pressed={selected?.key===item.key}
            aria-controls={selected?.key===item.key?detailId:undefined}
            onClick={()=>setSelectedKey(item.key)}>
            <span className="engineering-evidence-tag" data-origin={item.domain}>{describeSourceOrigin(item).label} · {item.kind}</span>
            <strong>{item.reference}</strong>
            <small>{item.sourceRecordId} · {item.status}</small>
            {chronologyMode!=="SOURCE_INDEX"&&<small>{item.reportedAt??"Timestamp not supplied"}</small>}
          </button>)}
        </div>
        {page.pageCount>1&&<nav className="engineering-evidence-pagination" aria-label="Evidence results pages">
          <button type="button" disabled={!page.hasPrevious} onClick={()=>movePage(page.pageIndex-1)}>Previous references</button>
          <span aria-label={`Page ${page.pageIndex+1} of ${page.pageCount}`}>{page.pageIndex+1} / {page.pageCount}</span>
          <button type="button" disabled={!page.hasNext} onClick={()=>movePage(page.pageIndex+1)}>Next references</button>
        </nav>}
        {corpusIncomplete&&<p className="engineering-evidence-limit-note">Only the first 200 references per authorized source were indexed. These pages do not provide an exhaustive source search.</p>}
          </div>
        {selected&&<section id={detailId} className="engineering-evidence-detail" aria-label="Selected evidence provenance" data-origin={selected.domain}
          onKeyDown={event=>{
            if(!shouldReturnToEvidenceRow(event.key)||event.defaultPrevented)return;
            event.preventDefault();event.stopPropagation();focusCurrentEvidenceRow();
          }}>
          <div className="engineering-evidence-source-origin"><span className="engineering-origin-tag" data-origin={selected.domain}>{describeSourceOrigin(selected).label}</span>
            <span>{describeSourceOrigin(selected).authorityLabel}</span></div>
          <div className="engineering-evidence-inspector-header">
            <div><small>SOURCE DETAIL · CURRENT INDEX</small>
              <h4 ref={provenanceHeadingRef} tabIndex={-1}>Source provenance · {selected.kind}</h4>
              <p>{selected.domain} / {selected.ownerRecordId} · {selected.sourceRecordId}</p>
              <button type="button" className="engineering-evidence-return-focus" onClick={focusCurrentEvidenceRow}>Return focus to selected reference</button>
            </div>
            {position&&<nav className="engineering-evidence-inspector-nav" aria-label="Move between filtered evidence references">
              <span>Reference {position.index+1} of {position.count}</span>
              <button type="button" disabled={!position.previousKey} onClick={()=>inspectFilteredKey(position.previousKey)}>Previous source</button>
              <button type="button" disabled={!position.nextKey} onClick={()=>inspectFilteredKey(position.nextKey)}>Next source</button>
            </nav>}
          </div>
          <section className="engineering-evidence-priority" aria-label="Primary reported source facts">
            <div className="engineering-evidence-priority-eyebrow">REPORTED SOURCE · AT A GLANCE</div>
            <strong className="engineering-evidence-priority-reference">{selected.reference}</strong>
            <dl>
              <div><dt>Owning record</dt><dd>{selected.domain} · {selected.ownerRecordId}</dd></div>
              <div><dt>Source record ID</dt><dd>{selected.sourceRecordId}</dd></div>
              <div><dt>Reported state</dt><dd>{selected.status}</dd></div>
              <div><dt>Authority classification</dt><dd>{selected.authority.replaceAll("_"," ").toLowerCase()}</dd></div>
            </dl>
          </section>
          <p className="engineering-evidence-priority-caution">{authorityDescription(selected)}</p>
          <details className="engineering-evidence-secondary" aria-label="Additional reported provenance fields">
            <summary>Additional provenance <span>revision · supporting reference · timestamps</span></summary>
            <dl>
              <div><dt>Owning domain</dt><dd>{selected.domain}</dd></div>
              <div><dt>Reported reference</dt><dd>{selected.reference}</dd></div>
              <div><dt>Supporting reference</dt><dd>{selected.supportingReference??"Not supplied"}</dd></div>
              <div><dt>Source revision</dt><dd>{selected.revision??"Not supplied"}</dd></div>
              <div><dt>Source timestamp</dt><dd>{selected.reportedAt??"Not supplied"}</dd></div>
              <div><dt>Time meaning</dt><dd>{selected.authority==="DUE_CANDIDATE"?"Reported due-date target (not an event)":"Source-reported timestamp (field meaning varies by record)"}</dd></div>
            </dl>
            <p>Not supplied means absent from this indexed source pointer; it does not establish that a required engineering document is missing.</p>
          </details>

          <p className="engineering-evidence-origin-boundary">{describeSourceOrigin(selected).explanatoryText} Any notes drafted from this pointer remain separate engineer-authored working material.</p>
          <details key={selected.key} open={focusMode==="ALL"} className="engineering-evidence-advanced" aria-label="Advanced evidence analysis tools">
            <summary>Trace and compare references <small>Exact-text clues · no inferred relationships</small></summary>
          {trace&&<section className="engineering-evidence-trace" aria-label="Selected evidence trace navigation">
            <h4>Explore reported source context</h4>
            <p>All options below stay inside the current selected asset, owning domain and owning record. Identical text or IDs are navigation clues, not verified relationships. Records outside the bounded index are not searchable here.</p>
            {traceGroup("Same source-record ID","Other indexed references reported under this same source-record identity.",trace.sameSourceRecord)}
            {traceGroup("Exact supporting-reference text","Same-owner indexed references whose reference text exactly matches the reported supporting reference. This does not verify a document link.",trace.reportedSupportTextMatches)}
            {traceGroup("Reverse supporting-reference text","Same-owner indexed references whose reported supporting-reference text exactly matches this reference. This does not establish causality.",trace.incomingReportedTextMatches)}
            <details className="engineering-evidence-trace-peers">
              <summary>Other references in this owning record · {trace.owningRecordContext.indexedCount}</summary>
              {traceGroup("Owning record index","Indexed entries from the same reported domain and owner; not necessarily related to this source reference.",trace.owningRecordContext)}
            </details>
          </section>}
          <div className="engineering-evidence-handoff" role="group" aria-label="Start a temporary case from selected evidence">
            <div><strong>Continue with this source</strong><p>Only a reference pointer is staged. Any note you write remains a draft, not a reviewed finding.</p></div>
            <div className="engineering-evidence-handoff-actions">
              <button type="button" onClick={()=>startHandoff(selected,"REFERENCE")}>Add to temporary case</button>
              <button type="button" onClick={()=>startHandoff(selected,"QUESTION")}>Draft a question</button>
              <button type="button" onClick={()=>startHandoff(selected,"NEXT_STEP")}>Propose a next step</button>
            </div>
          </div>
          <div className="engineering-evidence-compare-actions" role="group" aria-label="Choose evidence references to compare">
            <button type="button" aria-pressed={comparisonA===selected.key} onClick={()=>{
              setComparisonA(selected.key);if(comparisonB===selected.key)setComparisonB(null);
            }}>Use as comparison A</button>
            <button type="button" aria-pressed={comparisonB===selected.key} onClick={()=>{
              setComparisonB(selected.key);if(comparisonA===selected.key)setComparisonA(null);
            }}>Use as comparison B</button>
          </div>
          </details>
          <button className="engineering-evidence-open" type="button" onClick={()=>onOpenOwningRecord(selected)}>
            View owning {selected.domain} record context
          </button>
        </section>}
        </div>
        {(comparisonA||comparisonB)&&<section className="engineering-evidence-comparison" aria-label="Evidence reference comparison">
          <div className="engineering-evidence-comparison-heading">
            <div><h4>Reported evidence comparison</h4>
              <p>Side-by-side source text only. Matching text does not establish the same record, technical equivalence, approved status, causal relationship, or a governing due date.</p></div>
            <button type="button" onClick={()=>{setComparisonA(null);setComparisonB(null);}}>Clear comparison</button>
          </div>
          {comparison?<>
            <p role="status">{comparison.sameOwner?"Same reported owning record":"Different owning records"} · {comparison.sameKind?"Same source kind":"Different source kinds"}. No source relationship is inferred.</p>
            <div className="engineering-evidence-comparison-table-wrap">
              <table className="engineering-evidence-comparison-table">
                <caption>Reported source fields · A and B · no engineering judgment</caption>
                <thead><tr><th scope="col">Reported field</th><th scope="col">A · {comparison.a.domain}</th><th scope="col">B · {comparison.b.domain}</th><th scope="col">Text comparison</th></tr></thead>
                <tbody>{comparison.rows.map(row=><tr key={row.label}>
                  <th scope="row">{row.label}</th><td>{row.a}</td><td>{row.b}</td><td>{compareStatus(row.status)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </>:<p role="status">Choose two different indexed references using their provenance details. You can move between result pages without losing the comparison slots.</p>}
        </section>}
      </>}
      </section>
    </div>
  </details>;
}
