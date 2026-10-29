import {describe,expect,it} from 'vitest';
import {compareIndexedEvidence} from './evidenceComparison';
import type {EngineeringEvidence} from './engineeringEvidenceModel';

const record=(key:string,changes:Partial<EngineeringEvidence>={}):EngineeringEvidence=>({
  key,domain:'COR',kind:'Calculation trace',sourceRecordId:`source-${key}`,
  ownerRecordId:'circuit-1',reference:`TRACE-${key}`,supportingReference:null,
  revision:null,reportedAt:'2026-03-01T00:00:00Z',status:'DRAFT',authority:'SOURCE_REFERENCE',...changes,
});
const entries=[record('one'),record('two',{reference:'TRACE-one',revision:'r2'}),
  record('three',{domain:'INS',kind:'Due candidate',ownerRecordId:'requirement-1',
    authority:'DUE_CANDIDATE',reportedAt:null})];

describe('Phase 46.13: source-text-only evidence comparison',()=>{
  it('does not resolve absent, duplicated or withdrawn keys',()=>{
    expect(compareIndexedEvidence(entries,null,'one')).toBeNull();
    expect(compareIndexedEvidence(entries,'one','one')).toBeNull();
    expect(compareIndexedEvidence(entries,'one','unknown')).toBeNull();
    expect(compareIndexedEvidence([], 'one','two')).toBeNull();
  });
  it('reports textual matches and different values, never engineering equivalence',()=>{
    const c=compareIndexedEvidence(entries,'one','two')!;
    expect(c.sameOwner).toBe(true);
    expect(c.sameKind).toBe(true);
    expect(c.rows.find(r=>r.label==='Reported reference')?.status).toBe('SAME_REPORTED_TEXT');
    expect(c.rows.find(r=>r.label==='Revision')?.status).toBe('ONE_NOT_SUPPLIED');
    expect(c.rows.find(r=>r.label==='Supporting reference')?.status).toBe('BOTH_NOT_SUPPLIED');
    expect(c.rows.find(r=>r.label==='Source record ID')?.status).toBe('DIFFERENT_REPORTED_TEXT');
    expect(Object.keys(c)).toEqual(['a','b','sameOwner','sameKind','rows']);
  });
  it('never conflates COR basis references with INS governing authority',()=>{
    const c=compareIndexedEvidence(entries,'one','three')!;
    expect(c.sameOwner).toBe(false);
    expect(c.sameKind).toBe(false);
    expect(c.rows.find(r=>r.label==='Source authority class')?.b).toBe('DUE_CANDIDATE');
    expect(c.rows.some(r=>r.label==='Governing due date')).toBe(false);
  });
  it('only shows current indexed text, not previous-scope record objects',()=>{
    const old=compareIndexedEvidence(entries,'one','two')!;
    const updated=[record('one',{reference:'NEW-SOURCE'}),record('two',{reference:'NEW-SECOND'})];
    expect(old.a.reference).toBe('TRACE-one');
    expect(compareIndexedEvidence(updated,'one','two')?.a.reference).toBe('NEW-SOURCE');
    expect(compareIndexedEvidence(updated.slice(0,1),'one','two')).toBeNull();
  });
});
