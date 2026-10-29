import {describe,expect,it} from 'vitest';
import {emptyInvestigationCase,addCaseReference,addCaseNote,CASE_REFERENCE_LIMIT} from './evidenceCase';
import {stageEvidenceHandoff,type EvidenceHandoffRequest} from './investigationHandoffModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
const entry=(key:string):EngineeringEvidence=>({key,domain:'COR',kind:'Calculation trace',ownerRecordId:'C1',sourceRecordId:key,
  reference:key,revision:null,supportingReference:null,reportedAt:null,status:'DRAFT',authority:'SOURCE_REFERENCE'});
const request=(kind:EvidenceHandoffRequest['kind']='QUESTION',key='R0'):EvidenceHandoffRequest=>({sequence:1,kind,evidenceKey:key});
describe('Phase 46.22 authorized temporary handoff',()=>{
  const index=Array.from({length:CASE_REFERENCE_LIMIT+1},(_,i)=>entry('R'+i));
  it('stages a source key without generating a note',()=>{
    const next=stageEvidenceHandoff(emptyInvestigationCase('A'),'A',index,request());
    expect(next.status).toBe('ADDED');expect(next.state.referenceKeys).toEqual(['R0']);
    expect(next.state.notes).toHaveLength(0);expect(next.attachedKey).toBe('R0');expect(next.draftNoteKind).toBe('QUESTION');
  });
  it('supports an unmodified reference-only action',()=>{
    const next=stageEvidenceHandoff(emptyInvestigationCase('A'),'A',index,request('REFERENCE'));
    expect(next.draftNoteKind).toBeNull();expect(next.state.notes).toHaveLength(0);
  });
  it('reuses an existing source without duplicating it',()=>{
    const existing=addCaseReference(emptyInvestigationCase('A'),'A','R0',index);
    const result=stageEvidenceHandoff(existing,'A',index,request('NEXT_STEP'));
    expect(result.status).toBe('ALREADY_SELECTED');expect(result.state).toBe(existing);
    expect(result.draftNoteKind).toBe('NEXT_STEP');
  });
  it('rejects wrong asset, missing sources and withdrawn prior references',()=>{
    const initial=emptyInvestigationCase('A');
    expect(stageEvidenceHandoff(initial,'B',index,request()).status).toBe('UNAVAILABLE');
    expect(stageEvidenceHandoff(initial,'A',[],request()).status).toBe('UNAVAILABLE');
    const withdrawn=addCaseReference(initial,'A','R0',index);
    expect(stageEvidenceHandoff(withdrawn,'A',[entry('R1')],request('QUESTION','R1')).status).toBe('UNAVAILABLE');
  });
  it('never silently drops linked working notes',()=>{
    const one=addCaseReference(emptyInvestigationCase('A'),'A','R0',index);
    const withNote=addCaseNote(one,'A','QUESTION','This note must stay unapproved','R0',index);
    const result=stageEvidenceHandoff(withNote,'A',index,request('OBSERVATION','R1'));
    expect(result.state.notes).toEqual(withNote.notes);
    expect(result.state.referenceKeys).toEqual(['R0','R1']);
  });
  it('blocks new entries at capacity but permits an existing reference to be staged',()=>{
    let full=emptyInvestigationCase('A');
    for(let i=0;i<CASE_REFERENCE_LIMIT;i++)full=addCaseReference(full,'A','R'+i,index);
    expect(stageEvidenceHandoff(full,'A',index,request('QUESTION','R'+CASE_REFERENCE_LIMIT)).status).toBe('LIMIT_REACHED');
    expect(stageEvidenceHandoff(full,'A',index,request('QUESTION','R0')).status).toBe('ALREADY_SELECTED');
  });
  it('rejects malformed requests',()=>{
    const initial=emptyInvestigationCase('A');
    expect(stageEvidenceHandoff(initial,'A',index,{sequence:0,evidenceKey:'R0',kind:'QUESTION'}).status).toBe('UNAVAILABLE');
    expect(stageEvidenceHandoff(initial,'A',index,{sequence:1,evidenceKey:'R0',kind:'APPROVED' as EvidenceHandoffRequest['kind']}).status).toBe('UNAVAILABLE');
  });
});
