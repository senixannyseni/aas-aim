import type {ActionsSnapshot} from "./actionsModel";
export const T0="2026-01-01T00:00:00Z",T1="2026-01-02T00:00:00Z",T2="2026-01-03T00:00:00Z",T3="2026-01-04T00:00:00Z",T4="2026-01-05T00:00:00Z",T5="2026-01-06T00:00:00Z",DUET="2026-03-01T00:00:00Z",EXT="2026-04-01T00:00:00Z",AUTH="2026-03-20T00:00:00Z";
/** Test-only synthetic records, never used by runtime or injected into a production UI. */
export function actionsFixture():ActionsSnapshot{return {
 actions:[
  {id:"act-test-1",code:"TEST-ACT-001",assetId:"TEST-EQUIP-1",revision:"rev-1",kind:"TEMPORARY_REPAIR",state:"WORK_COMPLETE",title:"Synthetic temporary repair scope",technicalBasisRef:"test-engineering-source",createdAt:T0,ownerRef:"test-owner",technicalDueAt:DUET,approvedPlanRef:"plan-test-1"},
  {id:"act-test-2",code:"TEST-ACT-002",assetId:"TEST-EQUIP-2",revision:"rev-1",kind:"TEMPORARY_CONTROL",state:"PLANNED",title:"Synthetic monitoring control",technicalBasisRef:"test-technical-review",createdAt:T0,ownerRef:"test-other-owner"}
 ],
 repairs:[{id:"repair-test-1",actionId:"act-test-1",kind:"TEMPORARY",state:"INSTALLED",specificationRef:"test-temp-repair-spec",sourceEvidenceRefs:["test-repair-photo"],installedAt:T2,expiresAt:EXT,limitationsRef:"test-operating-constraints"}],
 controls:[{id:"control-test-1",actionId:"act-test-2",description:"Synthetic compensating control",state:"PROPOSED",basisRef:"test-control-basis",monitoringRef:"test-monitor",effectiveness:"UNKNOWN",expiresAt:EXT}],
 plans:[{id:"plan-test-1",actionId:"act-test-1",revision:"plan-rev-1",state:"RELEASED",scopeRef:"test-workpack",createdAt:T0,releasedAt:T1,releaseAuthorityRef:"test-plan-authority",releaseBasisRef:"test-plan-basis"}],
 evidence:[{id:"evidence-test-1",actionId:"act-test-1",planId:"plan-test-1",recordedAt:T3,sourceRef:"test-field-evidence",evidenceRefs:["test-photo-1"],workCompletedAt:T3}],
 verifications:[{id:"verify-test-1",actionId:"act-test-1",planId:"plan-test-1",state:"PENDING",reviewedAt:T4,reviewerRef:"test-integrity-reviewer",technicalBasisRef:"test-verification-basis",evidenceRefs:[]}],
 externalWork:[{id:"work-test-1",actionId:"act-test-1",systemRef:"test-cmms",externalWorkId:"test-work-100",state:"COMPLETED",updatedAt:T3}],
 deferrals:[{id:"def-test-1",code:"TEST-DEF-001",assetId:"TEST-EQUIP-1",actionId:"act-test-1",revision:"def-rev-1",state:"REQUESTED",technicalDueAt:DUET,requestedUntil:EXT,requestBasisRef:"test-deferral-request",requestedAt:T2}],
 assessments:[{id:"assessment-test-1",deferralId:"def-test-1",state:"PENDING",riskBasisRef:"test-risk-review",compensatingMeasureRefs:[]}],
 decisions:[]
};}
export function authorizedFixture():ActionsSnapshot{
 const x=structuredClone(actionsFixture()) as Mutable<ActionsSnapshot>;
 x.deferrals[0]!.state="AUTHORIZED";x.deferrals[0]!.authorizedUntil=AUTH;x.deferrals[0]!.authorizationRef="decision-test-1";
 x.assessments[0]!.state="ASSESSED";x.assessments[0]!.compensatingMeasureRefs=["test-monitoring-measure"];x.assessments[0]!.assessedAt=T3;x.assessments[0]!.assessorRef="test-deferral-assessor";
 x.decisions.push({id:"decision-test-1",deferralId:"def-test-1",revision:"def-rev-1",kind:"AUTHORIZE",decidedAt:T4,authorityRef:"test-deferral-authority",decisionBasisRef:"test-authorized-risk-basis",assessmentId:"assessment-test-1",authorizedUntil:AUTH});
 return x;
}
export type Mutable<T>=T extends readonly (infer U)[]?Mutable<U>[]:T extends object?{-readonly [K in keyof T]:Mutable<T[K]>}:T;
