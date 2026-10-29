/** Synthetic test-only RBI records; never imported by the production frontend. */
import type { RbiSnapshot } from "./rbiModel";
export const T0="2026-03-01T00:00:00Z";
export const T1="2026-04-01T00:00:00Z";
export const T2="2027-01-01T00:00:00Z";
export function rbiFixture():RbiSnapshot{return {
 assessments:[{id:"rbi-test-1",code:"TEST-RBI-001",assetId:"TEST-EQUIPMENT-1",revision:"3",status:"APPROVED",methodology:"TEST-METHOD-V1",basisReference:"test-methodology-basis",inputSetId:"inputs-test-1",quality:"VALID",assessedAt:T0,approvedAt:T1,approvalBasisReference:"test-review-basis"}],
 inputSets:[{id:"inputs-test-1",assessmentId:"rbi-test-1",revision:"3",status:"FROZEN",frozenAt:T0,inputs:[{id:"input-dgm",category:"DEGRADATION",sourceReference:"test-dgm-reference",quality:"VALID",recordRevision:"2"},{id:"input-ins",category:"INSPECTION",sourceReference:"test-ins-credit-reference",quality:"STALE",recordRevision:"1"}]}],
 results:[
  {id:"res-pof",assessmentId:"rbi-test-1",inputSetId:"inputs-test-1",kind:"POF",displayValue:"0.0012",unit:"per year",basisReference:"test-pof-trace",calculatedAt:T1,state:"APPROVED"},
  {id:"res-cof",assessmentId:"rbi-test-1",inputSetId:"inputs-test-1",kind:"COF",displayValue:"800000",unit:"USD",basisReference:"test-cof-trace",calculatedAt:T1,state:"APPROVED"},
  {id:"res-current",assessmentId:"rbi-test-1",inputSetId:"inputs-test-1",kind:"CURRENT_RISK",displayValue:"HIGH",unit:"qualitative",basisReference:"test-current-risk-trace",calculatedAt:T1,state:"APPROVED"},
  {id:"res-future",assessmentId:"rbi-test-1",inputSetId:"inputs-test-1",kind:"FUTURE_RISK",displayValue:"CRITICAL",unit:"qualitative",basisReference:"test-future-risk-trace",calculatedAt:T1,state:"PROJECTED"},
  {id:"res-due",assessmentId:"rbi-test-1",inputSetId:"inputs-test-1",kind:"DUE_CANDIDATE",displayValue:T2,unit:"ISO-8601",basisReference:"test-rbi13-candidate",calculatedAt:T1,state:"APPROVED"},
 ],
 strategies:[{id:"strategy-test-1",assessmentId:"rbi-test-1",status:"APPROVED",inspectionTechnique:"TEST-UT",targetEffectiveness:"HIGH",targetCoveragePercent:85,basisReference:"test-strategy-basis",dueCandidateResultId:"res-due",approvedAt:T1}],
 scenarios:[{id:"scenario-test-1",assessmentId:"rbi-test-1",title:"Test inspection sensitivity",basedOnRevision:"3",changeSummary:"Synthetic change to inspection assumption",status:"SCENARIO",evaluatedAt:T2,results:[{id:"scenario-result-1",kind:"FUTURE_RISK",displayValue:"LOW",unit:"qualitative",basisReference:"synthetic-scenario-basis"}]}],
};}
