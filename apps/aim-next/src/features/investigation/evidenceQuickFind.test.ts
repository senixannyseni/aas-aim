import {describe,expect,it} from 'vitest';
import {filterIndexedEvidence,evidencePosition,EVIDENCE_QUERY_LIMIT} from './evidenceQuickFind';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
const a:EngineeringEvidence={key:'C1',domain:'COR',kind:'Calculation trace',ownerRecordId:'COR-101',sourceRecordId:'S1',reference:'TRACE-111',revision:'r2',status:'DRAFT',reportedAt:'2026-01-20T09:00:00Z',supportingReference:'BASE-20',authority:'SOURCE_REFERENCE'};
const b:EngineeringEvidence={...a,key:'C2',sourceRecordId:'S2',reference:'THK-202',kind:'Thickness reading',status:'RECORDED'};
const c:EngineeringEvidence={...a,key:'I1',domain:'INS',ownerRecordId:'INS-201',sourceRecordId:'S9',reference:'PLAN-201',revision:null,status:'REVIEW',supportingReference:null,kind:'Inspection plan',authority:'TECHNICAL_REVIEW'};
const items=[a,b,c];
describe('Phase 46.25 local authorized evidence quick-find',()=>{
 it('does not mutate or copy the visible index when blank',()=>expect(filterIndexedEvidence(items,'')).toBe(items));
 it('searches normalized references and IDs',()=>{expect(filterIndexedEvidence(items,' trace-111 ')).toEqual([a]);expect(filterIndexedEvidence(items,'ins-201 PLAN')).toEqual([c]);});
 it('requires all terms without a cross-record inference',()=>expect(filterIndexedEvidence(items,'COR-101 THK')).toEqual([b]));
 it('allows supporting reference within a single record',()=>expect(filterIndexedEvidence(items,'base-20 CALC')).toEqual([a]));
 it('does not use untrusted timestamps as authority evidence',()=>expect(filterIndexedEvidence(items,'2026-01-20')).toEqual([]));
 it('tolerates mixed unicode width case',()=>expect(filterIndexedEvidence(items,'ｔｒａｃｅ-111')).toEqual([a]));
 it('bounds query length',()=>expect(filterIndexedEvidence(items,'x'.repeat(EVIDENCE_QUERY_LIMIT+100))).toEqual([]));
 it('returns only currently supplied indexed entries',()=>expect(filterIndexedEvidence([c],'TRACE')).toEqual([]));
 it('navigates adjacent result keys only',()=>{expect(evidencePosition(items,'C2')).toEqual({index:1,count:3,previousKey:'C1',nextKey:'I1'});expect(evidencePosition([a,c],'I1')?.previousKey).toBe('C1');});
 it('rejects missing and withdrawn keys',()=>{expect(evidencePosition([c],'C1')).toBeNull();expect(evidencePosition(items,'unindexed')).toBeNull();expect(evidencePosition(items,null)).toBeNull();});
});
