import {describe,expect,it} from 'vitest';
import {addCaseNote,addCaseReference,emptyInvestigationCase,projectInvestigationCase} from './evidenceCase';
import {prepareInvestigationReview} from './evidenceReviewPreparation';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
const e=(key:string,ownerRecordId='C1'):EngineeringEvidence=>({key,domain:'COR',kind:'Calculation trace',
  sourceRecordId:key,ownerRecordId,reference:`REF-${key}`,supportingReference:null,revision:'r1',
  reportedAt:'2026-10-01T00:00:00Z',status:'DRAFT',authority:'SOURCE_REFERENCE'});
const index=[e('K1'),e('K2')];
const coverage=[{domain:'COR' as const,state:'ready' as const,indexed:2,totalReported:3,truncated:true},
  {domain:'INS' as const,state:'rejected' as const,indexed:5,totalReported:5,truncated:false}];
function working(){
  let state=addCaseReference(emptyInvestigationCase('A1'),'A1','K1',index);
  state=addCaseNote(state,'A1','OBSERVATION','Reported discrepancy','K1',index);
  state=addCaseNote(state,'A1','QUESTION','Confirm source','K1',index);
  state=addCaseNote(state,'A1','NEXT_STEP','Propose verification',null,index);
  return state;
}
describe('Phase 46.19 read-only review preparation',()=>{
  it('groups only visible working notes and references',()=>{
    const review=prepareInvestigationReview(projectInvestigationCase(working(),'A1',index),coverage);
    expect(review.references.map(x=>x.key)).toEqual(['K1']);
    expect(review.observations.map(x=>x.text)).toEqual(['Reported discrepancy']);
    expect(review.questions.map(x=>x.text)).toEqual(['Confirm source']);
    expect(review.nextSteps.map(x=>x.text)).toEqual(['Propose verification']);
    expect(review.unlinkedNoteCount).toBe(1);
    expect(review.questions[0]?.evidence?.key).toBe('K1');
  });
  it('does not expose withdrawn source or anchored notes',()=>{
    const review=prepareInvestigationReview(projectInvestigationCase(working(),'A1',[]),coverage);
    expect(review.references).toHaveLength(0);
    expect(review.observations).toHaveLength(0);
    expect(review.questions).toHaveLength(0);
    expect(review.nextSteps).toHaveLength(1);
    expect(review.withdrawnReferenceCount).toBe(1);
    expect(review.limitations.join(' ')).toContain('unavailable');
  });
  it('asset scope rotation removes all projected references and notes',()=>{
    const review=prepareInvestigationReview(projectInvestigationCase(working(),'A2',index));
    expect(review.assetId).toBe('A2');
    expect(review.references).toEqual([]);
    expect(review.questions).toEqual([]);
  });
  it('does not upgrade rejected index state or claim completeness',()=>{
    const review=prepareInvestigationReview(projectInvestigationCase(working(),'A1',index),coverage);
    expect(review.sources[0]).toMatchObject({state:'ready',indexed:2,totalReported:3,truncated:true});
    expect(review.sources[1]).toMatchObject({state:'rejected',indexed:0,totalReported:0,truncated:false});
    expect(review.limitations.join(' ')).toMatch(/disconnected or rejected/);
    expect(review.limitations.join(' ')).toMatch(/display limit/);
    expect(review).not.toHaveProperty('approved');
  });
  it('reports unknown coverage without pretending sources are connected',()=>{
    const review=prepareInvestigationReview(projectInvestigationCase(emptyInvestigationCase('A1'),'A1',index));
    expect(review.sources).toEqual([]);
    expect(review.limitations.join(' ')).toContain('not supplied');
  });
  it('does not accept a forged owner link from malformed projections',()=>{
    const projection=projectInvestigationCase(working(),'A1',index);
    const forged={...projection,notes:projection.notes.map(item=>({note:item.note,evidence:item.evidence?e('K1','OTHER'):null}))};
    const review=prepareInvestigationReview(forged);
    expect(review.observations).toHaveLength(0);
    expect(review.questions).toHaveLength(0);
    expect(review.nextSteps).toHaveLength(1);
  });
});
