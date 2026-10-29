import {describe,expect,it} from 'vitest';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import {CONSISTENCY_VIEW_LIMIT,inspectEvidenceConsistency} from './evidenceConsistency';
const row=(key:string,changes:Partial<EngineeringEvidence>={}):EngineeringEvidence=>({
  key,domain:'COR',kind:'Calculation trace',sourceRecordId:key,ownerRecordId:'C1',
  reference:'TRACE-1',supportingReference:null,revision:'r1',reportedAt:'2026-01-01T00:00:00Z',
  status:'DRAFT',authority:'SOURCE_REFERENCE',...changes,
});
describe('Phase 46.15: reported evidence consistency is observational only',()=>{
  it('empty index does not assert completeness',()=>{
    const v=inspectEvidenceConsistency([]);
    expect(v.examinedReferences).toBe(0);expect(v.observations).toHaveLength(0);
  });
  it('one item is not a discrepancy',()=>expect(inspectEvidenceConsistency([row('one')]).observations).toHaveLength(0));
  it('reports different supplied revisions in the same owner/kind/reference',()=>{
    const v=inspectEvidenceConsistency([row('a'),row('b',{revision:'r2'})]);
    expect(v.counts.REVISION_VARIATION).toBe(1);
    expect(v.counts.STATE_VARIATION).toBe(0);
    expect(v.observations[0]?.examples.map(x=>x.key)).toEqual(['a','b']);
  });
  it('reports divergent state text separately from revision variations',()=>{
    const v=inspectEvidenceConsistency([row('a'),row('b',{status:'REVIEWED'})]);
    expect(v.counts.STATE_VARIATION).toBe(1);expect(v.counts.REVISION_VARIATION).toBe(0);
  });
  it('does not treat an absent revision as evidence of a mismatch',()=>{
    const v=inspectEvidenceConsistency([row('a',{revision:null}),row('b',{revision:'r2'})]);
    expect(v.counts.REVISION_VARIATION).toBe(0);
  });
  it('does not infer a chronology conflict from different reported dates',()=>{
    const v=inspectEvidenceConsistency([row('a'),row('b',{reportedAt:'2026-02-01T00:00:00Z'})]);
    expect(v.observations).toHaveLength(0);
  });
  it('does not compare statuses across different owners as if same engineering record',()=>{
    const v=inspectEvidenceConsistency([row('a'),row('b',{ownerRecordId:'C2',status:'APPROVED'})]);
    expect(v.counts.STATE_VARIATION).toBe(0);expect(v.counts.REFERENCE_REUSE).toBe(1);
  });
  it('reports exact text reuse across domains without claiming linkage',()=>{
    const v=inspectEvidenceConsistency([row('a'),row('b',{domain:'INS',kind:'Requirement basis',ownerRecordId:'I1'})]);
    expect(v.counts.REFERENCE_REUSE).toBe(1);
    expect(v.observations[0]?.ownerDomain).toBeNull();
    expect(v.observations[0]?.summary).toContain('does not establish');
  });
  it('does not normalize case or whitespace for document identity',()=>{
    const v=inspectEvidenceConsistency([row('a',{reference:'TRACE-1'}),row('b',{reference:'trace-1 ',ownerRecordId:'C2'})]);
    expect(v.observations).toHaveLength(0);
  });
  it('does not mistake differences in record kind for a same-kind status conflict',()=>{
    const v=inspectEvidenceConsistency([row('a'),row('b',{kind:'Requirement basis',status:'APPROVED'})]);
    expect(v.counts.STATE_VARIATION).toBe(0);
  });
  it('deduplicates the same bounded index key',()=>{
    const v=inspectEvidenceConsistency([row('a'),row('a',{revision:'r2'})]);
    expect(v.examinedReferences).toBe(1);expect(v.observations).toHaveLength(0);
  });
  it('never scans outside the explicitly passed selected-asset index',()=>{
    const v=inspectEvidenceConsistency([row('selected')]);
    expect(JSON.stringify(v)).not.toContain('FOREIGN');
  });
  it('limits display patterns without suppressing bounded counts',()=>{
    const rows:EngineeringEvidence[]=[];
    for(let i=0;i<CONSISTENCY_VIEW_LIMIT+5;i++){
      rows.push(row(`a${i}`,{reference:`R-${i}`,ownerRecordId:'A'}));
      rows.push(row(`b${i}`,{reference:`R-${i}`,ownerRecordId:'B'}));
    }
    const v=inspectEvidenceConsistency(rows);
    expect(v.observations).toHaveLength(CONSISTENCY_VIEW_LIMIT);
    expect(v.counts.REFERENCE_REUSE).toBe(CONSISTENCY_VIEW_LIMIT+5);
    expect(v.limited).toBe(true);
  });
  it('retains unaltered text and does not construct links, permissions or approvals',()=>{
    const v=inspectEvidenceConsistency([row('a',{reference:'<test/>',revision:'v1'}),row('b',{reference:'<test/>',revision:'v2'})]);
    expect(v.observations[0]?.reference).toBe('<test/>');
    expect('approved' in (v.observations[0]??{})).toBe(false);
  });
});
