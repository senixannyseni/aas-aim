/**
 * Phase 46.18: session-only investigation scratchpad for one authorized asset.
 * This module contains no storage, transport, export, approval or engineering
 * decision logic. Source keys are resolved against the CURRENT authorized index.
 */
import type {EngineeringEvidence} from './engineeringEvidenceModel';

export const CASE_REFERENCE_LIMIT=12;
export const CASE_NOTE_LIMIT=18;
export const CASE_NOTE_LENGTH=400;
export type CaseNoteKind='OBSERVATION'|'QUESTION'|'NEXT_STEP';
export type CaseNote=Readonly<{
  id:number;
  kind:CaseNoteKind;
  text:string;
  evidenceKey:string|null;
}>;
export type InvestigationCase=Readonly<{
  assetId:string;
  referenceKeys:readonly string[];
  notes:readonly CaseNote[];
  nextId:number;
}>;
export type ProjectedCase=Readonly<{
  assetId:string;
  references:readonly EngineeringEvidence[];
  notes:readonly Readonly<{note:CaseNote; evidence:EngineeringEvidence|null}>[];
  /** Items filtered when the caller supplied a withdrawn/changed authorized index. */
  withdrawnCount:number;
}>;

export function emptyInvestigationCase(assetId:string):InvestigationCase{
  return {assetId,referenceKeys:[],notes:[],nextId:1};
}
function currentEvidence(key:string,authorized:readonly EngineeringEvidence[]):EngineeringEvidence|null{
  return authorized.find(item=>item.key===key)??null;
}
function validNoteKind(value:unknown):value is CaseNoteKind{
  return value==='OBSERVATION'||value==='QUESTION'||value==='NEXT_STEP';
}
export function addCaseReference(state:InvestigationCase,assetId:string,key:string,
  authorized:readonly EngineeringEvidence[]):InvestigationCase{
  if(state.assetId!==assetId||state.referenceKeys.includes(key)||state.referenceKeys.length>=CASE_REFERENCE_LIMIT||!currentEvidence(key,authorized))return state;
  return {...state,referenceKeys:[...state.referenceKeys,key]};
}
export function removeCaseReference(state:InvestigationCase,key:string):InvestigationCase{
  if(!state.referenceKeys.includes(key))return state;
  // Remove anchored draft notes as well: never silently promote notes to unanchored statements.
  return {...state,referenceKeys:state.referenceKeys.filter(x=>x!==key),notes:state.notes.filter(x=>x.evidenceKey!==key)};
}
export function addCaseNote(state:InvestigationCase,assetId:string,kind:CaseNoteKind,text:string,
  evidenceKey:string|null,authorized:readonly EngineeringEvidence[]):InvestigationCase{
  if(state.assetId!==assetId||!validNoteKind(kind)||state.notes.length>=CASE_NOTE_LIMIT)return state;
  const clean=text.trim();
  if(!clean||clean.length>CASE_NOTE_LENGTH)return state;
  if(evidenceKey!==null&&(!state.referenceKeys.includes(evidenceKey)||!currentEvidence(evidenceKey,authorized)))return state;
  const note:CaseNote={id:state.nextId,kind,text:clean,evidenceKey};
  return {...state,notes:[...state.notes,note],nextId:state.nextId+1};
}
/** Edit an existing *visible* draft without changing its ID, count, or provenance.
 * A source-attached note cannot be reattached to an unavailable/withdrawn pointer.
 * Never infer a new owning record from an ID supplied by the UI.
 */
export function updateCaseNote(state:InvestigationCase,assetId:string,id:number,
  kind:CaseNoteKind,text:string,evidenceKey:string|null,
  authorized:readonly EngineeringEvidence[]):InvestigationCase{
  if(state.assetId!==assetId||!Number.isSafeInteger(id)||!validNoteKind(kind))return state;
  const note=state.notes.find(item=>item.id===id);
  if(!note)return state;
  const clean=text.trim();
  if(!clean||clean.length>CASE_NOTE_LENGTH)return state;
  // A withdrawn note is not editable merely by dropping its source attachment.
  if(note.evidenceKey!==null&&(!state.referenceKeys.includes(note.evidenceKey)||!currentEvidence(note.evidenceKey,authorized)))return state;
  if(evidenceKey!==null&&(!state.referenceKeys.includes(evidenceKey)||!currentEvidence(evidenceKey,authorized)))return state;
  if(note.text===clean&&note.kind===kind&&note.evidenceKey===evidenceKey)return state;
  return {...state,notes:state.notes.map(item=>item.id===id?{...item,text:clean,kind,evidenceKey}:item)};
}
export function removeCaseNote(state:InvestigationCase,id:number):InvestigationCase{
  return {...state,notes:state.notes.filter(note=>note.id!==id)};
}
/** Safe render projection: withdrawn references and their attached notes NEVER display. */
export function projectInvestigationCase(state:InvestigationCase,assetId:string,
  authorized:readonly EngineeringEvidence[]):ProjectedCase{
  if(state.assetId!==assetId)return {assetId,references:[],notes:[],withdrawnCount:0};
  const visible=new Map<string,EngineeringEvidence>();
  for(const key of state.referenceKeys){
    const item=currentEvidence(key,authorized);
    if(item)visible.set(key,item);
  }
  const notes:ProjectedCase["notes"][number][]=[];
  for(const note of state.notes){
    if(note.evidenceKey===null){notes.push({note,evidence:null});continue;}
    const evidence=visible.get(note.evidenceKey);
    if(evidence)notes.push({note,evidence});
  }
  return {
    assetId,references:[...visible.values()],notes,
    withdrawnCount:state.referenceKeys.length-visible.size,
  };
}
