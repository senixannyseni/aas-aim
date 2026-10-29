import {describe,expect,it} from 'vitest';
import {buildEvidenceChronology,entriesForChronology,reportedInstant} from './evidenceChronology';
import type {EngineeringEvidence} from './engineeringEvidenceModel';

const evidence=(key:string,changes:Partial<EngineeringEvidence>={}):EngineeringEvidence=>({
  key,domain:'COR',kind:'Calculation trace',sourceRecordId:key,ownerRecordId:'C1',
  reference:`REF-${key}`,supportingReference:null,revision:null,reportedAt:null,
  status:'DRAFT',authority:'SOURCE_REFERENCE',...changes,
});

describe('Phase 46.14: source-reported chronology and field coverage',()=>{
  it('orders timezone-qualified source timestamps by UTC instant, not lexically',()=>{
    const rows=[evidence('A',{reportedAt:'2026-03-01T09:00:00+07:00'}),evidence('B',{reportedAt:'2026-03-01T03:00:00Z'}),evidence('C',{reportedAt:'2026-02-28T23:30:00-04:00'})];
    expect(buildEvidenceChronology(rows).sourceTimes.map(x=>x.evidence.key)).toEqual(['C','B','A']);
    expect(rows.map(x=>x.key)).toEqual(['A','B','C']);
  });
  it('never mixes due-date targets with source-reported occurrence fields',()=>{
    const rows=[evidence('decision',{domain:'INS',kind:'INS governing due basis',authority:'GOVERNING_INS_DECISION',reportedAt:'2026-04-01T00:00:00Z'}),
      evidence('due2',{domain:'INS',kind:'Due candidate',authority:'DUE_CANDIDATE',reportedAt:'2027-01-01T00:00:00Z'}),
      evidence('due1',{domain:'INS',kind:'Due candidate',authority:'DUE_CANDIDATE',reportedAt:'2026-12-01T00:00:00Z'})];
    const view=buildEvidenceChronology(rows);
    expect(view.sourceTimes.map(x=>x.evidence.key)).toEqual(['decision']);
    expect(view.dueTargets.map(x=>x.evidence.key)).toEqual(['due1','due2']);
    expect(entriesForChronology(view,'SOURCE_INDEX')).toEqual(rows);
  });
  it('leaves missing, invalid calendar, and offset-free timestamps unplaced',()=>{
    const rows=[evidence('missing'),evidence('dateOnly',{reportedAt:'2026-03-01'}),
      evidence('local',{reportedAt:'2026-03-01T00:00:00'}),evidence('impossible',{reportedAt:'2026-02-30T00:00:00Z'}),
      evidence('valid',{reportedAt:'2024-02-29T00:00:00.123Z'})];
    const view=buildEvidenceChronology(rows);
    expect(view.sourceTimes).toHaveLength(1);
    expect(view.unplaced.map(x=>x.evidence.key)).toEqual(['missing','dateOnly','local','impossible']);
    expect(view.coverage.timestampNotSupplied).toBe(1);
    expect(view.coverage.timestampUnorderable).toBe(3);
    expect(reportedInstant('2026-02-29T00:00:00Z')).toBeNull();
    expect(reportedInstant('2026-01-01T00:00:00+14:01')).toBeNull();
  });
  it('distinguishes optional-field absence from an engineering completeness judgment',()=>{
    const view=buildEvidenceChronology([evidence('noFields'),evidence('supplied',{revision:'r1',supportingReference:'BASIS-1',reportedAt:'2026-01-01T00:00:00Z'})]);
    expect(view.coverage).toMatchObject({indexed:2,revisionNotSupplied:1,supportingReferenceNotSupplied:1,timestampNotSupplied:1});
    expect(view.unplaced[0]?.notSupplied).toEqual(['Source timestamp','Revision','Supporting reference']);
    expect('approved' in view).toBe(false);
  });
  it('preserves stable original index order for exact ties',()=>{
    const at='2026-03-01T00:00:00Z';
    expect(buildEvidenceChronology([evidence('a',{reportedAt:at}),evidence('b',{reportedAt:at})]).sourceTimes.map(x=>x.evidence.key)).toEqual(['a','b']);
  });
  it('cannot synthesize withdrawn references from an empty authorized index',()=>{
    const view=buildEvidenceChronology([]);
    for(const mode of ['SOURCE_INDEX','SOURCE_TIMES','DUE_TARGETS','UNPLACED'] as const){
      expect(entriesForChronology(view,mode)).toHaveLength(0);
    }
    expect(view.coverage.indexed).toBe(0);
  });
});
