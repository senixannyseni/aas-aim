import {useEffect,useMemo,useRef,useState,type FormEvent,type JSX} from 'react';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import {prepareInvestigationReview,type ReviewSourceCoverage,type ReviewNote} from './evidenceReviewPreparation';
import {describeWorkingMaterial} from './evidenceReviewCoverage';
import {summarizeCaseDesk} from './investigationCaseDesk';
import {describeSourceOrigin,describeWorkingNoteOrigin} from './evidenceOriginPresentation';
import {
  CASE_NOTE_LENGTH,CASE_NOTE_LIMIT,CASE_REFERENCE_LIMIT,
  addCaseNote,addCaseReference,emptyInvestigationCase,projectInvestigationCase,
  removeCaseNote,removeCaseReference,updateCaseNote,type CaseNoteKind,
} from './evidenceCase';
import {stageEvidenceHandoff,type EvidenceHandoffRequest} from './investigationHandoffModel';

type Props=Readonly<{
  assetId:string;
  entries:readonly EngineeringEvidence[];
  selected:EngineeringEvidence|null;
  onInspect:(evidence:EngineeringEvidence)=>void;
  onOpenOwningRecord:(evidence:EngineeringEvidence)=>void;
  sourceCoverage?:readonly ReviewSourceCoverage[];
  /** Open the existing native disclosure when the user selects the case focus. */
  focusRequested?:boolean;
  handoffRequest?:EvidenceHandoffRequest|null;
  reviewRequest?:number;
  onReturnToEvidence?:()=>void;
}>;
const labels:Readonly<Record<CaseNoteKind,string>>={
  OBSERVATION:'Working observation',QUESTION:'Open question',NEXT_STEP:'Proposed next step',
};
/** Ephemeral browser-memory-only scratchpad; no server writes, persistence or exports. */
export function EngineeringInvestigationCase({assetId,entries,selected,onInspect,onOpenOwningRecord,sourceCoverage,focusRequested=false,handoffRequest=null,reviewRequest=0,onReturnToEvidence}:Props):JSX.Element{
  const caseDisclosure=useRef<HTMLDetailsElement>(null);
  const reviewDisclosure=useRef<HTMLDetailsElement>(null);
  const noteFieldRef=useRef<HTMLTextAreaElement>(null);
  const lastHandoffSequence=useRef(0);
  const lastReviewRequest=useRef(0);
  useEffect(()=>{
    if(!Number.isSafeInteger(reviewRequest)||reviewRequest<=lastReviewRequest.current)return;
    lastReviewRequest.current=reviewRequest;
    if(caseDisclosure.current)caseDisclosure.current.open=true;
    if(reviewDisclosure.current){
      reviewDisclosure.current.open=true;
      reviewDisclosure.current.querySelector('summary')?.focus();
    }
  },[reviewRequest]);
  const [handoffStatus,setHandoffStatus]=useState<string|null>(null);
  useEffect(()=>{if(focusRequested&&caseDisclosure.current)caseDisclosure.current.open=true;},[focusRequested]);
  const [draft,setDraft]=useState(()=>emptyInvestigationCase(assetId));
  const [noteType,setNoteType]=useState<CaseNoteKind>('QUESTION');
  const [noteText,setNoteText]=useState('');
  const [attachedKey,setAttachedKey]=useState('');
  const [editingNoteId,setEditingNoteId]=useState<number|null>(null);
  const [composerStatus,setComposerStatus]=useState<string|null>(null);
  useEffect(()=>{
    if(!handoffRequest||handoffRequest.sequence<=lastHandoffSequence.current)return;
    lastHandoffSequence.current=handoffRequest.sequence;
    // Handoff starts a new working note; an unsaved edit is not silently overwritten.
    if(editingNoteId!==null){setHandoffStatus('Finish or cancel editing the existing note before starting a different draft.');return;}
    const next=stageEvidenceHandoff(draft,assetId,entries,handoffRequest);
    if(next.status==='UNAVAILABLE'){
      setHandoffStatus('This source is unavailable in the current authorized index. No reference was added.');
      return;
    }
    if(next.status==='LIMIT_REACHED'){
      setHandoffStatus('The temporary case reference limit has been reached. No reference was added.');
      return;
    }
    setDraft(next.state);
    setAttachedKey(next.attachedKey??'');
    // Open the disclosure before targeting the editor: hidden descendants cannot receive focus.
    if(caseDisclosure.current)caseDisclosure.current.open=true;
    if(next.draftNoteKind){setNoteType(next.draftNoteKind);noteFieldRef.current?.focus();}
    setHandoffStatus(next.draftNoteKind?
      'Source pointer staged. Write your draft note below; it has not been submitted or approved.':
      'Source pointer added to the temporary working case.');
  },[handoffRequest,assetId,entries,draft,editingNoteId]);
  const working=useMemo(()=>projectInvestigationCase(draft,assetId,entries),[draft,assetId,entries]);
  const review=useMemo(()=>prepareInvestigationReview(working,sourceCoverage),[working,sourceCoverage]);
  const material=useMemo(()=>describeWorkingMaterial(review),[review]);
  const desk=useMemo(()=>summarizeCaseDesk(review),[review]);
  const activeSelected=selected&&entries.some(entry=>entry.key===selected.key)?selected:null;
  const canBookmark=activeSelected!==null&&!working.references.some(x=>x.key===activeSelected.key)
    &&working.references.length<CASE_REFERENCE_LIMIT&&working.withdrawnCount===0;
  const cancelEditing=()=>{setEditingNoteId(null);setNoteText('');setComposerStatus('Edit canceled; original working note retained.');};
  const beginEditing=(id:number)=>{
    // Select only an entry in the current authorized projection; never reveal hidden notes.
    const found=working.notes.find(({note})=>note.id===id);
    if(!found||working.withdrawnCount>0)return;
    setEditingNoteId(id);setNoteType(found.note.kind);
    setAttachedKey(found.note.evidenceKey??'');setNoteText(found.note.text);
    setComposerStatus('Editing an existing temporary note. No changes are applied until saved.');
    noteFieldRef.current?.focus();
  };
  const addNote=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const evidenceKey=attachedKey||null;
    if(editingNoteId!==null){
      if(!working.notes.some(({note})=>note.id===editingNoteId)){
        setEditingNoteId(null);setNoteText('');
        setComposerStatus('This draft is unavailable in the current authorized case; no changes saved.');return;
      }
      const next=updateCaseNote(draft,assetId,editingNoteId,noteType,noteText,evidenceKey,entries);
      if(next!==draft){setDraft(next);setEditingNoteId(null);setNoteText('');setComposerStatus('Working note updated in memory; review remains read-only and unsubmitted.');}
      return;
    }
    const next=addCaseNote(draft,assetId,noteType,noteText,evidenceKey,entries);
    if(next!==draft){setDraft(next);setNoteText('');setComposerStatus('Working note added to the temporary case; not reviewed or submitted.');}
  };
  const reviewNotes=(title:string,items:readonly ReviewNote[])=><section aria-label={title}>
    <h5>{title} · {items.length}</h5>
    {items.length===0?<p>None entered in this temporary case.</p>:<ol>
      {items.map(item=><li key={item.id}>
        <p><span className="engineering-origin-tag" data-origin="DRAFT">Engineer-written draft</span></p>
        <p>{item.text}</p>
        <p className="engineering-origin-attachment">{describeWorkingNoteOrigin(item.evidence).attachmentLabel}</p>
        {item.evidence?<button type="button" onClick={()=>onInspect(item.evidence!)}>
          Inspect reported {item.evidence.domain} source · {item.evidence.sourceRecordId}
        </button>:<small>Unlinked working note — no indexed reference attached</small>}
      </li>)}
    </ol>}
  </section>;
  return <details ref={caseDisclosure} className="engineering-investigation-case" aria-label="Temporary engineering investigation case">
    <summary><strong>Temporary investigation case</strong><span>{working.references.length} reference(s) · {working.notes.length} working note(s)</span></summary>
    <div className="engineering-investigation-case-body">
      <p className="engineering-investigation-case-caution">Session-only working notes for selected asset <code>{assetId}</code>. This is not a saved engineering case, finding, document review, action assignment, approval, or authoritative source. Notes are lost on reload, navigation-scope rotation, or clearing this case. Do not enter confidential personal information.</p>
      <header className="engineering-case-desk-intro">
        <div><span className="engineering-case-desk-eyebrow">WORKING CASE / UNSUBMITTED</span>
          <h3>Investigate, document, prepare</h3>
          <p>Keep reported source pointers beside your own working notes. This desk is a temporary aid, not an assessment or an approval.</p>
        </div>
        <span className="engineering-case-desk-asset">Asset <code>{assetId}</code></span>
      </header>
      <div className="engineering-origin-guide" aria-label="Difference between source evidence and working notes">
        <div><span className="engineering-origin-tag" data-origin="COR">COR · source-reported</span><small>From the authorized corrosion index; not independently verified</small></div>
        <div><span className="engineering-origin-tag" data-origin="INS">INS · source-reported</span><small>From the authorized inspection index; not an approval by this UI</small></div>
        <div><span className="engineering-origin-tag" data-origin="DRAFT">Engineer-written draft</span><small>User-entered working material, never a technical finding</small></div>
      </div>
      <div className="engineering-case-desk-metrics" aria-label="Temporary case material overview">
        <div><span>Source pointers</span><strong>{desk.referenceCount}<small> / {CASE_REFERENCE_LIMIT}</small></strong></div>
        <div><span>Questions entered</span><strong>{desk.questionCount}</strong></div>
        <div><span>Observations entered</span><strong>{desk.observationCount}</strong></div>
        <div><span>Proposed next steps</span><strong>{desk.nextStepCount}</strong></div>
      </div>
      {handoffStatus&&<p className="engineering-case-handoff-status" role="status" aria-live="polite">{handoffStatus}</p>}
      <div className="engineering-investigation-case-toolbar">
        <button type="button" disabled={!canBookmark} onClick={()=>{
          if(activeSelected)setDraft(prev=>addCaseReference(prev,assetId,activeSelected.key,entries));
        }}>{activeSelected?'Add selected indexed reference to case':'Select an indexed evidence reference first'}</button>
        <button type="button" disabled={draft.referenceKeys.length===0&&draft.notes.length===0} onClick={()=>{
          setDraft(emptyInvestigationCase(assetId));setAttachedKey('');setNoteText('');setEditingNoteId(null);setComposerStatus(null);setHandoffStatus(null);
        }}>Clear temporary case</button>
      </div>
      {working.withdrawnCount>0&&<p role="status">{working.withdrawnCount} saved reference(s) are unavailable in the current authorized index. Their attached notes are hidden. Clear this temporary case before adding further references.</p>}
      <div className="engineering-case-desk-grid">
      <section className="engineering-case-desk-card engineering-case-desk-evidence" aria-label="Working evidence references">
        <div className="engineering-case-desk-card-heading"><span>01 / SOURCE POINTERS</span><h4>Working references · {working.references.length}/{CASE_REFERENCE_LIMIT}</h4><p>Only references present in the current authorized index appear here.</p></div>
        {working.references.length===0?<p>No references selected. Select an indexed source reference, then add it to this temporary case.</p>:<ul className="engineering-investigation-case-references">
          {working.references.map(item=><li key={item.key} className="engineering-case-source-card" data-origin={item.domain}>
            <div className="engineering-case-source-topline">
              <span className="engineering-origin-tag" data-origin={item.domain}>{describeSourceOrigin(item).label}</span>
              <span className="engineering-case-source-kind">{item.kind}</span>
            </div>
            <strong className="engineering-case-source-reference">{item.reference}</strong>
            <small>Owner {item.ownerRecordId} · source record {item.sourceRecordId} · reported state {item.status}</small>
            <p className="engineering-case-source-authority">{describeSourceOrigin(item).authorityLabel} · {describeSourceOrigin(item).explanatoryText}</p>
            <div className="engineering-investigation-case-actions">
              <button type="button" onClick={()=>onInspect(item)}>Inspect indexed source</button>
              <button type="button" onClick={()=>onOpenOwningRecord(item)}>Open owning {item.domain} record</button>
              <button type="button" onClick={()=>{setAttachedKey(item.key);noteFieldRef.current?.focus();}}>Use pointer in draft note</button>
              <button type="button" onClick={()=>{
                setDraft(prev=>removeCaseReference(prev,item.key));
                if(attachedKey===item.key)setAttachedKey('');
                if(editingNoteId!==null){setEditingNoteId(null);setNoteText('');setComposerStatus('Source pointer removed; editing canceled.');}
              }}>Remove reference and attached notes</button>
            </div>
          </li>)}
        </ul>}
      </section>
      <section className="engineering-case-desk-card engineering-case-desk-notes" aria-label="Working questions observations and next steps">
        <div className="engineering-case-desk-card-heading"><span>02 / DRAFT COMPOSER</span><h4>{editingNoteId===null?'Working notes':'Editing working note'} · {working.notes.length}/{CASE_NOTE_LIMIT}</h4><p>{editingNoteId===null?'Write your own question, observation, or proposed action.':'Revise the existing draft without changing its record identity or creating an additional note.'} Attaching a pointer does not substantiate a note.</p></div>
        <div className="engineering-case-desk-draft-context" role="status" aria-live="polite">
          <span className="engineering-origin-tag" data-origin="DRAFT">Engineer-written draft</span>
          <div className="engineering-case-draft-source">
            <span>Source pointer (optional; not evidence that the note is substantiated)</span>
            {working.references.find(item=>item.key===attachedKey)?<strong>
              <span className="engineering-origin-tag" data-origin={working.references.find(item=>item.key===attachedKey)!.domain}>
                {working.references.find(item=>item.key===attachedKey)!.domain} · source-reported
              </span> {working.references.find(item=>item.key===attachedKey)!.reference}
            </strong>:<strong>No indexed source attached</strong>}
          </div>
        </div>
        {editingNoteId!==null&&<div className="engineering-case-edit-banner" role="status">
          <strong>Editing draft note #{editingNoteId}</strong><span>Save replaces this temporary note in place. Cancel leaves it unchanged.</span>
        </div>}
        {composerStatus&&<p className="engineering-case-compose-status" role="status" aria-live="polite">{composerStatus}</p>}
        <form className="engineering-investigation-case-form" onSubmit={addNote}>
          <label>Type
            <select value={noteType} onChange={event=>setNoteType(event.target.value as CaseNoteKind)}>
              {Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Indexed reference (optional)
            <select value={working.references.some(x=>x.key===attachedKey)?attachedKey:''} onChange={event=>setAttachedKey(event.target.value)}>
              <option value="">No reference attached</option>
              {working.references.map(item=><option key={item.key} value={item.key}>{item.domain} · {item.kind} · {item.sourceRecordId}</option>)}
            </select>
          </label>
          <p className="engineering-case-compose-intent" aria-live="polite">
            <strong>{labels[noteType]}</strong> · {noteType==='QUESTION'?'Record what needs to be checked with the owning source.':noteType==='OBSERVATION'?'Describe what you noticed without declaring an engineering finding.':'Describe a proposed follow-up, not an approved action.'}
          </p>
          <label>Working text · maximum {CASE_NOTE_LENGTH} characters
            <textarea ref={noteFieldRef} rows={5} maxLength={CASE_NOTE_LENGTH} value={noteText} onChange={event=>setNoteText(event.target.value)} placeholder="Write a question, observation, or proposed follow-up…"/>
          </label>
          <div className="engineering-case-desk-compose-footer">
            <span aria-live="polite">{noteText.length}/{CASE_NOTE_LENGTH} characters · Unsaved, session only</span>
            <div className="engineering-case-compose-actions">
              {editingNoteId!==null&&<button type="button" onClick={cancelEditing}>Cancel edit</button>}
              <button type="submit" disabled={!noteText.trim()||(editingNoteId===null&&working.notes.length>=CASE_NOTE_LIMIT)||working.withdrawnCount>0}>{editingNoteId!==null?'Save draft changes':'Add working note'}</button>
            </div>
          </div>
        </form>
        {working.notes.length===0?<p>No working notes added.</p>:<ol className="engineering-investigation-case-notes">
          {working.notes.map(({note,evidence})=><li key={note.id} className="engineering-case-draft-note" data-note-kind={note.kind}>
            <div className="engineering-case-note-origin"><span className="engineering-origin-tag" data-origin="DRAFT">Engineer-written draft</span><strong>{labels[note.kind]}</strong></div>
            <p>{note.text}</p>
            <p className="engineering-origin-attachment">{describeWorkingNoteOrigin(evidence).attachmentLabel}</p>
            {evidence?<button type="button" onClick={()=>onInspect(evidence)}>Inspect attached {evidence.domain} · {evidence.sourceRecordId}</button>:<small>Not linked to indexed evidence</small>}
            <div className="engineering-case-note-actions">
              <button type="button" onClick={()=>beginEditing(note.id)} disabled={working.withdrawnCount>0}>Edit working note {note.id}</button>
              <button type="button" onClick={()=>{setDraft(prev=>removeCaseNote(prev,note.id));if(editingNoteId===note.id){setEditingNoteId(null);setNoteText('');}}}>Remove working note {note.id}</button>
            </div>
          </li>)}
        </ol>}
      </section>
      </div>
      <div className="engineering-investigation-review-shortcut engineering-case-desk-review-strip">
        <div><span className="engineering-case-desk-eyebrow">03 / REVIEW PREPARATION</span><strong>Review the draft context</strong>
          <p>{desk.referenceCount} pointer(s), {desk.noteCount} entered note(s). {desk.unlinkedCount} without a source pointer. {desk.limitedSourceCount>0?`${desk.limitedSourceCount} source(s) unavailable or index-limited.`:'Source limitations remain listed in the full preview.'}</p>
          <small>Working-material counts only · no readiness score, submission or technical sign-off.</small>
        </div>
        <div className="engineering-case-review-actions">
          {onReturnToEvidence&&<button type="button" className="engineering-case-return-source" onClick={onReturnToEvidence}>Back to Evidence Explorer</button>}
          <button type="button" onClick={()=>{
            if(reviewDisclosure.current){reviewDisclosure.current.open=true;reviewDisclosure.current.querySelector('summary')?.focus();}
          }}>Open read-only review preview</button>
        </div>
      </div>
      <details ref={reviewDisclosure} className="engineering-investigation-review" aria-label="Read-only investigation review preparation">
        <summary tabIndex={0}><strong>Review preparation preview</strong><span>Read-only · temporary · not submitted</span></summary>
        <div className="engineering-investigation-review-body">
          <p className="engineering-investigation-case-caution">Preparation only for selected asset <code>{review.assetId}</code>. This is not a validated technical report, reviewer decision, approval request, or saved case. No review status is inferred.</p>
          <dl className="engineering-investigation-review-metrics">
            <div><dt>Selected indexed references</dt><dd>{review.references.length}</dd></div>
            <div><dt>Draft observations</dt><dd>{review.observations.length}</dd></div>
            <div><dt>Open questions entered</dt><dd>{review.questions.length}</dd></div>
            <div><dt>Proposed next steps</dt><dd>{review.nextSteps.length}</dd></div>
            <div><dt>Unlinked working notes</dt><dd>{review.unlinkedNoteCount}</dd></div>
          </dl>
          <section aria-label="Working material coverage" className="engineering-review-coverage">
            <h5>Working material coverage <small>Descriptive · not technical readiness</small></h5>
            <p>These labels describe what is entered in this temporary draft and what the connected source indexes report. They do not evaluate whether a review is ready, technically complete, or approved.</p>
            <ul className="engineering-review-coverage-list">
              {material.items.map(item=><li key={item.key}>
                <span className="engineering-review-coverage-indicator" data-state={item.state}>
                  {item.state==='ENTERED'?'Entered':item.state==='NOT_ENTERED'?'Not entered':'Source limited'}
                </span>
                <div><strong>{item.label}</strong><p>{item.description}</p></div>
              </li>)}
            </ul>
            <details className="engineering-review-prompts" aria-label="Working discussion prompts">
              <summary>Discussion prompts · {material.prompts.length}</summary>
              <ul>{material.prompts.map(prompt=><li key={prompt}>{prompt}</li>)}</ul>
            </details>
          </section>
          <section aria-label="Review evidence references">
            <h5>Selected evidence pointers · {review.references.length}</h5>
            {review.references.length===0?<p>No references selected; this does not establish that the asset has no evidence.</p>:<ol>
              {review.references.map(item=><li key={item.key} className="engineering-review-source-item" data-origin={item.domain}>
                <span className="engineering-origin-tag" data-origin={item.domain}>{describeSourceOrigin(item).label}</span>
                <strong>{item.kind}</strong> · {item.reference}
                <small>Owning record {item.ownerRecordId} · source {item.sourceRecordId} · authority {item.authority}</small>
                <button type="button" onClick={()=>onInspect(item)}>Inspect indexed source</button>
              </li>)}
            </ol>}
          </section>
          {reviewNotes('Draft working observations',review.observations)}
          {reviewNotes('Open questions (not verified or resolved)',review.questions)}
          {reviewNotes('Proposed next steps (not assigned)',review.nextSteps)}
          <section aria-label="Review source coverage">
            <h5>Independent source availability and index coverage</h5>
            {review.sources.length===0?<p>Coverage metadata was not supplied to this standalone view.</p>:<ul>
              {review.sources.map(source=><li key={source.domain}>
                {source.domain}: {source.state} · {source.indexed} of {source.totalReported} reported references indexed
                {source.truncated?' · index limited':''}
              </li>)}
            </ul>}
          </section>
          <section aria-label="Review limitations">
            <h5>Review limitations and unresolved context</h5>
            <ul>{review.limitations.map(text=><li key={text}>{text}</li>)}</ul>
          </section>
          <p><strong>No submission, export, download, copying, persistence, sign-off, or approval is available from this preview.</strong></p>
        </div>
      </details>
    </div>
  </details>;
}
