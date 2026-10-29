import type { RecommendationsSnapshot } from "./recommendationsModel";
export const R0="2026-02-10T08:00:00Z",R1="2026-02-11T08:00:00Z",R2="2026-02-12T08:00:00Z",R3="2026-02-13T08:00:00Z",R4="2026-02-14T08:00:00Z",R5="2026-02-15T08:00:00Z";
/** Synthetic records for tests only. Production exports start disconnected. */
export function recommendationsFixture():RecommendationsSnapshot{return {
 recommendations:[{id:"rec-test-1",code:"TEST-REC-001",assetId:"TEST-ASSET-1",revision:"rev-test-1",status:"APPROVED",title:"Synthetic verify repair acceptance",technicalBasisRef:"test-approved-condition-assessment",technicalBasisDomain:"FND",createdAt:R0,priority:"HIGH",technicalDueAt:"2027-06-01T00:00:00Z",approvedAt:R1,approvalBasisRef:"test-recommendation-approval",approvedRevision:"rev-test-1"},{id:"rec-test-2",code:"TEST-REC-002",assetId:"TEST-ASSET-2",revision:"rev-test-2",status:"DRAFT",title:"Synthetic unapproved technical proposal",technicalBasisRef:"test-inspection-finding",technicalBasisDomain:"INS",createdAt:R0,priority:"UNKNOWN"}],
 requirements:[{id:"req-test-1",recommendationId:"rec-test-1",description:"Verify material and repair",acceptanceCriterion:"Document approved NDT and applicable repair standard",sourceBasisRef:"test-criterion-basis-1"},{id:"req-test-2",recommendationId:"rec-test-1",description:"Verify fitness after repair",acceptanceCriterion:"Engineering assessment demonstrates acceptance",sourceBasisRef:"test-criterion-basis-2"}],
 accountability:[{id:"account-test-1",recommendationId:"rec-test-1",ownerRef:"test-repair-lead",accountableRef:"test-integrity-authority",assignedAt:R1}],
 execution:[{id:"exec-test-1",recommendationId:"rec-test-1",kind:"CMMS_WORK",externalRecordRef:"test-cmms-work-1",state:"COMPLETED",updatedAt:R2}],
 fulfillment:[{id:"ful-test-1",recommendationId:"rec-test-1",requirementId:"req-test-1",state:"VERIFIED",assessmentBasisRef:"test-verification-assessment-1",assessedAt:R2,verificationEvidenceRefs:["test-verified-evidence-1"],verifiedAt:R2,reviewerRef:"test-verifier-1"},{id:"ful-test-2",recommendationId:"rec-test-1",requirementId:"req-test-2",state:"PENDING",assessmentBasisRef:"test-verification-pending",assessedAt:R2,verificationEvidenceRefs:[]}],
 closeout:[]
};}
export function closedRecommendationsFixture():RecommendationsSnapshot{
 const v=structuredClone(recommendationsFixture()) as unknown as {recommendations:Array<{status:string}>;fulfillment:Array<{state:string;verifiedAt?:string;reviewerRef?:string;verificationEvidenceRefs:string[]}>;closeout:Array<{id:string;recommendationId:string;recommendationRevision:string;kind:string;decidedAt:string;decisionBasisRef:string;authorityRef:string;verificationEvidenceRefs:string[]}>};
 v.recommendations[0]!.status="CLOSED";
 v.fulfillment[1]={...v.fulfillment[1],state:"VERIFIED",verifiedAt:R3,reviewerRef:"test-verifier-2",verificationEvidenceRefs:["test-verified-evidence-2"]};
 v.closeout.push({id:"close-test-1",recommendationId:"rec-test-1",recommendationRevision:"rev-test-1",kind:"CLOSE",decidedAt:R4,decisionBasisRef:"test-independent-closeout-basis",authorityRef:"test-independent-closer",verificationEvidenceRefs:["test-closure-evidence"]});
 return v as unknown as RecommendationsSnapshot;
}
