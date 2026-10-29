import {describe,expect,it} from 'vitest';
import {summarizeAuthorizedInvestigation} from './evidenceInvestigationSummary';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
import type {EngineeringEvidence,EvidenceIndex} from './engineeringEvidenceModel';

const entry=(key:string,changes:Partial<EngineeringEvidence>={}):EngineeringEvidence=>({
  key,domain:'COR',kind:'Calculation trace',sourceRecordId:key,ownerRecordId:'C1',
  reference:'REF',supportingReference:null,revision:'r1',reportedAt:'2026-03-02T12:00:00Z',
  status:'DRAFT',authority:'SOURCE_REFERENCE',...changes,
});
const index=(entries:readonly EngineeringEvidence[],total=entries.length):EvidenceIndex=>({entries,total,truncated:total>entries.length});
const context=(corrosion:EvidenceIndex,inspection:EvidenceIndex,corState:'ready'|'rejected'|'disconnected'='ready',insState:'ready'|'rejected'|'disconnected'='ready'):CrossDomainContext=>({
  asset:{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'},
  corrosion:{state:corState,records:[]},inspection:{state:insState,records:[]},
  evidence:{corrosion,inspection},
});

describe('Phase 46.16 investigation summary',()=>{
  it('reports only the indexed and reported counts, not an exhaustive assessment',()=>{
    const result=summarizeAuthorizedInvestigation(context(index([entry('a')],9),index([])));
    expect(result.indexed).toBe(1);
    expect(result.totalReported).toBe(9);
    expect(result.limited).toBe(true);
    expect(result.independentlyAvailableSources).toBe(2);
    expect(result.sources[0]?.truncated).toBe(true);
  });
  it('counts reported source times separately from due targets',()=>{
    const result=summarizeAuthorizedInvestigation(context(index([entry('a')]),index([
      entry('ins',{domain:'INS',authority:'DUE_CANDIDATE',ownerRecordId:'I1'}),
    ])));
    expect(result.reportedSourceTimes).toBe(1);
    expect(result.dueTargets).toBe(1);
  });
  it('counts missing and unorderable timestamps without guessing dates',()=>{
    const result=summarizeAuthorizedInvestigation(context(index([
      entry('a',{reportedAt:null}),entry('b',{reportedAt:'2026-02-30T00:00:00Z'}),
    ]),index([])));
    expect(result.timestampNotSupplied).toBe(1);
    expect(result.timestampNotOrderable).toBe(1);
    expect(result.reportedSourceTimes).toBe(0);
  });
  it('does not treat missing optional revisions as compliance failures',()=>{
    const result=summarizeAuthorizedInvestigation(context(index([entry('a',{revision:null,supportingReference:null})]),index([])));
    expect(result.revisionNotSupplied).toBe(1);
    expect(result.supportingReferenceNotSupplied).toBe(1);
    expect(result).not.toHaveProperty('deficiencies');
    expect(result).not.toHaveProperty('approved');
  });
  it('exposes exact-text patterns only and bounded owning source paths',()=>{
    const result=summarizeAuthorizedInvestigation(context(index([
      entry('a'),entry('b',{revision:'r2'}),entry('c',{domain:'COR',ownerRecordId:'C2'}),
    ]),index([])));
    expect(result.observationCounts.REVISION_VARIATION).toBe(1);
    expect(result.observationCounts.REFERENCE_REUSE).toBe(1);
    expect(result.reviewPaths.length).toBeLessThanOrEqual(3);
    expect(result.reviewPaths.every(x=>x.example.ownerRecordId==='C1'||x.example.ownerRecordId==='C2')).toBe(true);
  });
  it('does not leak stale entries from a rejected source',()=>{
    const result=summarizeAuthorizedInvestigation(context(index([entry('secret',{reference:'HIDDEN'})]),index([]),'rejected'));
    expect(result.indexed).toBe(0);
    expect(result.totalReported).toBe(0);
    expect(result.reviewPaths).toHaveLength(0);
    expect(result.sources[0]?.state).toBe('rejected');
  });
  it('does not treat disconnected source as an absence conclusion',()=>{
    const result=summarizeAuthorizedInvestigation(context(index([]),index([]),'disconnected','ready'));
    expect(result.independentlyAvailableSources).toBe(1);
    expect(result.observationsTotal).toBe(0);
  });
  it('returns no review paths from empty evidence',()=>{
    const result=summarizeAuthorizedInvestigation(context(index([]),index([])));
    expect(result.reviewPaths).toHaveLength(0);
    expect(result.indexed).toBe(0);
  });
});
