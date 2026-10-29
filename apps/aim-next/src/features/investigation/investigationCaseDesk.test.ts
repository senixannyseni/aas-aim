import {describe,it,expect} from 'vitest';
import {summarizeCaseDesk} from './investigationCaseDesk';
import {emptyInvestigationCase,addCaseReference,addCaseNote,projectInvestigationCase} from './evidenceCase';
import {prepareInvestigationReview} from './evidenceReviewPreparation';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
const entry:EngineeringEvidence={key:'COR:X1',domain:'COR',kind:'Calculation trace',sourceRecordId:'X1',ownerRecordId:'O1',reference:'CALC-X1',revision:null,reportedAt:null,status:'DRAFT',supportingReference:null,authority:'SOURCE_REFERENCE'};
const sources=[{domain:'COR' as const,state:'ready' as const,indexed:1,totalReported:200,truncated:true},{domain:'INS' as const,state:'disconnected' as const,indexed:0,totalReported:0,truncated:false}];
describe('Phase 46.23 case desk descriptive projection',()=>{
  it('counts only authorized projected notes and source pointers',()=>{
    let c=addCaseReference(emptyInvestigationCase('A1'),'A1',entry.key,[entry]);
    c=addCaseNote(c,'A1','QUESTION','Question A',entry.key,[entry]);
    c=addCaseNote(c,'A1','OBSERVATION','Working observation',null,[entry]);
    c=addCaseNote(c,'A1','NEXT_STEP','Proposed next step',null,[entry]);
    const s=summarizeCaseDesk(prepareInvestigationReview(projectInvestigationCase(c,'A1',[entry]),sources));
    expect(s).toMatchObject({referenceCount:1,noteCount:3,questionCount:1,observationCount:1,nextStepCount:1,unlinkedCount:2,limitedSourceCount:2});
  });
  it('never counts withdrawn attached notes after authorization changes',()=>{
    let c=addCaseReference(emptyInvestigationCase('A1'),'A1',entry.key,[entry]);
    c=addCaseNote(c,'A1','QUESTION','Withdrawn question',entry.key,[entry]);
    const s=summarizeCaseDesk(prepareInvestigationReview(projectInvestigationCase(c,'A1',[]),sources));
    expect(s).toMatchObject({referenceCount:0,noteCount:0,questionCount:0,withdrawnReferenceCount:1});
  });
  it('does not promote a different asset case',()=>{
    const s=summarizeCaseDesk(prepareInvestigationReview(projectInvestigationCase(emptyInvestigationCase('A1'),'A2',[entry])));
    expect(s.referenceCount).toBe(0);expect(s.noteCount).toBe(0);
  });
});
