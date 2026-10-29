import {describe,expect,it} from 'vitest';
import {traceIndexedEvidence,TRACE_PEER_LIMIT} from './evidenceTrace';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
const evidence=(key:string,overrides:Partial<EngineeringEvidence>={}):EngineeringEvidence=>({
  key,domain:'COR',kind:'Calculation trace',sourceRecordId:key,ownerRecordId:'C1',
  reference:`REF-${key}`,supportingReference:null,revision:null,
  reportedAt:null,status:'DRAFT',authority:'SOURCE_REFERENCE',...overrides,
});
describe('Phase 46.17 trace navigation',()=>{
  it('requires a selected entry in the supplied index',()=>{
    expect(traceIndexedEvidence([],null)).toBeNull();
    expect(traceIndexedEvidence([evidence('A')],'WITHDRAWN')).toBeNull();
  });
  it('never crosses a domain or owning-record boundary even on exact text',()=>{
    const anchor=evidence('A',{reference:'REPORT',supportingReference:'BASIS'});
    const entries=[anchor,evidence('B',{reference:'BASIS'}),evidence('C',{domain:'INS',reference:'BASIS'}),
      evidence('D',{ownerRecordId:'C2',reference:'BASIS'})];
    const trace=traceIndexedEvidence(entries,'A')!;
    expect(trace.reportedSupportTextMatches.entries.map(x=>x.key)).toEqual(['B']);
    expect(trace.owningRecordContext.entries.map(x=>x.key)).toEqual(['B']);
  });
  it('distinguishes same source-record ID and reverse reported text from verified links',()=>{
    const entries=[evidence('A',{sourceRecordId:'CAL',reference:'CAL-REF'}),
      evidence('B',{sourceRecordId:'CAL',reference:'SECONDARY'}),
      evidence('C',{supportingReference:'CAL-REF'})];
    const trace=traceIndexedEvidence(entries,'A')!;
    expect(trace.sameSourceRecord.entries.map(x=>x.key)).toEqual(['B']);
    expect(trace.incomingReportedTextMatches.entries.map(x=>x.key)).toEqual(['C']);
    expect(Object.hasOwn(trace,'approved')).toBe(false);
    expect(Object.hasOwn(trace,'url')).toBe(false);
  });
  it('bounds peers while retaining indexed counts',()=>{
    const entries=[evidence('A'),...Array.from({length:33},(_,i)=>evidence(`P${i}`))];
    const trace=traceIndexedEvidence(entries,'A')!;
    expect(trace.owningRecordContext.entries).toHaveLength(TRACE_PEER_LIMIT);
    expect(trace.owningRecordContext.indexedCount).toBe(33);
    expect(trace.owningRecordContext.limited).toBe(true);
  });
  it('does not treat absent supporting text as an association',()=>{
    const trace=traceIndexedEvidence([evidence('A'),evidence('B')],'A')!;
    expect(trace.reportedSupportTextMatches.indexedCount).toBe(0);
    expect(trace.incomingReportedTextMatches.indexedCount).toBe(0);
  });
  it('deduplicates repeated indexed keys without changing entry provenance',()=>{
    const anchor=evidence('A');const duplicate=evidence('B');
    const trace=traceIndexedEvidence([anchor,duplicate,duplicate],'A')!;
    expect(trace.owningRecordContext.indexedCount).toBe(1);
    expect(trace.anchor).toBe(anchor);
  });
});
