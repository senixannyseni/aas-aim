/** Synthetic test data only. Never imported into the runtime application. */
import type {FfsSnapshot} from "./ffsModel";
export type Mutable<T> = { -readonly [P in keyof T]:T[P] extends readonly (infer U)[]?Mutable<U>[]:T[P] extends object?Mutable<T[P]>:T[P] };
export const T0="2026-01-01T00:00:00Z",T1="2026-01-02T00:00:00Z",T2="2026-01-03T00:00:00Z",T3="2026-01-04T00:00:00Z";
export function ffsFixture():Mutable<FfsSnapshot>{
 return {
 assessments:[
  {id:"ffs-1",code:"TEST-FFS-001",assetId:"asset-1",revision:"r1",title:"Shell thinning assessment",status:"APPROVED",level:"LEVEL_2",methodologyRef:"method-1",procedureRef:"procedure-1",basisRef:"basis-1",createdAt:T0,inputSetId:"set-1",approvalRef:"approval-1",approverRef:"engineer-1",approvedAt:T3},
  {id:"ffs-2",code:"TEST-FFS-002",assetId:"asset-2",revision:"r2",title:"Flaw evaluation pending",status:"DRAFT",level:"LEVEL_1",methodologyRef:"method-2",procedureRef:"procedure-2",basisRef:"basis-2",createdAt:T0,inputSetId:"set-2"}
 ],
 inputSets:[
  {id:"set-1",assessmentId:"ffs-1",revision:"r1",status:"FROZEN",frozenAt:T1,inputs:[{id:"inp-1",kind:"FLAW",sourceRef:"nde-1",sourceRevision:"r3",quality:"VALID"},{id:"inp-2",kind:"MATERIAL",sourceRef:"mat-1",sourceRevision:"r1",quality:"VALID"},{id:"inp-3",kind:"LOAD_CASE",sourceRef:"load-1",sourceRevision:"r2",quality:"VALID"}]},
  {id:"set-2",assessmentId:"ffs-2",revision:"r2",status:"DRAFT",inputs:[{id:"inp-4",kind:"FLAW",sourceRef:"field-2",sourceRevision:"r1",quality:"UNKNOWN"}]}
 ],
 flaws:[{id:"flaw-1",assessmentId:"ffs-1",inputId:"inp-1",kind:"LOCAL_METAL_LOSS",locationRef:"loc-1",characterizationRef:"flaw-basis-1"}],
 results:[
  {id:"res-fit",assessmentId:"ffs-1",revision:"r1",inputSetId:"set-1",kind:"FITNESS",status:"APPROVED",fitnessDecision:"CONDITIONAL",displayValue:"Conditionally acceptable within evaluated envelope",basisRef:"method-1",traceRef:"trace-fit",calculatedAt:T2},
  {id:"res-life",assessmentId:"ffs-1",revision:"r1",inputSetId:"set-1",kind:"REMAINING_LIFE",status:"APPROVED",displayValue:"4.2",unit:"years",basisRef:"ffs-life-1",traceRef:"trace-life",calculatedAt:T2},
  {id:"res-env",assessmentId:"ffs-1",revision:"r1",inputSetId:"set-1",kind:"OPERATING_ENVELOPE",status:"APPROVED",displayValue:"See approved limits",basisRef:"envelope-1",traceRef:"trace-env",calculatedAt:T2}
 ],
 conditions:[{id:"cond-1",assessmentId:"ffs-1",resultId:"res-env",kind:"OPERATING",requirement:"Maintain source-defined operating conditions",acceptanceRef:"criterion-1"},{id:"cond-2",assessmentId:"ffs-1",resultId:"res-life",kind:"MONITORING",requirement:"Perform follow-up inspection",acceptanceRef:"criterion-2",dueCandidateRef:"ffs-due-candidate"}],
 scenarios:[{id:"scenario-1",assessmentId:"ffs-1",basedOnRevision:"r1",title:"Higher operating load",changeSummary:"Alternative pressure envelope",inputBasisRef:"scenario-input-1",evaluatedAt:T3,status:"SCENARIO",results:[{id:"sc-res-1",kind:"FITNESS",displayValue:"Scenario only",basisRef:"scenario-calc-1",status:"SCENARIO"}]}]
 };
}
export function reassessmentFixture():Mutable<FfsSnapshot>{
 const data=ffsFixture();const a=data.assessments[0]!;
 a.status="REASSESSMENT_REQUIRED";a.reassessmentReason="New inspection result triggers review";
 delete a.approvalRef;delete a.approvedAt;delete a.approverRef;
 data.results.forEach(r=>r.status="HISTORICAL_APPROVED");
 return data;
}
