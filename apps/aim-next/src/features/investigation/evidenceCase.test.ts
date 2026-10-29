import {describe,expect,it} from 'vitest';
import {CASE_NOTE_LENGTH,CASE_NOTE_LIMIT,CASE_REFERENCE_LIMIT,addCaseNote,addCaseReference,
  emptyInvestigationCase,projectInvestigationCase,removeCaseNote,removeCaseReference} from './evidenceCase';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
const e=(key:string):EngineeringEvidence=>({key,domain:'COR',kind:'Calculation trace',sourceRecordId:key,
  ownerRecordId:'C1',reference:`R-${key}`,supportingReference:null,revision:null,reportedAt:null,status:'DRAFT',authority:'SOURCE_REFERENCE'});
const entries=Array.from({length:20},(_,i)=>e(`k${i}`));
describe('Phase 46.18 temporary case model',()=>{
  it('begins empty, with no authority or storage fields',()=>{
    const state=emptyInvestigationCase('A1');
    expect(projectInvestigationCase(state,'A1',entries).references).toEqual([]);
    expect(state).not.toHaveProperty('approved');expect(state).not.toHaveProperty('url');
  });
  it('only adds currently authorized indexed references',()=>{
    const state=emptyInvestigationCase('A1');
    expect(addCaseReference(state,'A1','UNKNOWN',entries)).toBe(state);
    expect(addCaseReference(state,'WRONG','k0',entries)).toBe(state);
    expect(addCaseReference(state,'A1','k0',entries).referenceKeys).toEqual(['k0']);
  });
  it('deduplicates and caps selected references',()=>{
    let state=emptyInvestigationCase('A1');
    for(const entry of entries)state=addCaseReference(state,'A1',entry.key,entries);
    expect(state.referenceKeys).toHaveLength(CASE_REFERENCE_LIMIT);
    expect(addCaseReference(state,'A1','k0',entries)).toBe(state);
  });
  it('accepts bounded notes but rejects empty, oversized, foreign or untracked anchors',()=>{
    const base=addCaseReference(emptyInvestigationCase('A1'),'A1','k0',entries);
    expect(addCaseNote(base,'A1','QUESTION','   ',null,entries)).toBe(base);
    expect(addCaseNote(base,'A1','QUESTION','x'.repeat(CASE_NOTE_LENGTH+1),null,entries)).toBe(base);
    expect(addCaseNote(base,'A2','QUESTION','hello',null,entries)).toBe(base);
    expect(addCaseNote(base,'A1','QUESTION','hello','k1',entries)).toBe(base);
    const next=addCaseNote(base,'A1','QUESTION','  investigate this  ','k0',entries);
    expect(next.notes[0]?.text).toBe('investigate this');
    expect(next.notes[0]?.evidenceKey).toBe('k0');
  });
  it('does not display withdrawn references or their anchored notes',()=>{
    const base=addCaseReference(emptyInvestigationCase('A1'),'A1','k0',entries);
    const withNote=addCaseNote(base,'A1','OBSERVATION','reported excerpt','k0',entries);
    const revoked=projectInvestigationCase(withNote,'A1',[]);
    expect(revoked.references).toHaveLength(0);expect(revoked.notes).toHaveLength(0);
    expect(revoked.withdrawnCount).toBe(1);
  });
  it('suppresses an entire old session on asset rotation',()=>{
    const state=addCaseNote(emptyInvestigationCase('A1'),'A1','QUESTION','draft thought',null,entries);
    expect(projectInvestigationCase(state,'A2',entries).notes).toHaveLength(0);
  });
  it('removing source also removes associated notes, not unanchored notes',()=>{
    const one=addCaseReference(emptyInvestigationCase('A1'),'A1','k0',entries);
    const two=addCaseNote(one,'A1','NEXT_STEP','source action','k0',entries);
    const three=addCaseNote(two,'A1','QUESTION','general question',null,entries);
    const removed=removeCaseReference(three,'k0');
    expect(removed.notes.map(x=>x.text)).toEqual(['general question']);
    expect(removeCaseNote(removed,2).notes).toEqual([]);
  });
  it('limits total note count and increments stable IDs',()=>{
    let state=emptyInvestigationCase('A1');
    for(let i=0;i<CASE_NOTE_LIMIT+5;i++)state=addCaseNote(state,'A1','QUESTION',`question ${i}`,null,entries);
    expect(state.notes).toHaveLength(CASE_NOTE_LIMIT);
    expect(state.notes.at(-1)?.id).toBe(CASE_NOTE_LIMIT);
    expect(state.nextId).toBe(CASE_NOTE_LIMIT+1);
  });
  it('retains only authorized source identities in the projected view',()=>{
    const state=addCaseReference(emptyInvestigationCase('A1'),'A1','k0',entries);
    const changed=projectInvestigationCase(state,'A1',[e('k1')]);
    expect(changed.references).toEqual([]);
    expect(changed.withdrawnCount).toBe(1);
  });
});
