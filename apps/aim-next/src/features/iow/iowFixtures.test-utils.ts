/** Synthetic fixture records: tests only. Not operational engineering assets. */
import type {IowSnapshot} from "./iowModel";
export const T0="2026-01-01T00:00:00Z",T1="2026-01-02T00:00:00Z",T2="2026-01-03T00:00:00Z",T3="2026-01-04T00:00:00Z";
export function iowFixture():IowSnapshot{return {
 definitions:[
  {id:"iow-a",code:"TEST-IOW-A",assetId:"test-equipment-a",revision:"r1",title:"Synthetic reactor temperature",classification:"CRITICAL",state:"APPROVED",basisRef:"test-limit-basis",createdAt:T0,approvedRef:"test-definition-approval",approvedAt:T1,approverRef:"test-reviewer"},
  {id:"iow-b",code:"TEST-IOW-B",assetId:"test-equipment-b",revision:"r1",title:"Synthetic flow window",classification:"STANDARD",state:"DRAFT",basisRef:"test-flow-basis",createdAt:T0}
 ],
 limits:[{id:"limit-a",iowId:"iow-a",revision:"r1",variableRef:"temperature",unit:"C",ruleRef:"test-alarm-logic",lower:50,upper:120},{id:"limit-b",iowId:"iow-b",revision:"r1",variableRef:"flow",unit:"m3/h",ruleRef:"test-flow-limit",upper:600}],
 sources:[{id:"src-a",iowId:"iow-a",variableRef:"temperature",kind:"HISTORIAN",state:"DEGRADED",systemRef:"test-historian",mappingRef:"test-tag-1",lastReceivedAt:T2},{id:"src-b",iowId:"iow-b",variableRef:"flow",kind:"MANUAL",state:"UNKNOWN",systemRef:"test-operator-input",mappingRef:"test-flow-field"}],
 links:[{id:"link-a",iowId:"iow-a",assetId:"test-equipment-a",mechanismRef:"test-degradation",barrierRef:"test-barrier"}],
 quality:[{id:"quality-a",sourceId:"src-a",state:"STALE",assessedAt:T3,basisRef:"test-quality-review",lastValidAt:T1}],
 samples:[{id:"sample-a",iowId:"iow-a",sourceId:"src-a",observedAt:T1,state:"VALID",value:88,evidenceRef:"test-reading-proof"},{id:"sample-missing",iowId:"iow-a",sourceId:"src-a",observedAt:T3,state:"MISSING",value:null,evidenceRef:"test-missing-reason"}],
 excursions:[{id:"exc-a",code:"TEST-EXC-A",iowId:"iow-a",sourceId:"src-a",revision:"r1",state:"PROCESS_RECOVERED",openedAt:T1,detectedAt:T2,eventSourceRef:"test-alarm-event",sampleId:"sample-a",processRecoveredAt:T3}],
 dispositions:[],followUps:[]
};}
export function disposedFixture():IowSnapshot{const x=structuredClone(iowFixture());return {...x,excursions:[{...x.excursions[0]!,state:"DISPOSITIONED",dispositionRef:"disposition-a"}],dispositions:[{id:"disposition-a",excursionId:"exc-a",revision:"r1",decision:"CONFIRMED",reviewerRef:"test-senior-engineer",reviewedAt:T3,technicalBasisRef:"test-engineering-review",evidenceRefs:["test-inspection-proof"]}],followUps:[{id:"follow-a",excursionId:"exc-a",owningDomain:"FND",objectRef:"test-ICC-link",basisRef:"test-followup-basis"}]};}
export type Mutable<T> = {-readonly [P in keyof T]:T[P] extends readonly (infer U)[]?Mutable<U>[]:T[P] extends object?Mutable<T[P]>:T[P]};
