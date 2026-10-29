/** Synthetic fixtures used exclusively by inspection tests. No production data. */
import type { InspectionSnapshot } from "./inspectionModel";
export const T0="2026-03-01T00:00:00Z";
export const T1="2026-04-01T00:00:00Z";
export const T2="2026-08-01T00:00:00Z";
export function inspectionFixture():InspectionSnapshot {
  return {
    requirements:[{id:"req-test-1",code:"TEST-REQ-001",assetId:"TEST-ASSET-1",revision:"1",status:"APPROVED",basisReference:"test-ins-basis",scope:"Test external vessel",technique:"Test UT",requiredCoveragePercent:80,requiredEffectiveness:"HIGH",recurrence:"Test periodic assessment",approvedAt:T0}],
    candidates:[
      {id:"cand-cor",requirementId:"req-test-1",source:"COR",dueAt:T2,basisReference:"test-cor-basis"},
      {id:"cand-rbi",requirementId:"req-test-1",source:"RBI",dueAt:T2,basisReference:"test-rbi-basis"},
      {id:"cand-ffs",requirementId:"req-test-1",source:"FFS",dueAt:T2,basisReference:"test-ffs-basis"},
    ],
    dueDecisions:[{id:"due-test-1",requirementId:"req-test-1",technicalDueAt:T1,determinedAt:T0,basisReference:"test-ins016-decision",consideredCandidateIds:["cand-cor","cand-rbi","cand-ffs"]}],
    plans:[{id:"plan-test-1",code:"TEST-PLAN-1",revision:"1",status:"RELEASED",requirementIds:["req-test-1"],plannedStart:T0,plannedEnd:T1,basisReference:"test-planning-basis"}],
    workpacks:[{id:"wp-test-1",planId:"plan-test-1",code:"TEST-WP-1",revision:"1",status:"RELEASED",requirementIds:["req-test-1"],assignedResource:"Test qualified inspector",qualificationReference:"test-qualification",scopeReference:"test-wp-scope",releasedAt:T0}],
    events:[{id:"evt-test-1",workpackId:"wp-test-1",requirementId:"req-test-1",eventAt:T1,status:"FIELD_COMPLETE",technique:"Test UT",achievedCoveragePercent:65,evidenceReferences:["test-evidence-1"],resultReference:"test-result"}],
    reviews:[{id:"review-test-1",eventId:"evt-test-1",requirementId:"req-test-1",status:"APPROVED",achievedCoveragePercent:65,achievedEffectiveness:"MEDIUM",credit:"PARTIAL",residualObligation:"Test follow-up coverage outstanding",basisReference:"test-review-basis",reviewedAt:T2,creditBasisReference:"test-credit-basis",creditGrantedAt:T2}],
  };
}
