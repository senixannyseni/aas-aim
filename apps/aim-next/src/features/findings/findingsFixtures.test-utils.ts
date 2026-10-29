/** Synthetic, test-only records. Never loaded into production screens. */
import type { FindingsSnapshot } from "./findingsModel";
export const F0="2026-03-01T00:00:00Z";
export const F1="2026-04-01T00:00:00Z";
export const F2="2026-05-01T00:00:00Z";
export function findingsFixture():FindingsSnapshot{return {
 findings:[
  {id:"finding-test-1",code:"TEST-FND-001",assetId:"TEST-ASSET-1",componentId:"TEST-COMPONENT-1",sourceRecordRef:"test-inspection-source",observedAt:F0,severity:"HIGH",status:"VALIDATED",description:"Synthetic localized loss of thickness",location:"TEST NOZZLE",evidenceRefs:["test-evidence-1"],validatedAt:F1,validationBasisRef:"test-validation-review"},
  {id:"finding-test-2",code:"TEST-FND-002",assetId:"TEST-ASSET-2",sourceRecordRef:"test-field-source",observedAt:F0,severity:"UNKNOWN",status:"TRIAGE_PENDING",description:"Synthetic field observation awaiting technical review",evidenceRefs:[]},
 ],
 cases:[{id:"case-test-1",code:"TEST-ICC-001",assetId:"TEST-ASSET-1",status:"MONITORING",summary:"Synthetic condition assessment with controlled follow-up",openedAt:F1,findingIds:["finding-test-1"],assessmentId:"assessment-test-1",dispositionId:"disposition-test-1",recommendationRefs:["test-recommendation-1"],actionRefs:["test-action-1"]}],
 assessments:[{id:"assessment-test-1",caseId:"case-test-1",revision:"2",status:"APPROVED",significance:"Localized damage requiring monitoring",risk:"HIGH",evidenceRefs:["test-evidence-1"],basisRef:"test-condition-basis",assessedAt:F1,approvedAt:F2,approvalBasisRef:"test-engineering-approval"}],
 dispositions:[{id:"disposition-test-1",caseId:"case-test-1",assessmentId:"assessment-test-1",kind:"MONITOR",status:"AUTHORIZED",decisionBasisRef:"test-disposition-basis",authorizedAt:F2}],
 monitoring:[{id:"monitor-test-1",caseId:"case-test-1",observedAt:F2,sourceRef:"test-monitor-evidence",status:"ACTIVE",note:"Synthetic monitored condition"}],
};}
