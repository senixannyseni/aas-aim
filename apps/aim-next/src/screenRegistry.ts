/** AIM Master Architecture Specification v1.0 — Artifact 6.
 * Screen IDs, labels, function links, and known object links are traceability metadata,
 * not a browser-enforced authorization policy or a domain API contract.
 */
import { CAPABILITY_BY_ID, DOMAINS, SCREEN_COUNTS, type DomainCode } from "./capabilityRegistry";

export type ScreenDomain = DomainCode | "GLB" | "HOM";
export type ScreenSurface = "workspace" | "register" | "review" | "analysis" | "context" | "configuration" | "field";
export type ScreenDefinition = Readonly<{
  id: string;
  domain: ScreenDomain;
  title: string;
  surface: ScreenSurface;
  functionIds: readonly string[];
  objects: readonly string[];
  protectedFunctions: readonly string[];
  notes?: string;
}>;

type ScreenRow = readonly [id:string, title:string, surface:ScreenSurface, functions:string, objects:string, notes?:string];
/** Compact registry notation. Ranges are inclusive, never expand retired VIS IDs. */
function expandFunctions(spec:string):readonly string[] {
  return Object.freeze(spec.split(/\s+/).filter(Boolean).flatMap(part=>{
    const m=/^([A-Z]{3})-(\d{3})(?:\.\.(\d{3}))?$/.exec(part);
    if (!m) throw new Error(`Invalid screen-function notation: ${part}`);
    const prefix=m[1]!;
    const from=Number(m[2]); const to=m[3] ? Number(m[3]) : from;
    if (to<from || to-from>50) throw new Error(`Invalid screen-function range: ${part}`);
    return Array.from({length:to-from+1},(_,i)=>`${prefix}-${String(from+i).padStart(3,"0")}`);
  }).filter((id,i,arr)=>arr.indexOf(id)===i));
}
const rows:readonly ScreenRow[] = [
  ["SCR-GLB-001","AIM Application Shell","workspace","GOV-001 GOV-002 GOV-003 GOV-009 GOV-010 GOV-012","Principal; Tenant; ScopeGrant; Notification; AssetObject reference","The shell composes navigation; it never owns domain records."],
  ["SCR-HOM-001","Enterprise Overview","analysis","ANA-001 ANA-009 GOV-003","AnalyticsProjection; AnalyticsMetricExecution; AnalyticsQualityAssessment","Analytics is read-only and must label projections and data quality."],
  ["SCR-HOM-002","My Work / Team Attention","analysis","ANA-002","Owning-domain review, approval, reassessment and obligation references","Queue cards navigate to owning-domain decisions; no dashboard approval."],
  ["SCR-HOM-003","Universal Search","register","GOV-012","Scoped record references","Server-side scope must be enforced before returning even search metadata."],
  ["SCR-AIR-001","Asset Register","register","AIR-002 AIR-003 AIR-004 AIR-005 AIR-008","Equipment; Component; AssetClassification; AssetAttribute; AssetLifecycleRecord"],
  ["SCR-AIR-002","Asset Hierarchy","context","AIR-001 AIR-006 AIR-007","AssetStructureMembership; FunctionalLocation; System; AssetRelationship"],
  ["SCR-AIR-003","Asset Workspace","workspace","AIR-002..009 AIR-011","AssetObject; Component; Domain-linked owning records","Composition only; cross-domain tabs must call the owning domain."],
  ["SCR-AIR-004","Asset Master Edit","workspace","AIR-002 AIR-003 AIR-004 AIR-005 AIR-008","Equipment; Component; AssetAttribute; AssetLifecycleRecord","Physical replacement does not overwrite the previous asset identity."],
  ["SCR-AIR-005","Asset Import & Validation","review","AIR-010 INT-008 INT-009 INT-010","AssetImportBatch; IntegrationContract; ExternalObjectMapping; IntegrationConflict","Import stages and validates. Missing source rows never silently retire assets."],
  ["SCR-AIR-006","Relationship Explorer","context","AIR-011 AIR-007","AssetRelationship; AssetObject","Graph relationships require source records; visualization infers no authoritative relationship."],
  ["SCR-DGM-001","Degradation Assessment Workspace","review","DGM-001..012","DegradationAssessment; MechanismApplicability; SusceptibilityAssessment; BarrierDefinition; BarrierInstance; BarrierAssessment; BarrierHealthRecord"],
  ["SCR-DGM-002","Degradation Mechanism Library","configuration","DGM-001 DGM-007 DGM-008 DGM-011 GOV-008","DegradationMechanismDefinition; ApplicabilityFactorDefinition; TechniqueCapabilityDefinition; BarrierVerificationCriterion; ConfigurationPackage"],
  ["SCR-COR-001","Corrosion Loop & Circuit Workspace","workspace","COR-001 COR-002 COR-021","CorrosionLoop; CorrosionCircuit; CorrosionRateResult"],
  ["SCR-COR-002","Monitoring Locations / CML / MP","register","COR-003 COR-004 COR-019","MonitoringLocation; MeasurementPoint; ThicknessMeasurementSet"],
  ["SCR-COR-003","Thickness History","analysis","COR-005 COR-007 COR-008 COR-009 COR-019","ThicknessReading; ReadingValidation; MeasurementAnomaly; AnomalyDisposition"],
  ["SCR-COR-004","Corrosion Calculation Workspace","review","COR-010..018 COR-021 COR-022","CorrosionCalculationSet; CorrosionRateResult; ProjectedLimitResult; CorrosionDueCandidate","COR-015 publishes a due candidate; INS-016 determines the governing technical due date."],
  ["SCR-COR-005","Tmin Management","configuration","COR-020","MinimumRequiredThickness","Changes produce versioned engineering basis; historical calculations remain immutable."],
  ["SCR-COR-006","Corrosion Bulk Import","review","COR-006 COR-007 INT-008","ThicknessMeasurementSet; IntegrationJob","Imported measurements remain staged until validated."],
  ["SCR-INS-001","Inspection Requirements List","register","INS-001 INS-002 INS-015 INS-016 INS-017","InspectionRequirement; InspectionRecurrence; GoverningInspectionDue"],
  ["SCR-INS-002","Inspection Requirement Workspace","review","INS-001..005 INS-015 INS-016 INS-017","InspectionRequirement; InspectionRecurrence; GoverningInspectionDue","Due candidates from COR/RBI/FFS are not governing due dates."],
  ["SCR-INS-003","Inspection Planning Board","workspace","INS-006 ANA-010","InspectionPlan; InspectionRequirement references","Scheduling work cannot change technical due dates."],
  ["SCR-INS-004","Workpack Workspace","review","INS-007 INS-008 INS-018","InspectionWorkpack; WorkpackAssignment; Personnel / Resource qualification references"],
  ["SCR-INS-005","Inspection Events","workspace","INS-009 INS-010 INS-014","InspectionEvent; InspectionResult; Evidence links","A completed inspection event does not automatically grant inspection credit."],
  ["SCR-INS-006","Inspection Technical Review","review","INS-011 INS-012 INS-013 INS-019 INS-020","InspectionTechnicalReview; AchievedInspectionPerformance; InspectionCredit; ResidualInspectionObligation","Keep work completion, technical review, achieved scope and granted credit separate."],
  ["SCR-RBI-001","RBI Assessment Register","register","RBI-001 RBI-018 RBI-019","RBIAssessment; RBI approval/reassessment references"],
  ["SCR-RBI-002","RBI Assessment Workspace","review","RBI-001..019","RBIAssessment; FrozenInputSet; CurrentRiskProjection; RiskResult; RBIInspectionDueCandidate","Approved risk and current/future projections must remain distinct."],
  ["SCR-RBI-003","RBI Scenario Workspace","analysis","RBI-016","RBIScenario","All outputs are SCENARIO and NON-AUTHORITATIVE."],
  ["SCR-FND-001","Findings Register","register","FND-001..004","Finding; FindingContext; FindingValidation"],
  ["SCR-FND-002","Finding Triage","review","FND-002..005","Finding; FindingValidation; IntegrityConditionCase"],
  ["SCR-FND-003","Integrity Condition Case Workspace","review","FND-005..011","IntegrityConditionCase; ConditionEvidenceLink; ConditionAssessment; ConditionDisposition; ConditionMonitoringRecord","An ICC is not a Recommendation, and closure requires protected domain action."],
  ["SCR-REC-001","Recommendation Register","register","REC-001 REC-003 REC-004 REC-007","Recommendation; RecommendationAccountability"],
  ["SCR-REC-002","Recommendation Workspace","review","REC-001..010","Recommendation; RecommendationBasisReference; RecommendationRequirement; RecommendationAcceptanceCriterion; RecommendationAccountability; RecommendationFulfillmentAssessment","External work completion cannot automatically close a recommendation."],
  ["SCR-ACT-001","Integrity Actions Register","register","ACT-001..004 ACT-009 ACT-012 ACT-013","IntegrityAction; TemporaryRepair; PermanentRepair; TemporaryControl"],
  ["SCR-ACT-002","Integrity Action Workspace","review","ACT-001..004 ACT-008..013","IntegrityAction; TemporaryRepair; PermanentRepair; TemporaryControl; ActionExecutionPlan; ActionExecutionEvidence; ActionVerification; ExternalWorkReference"],
  ["SCR-ACT-003","Deferral Register","register","ACT-005 ACT-006 ACT-007 ACT-009","DeferralRequest; DeferralAssessment; DeferralAuthorization"],
  ["SCR-ACT-004","Deferral Assessment & Approval","review","ACT-005..007","DeferralRequest; DeferralAssessment; DeferralAuthorization","Distinguish original technical due date, requested extension and authorized deadline."],
  ["SCR-IOW-001","IOW Register","register","IOW-001 IOW-009 IOW-010","IOWDefinition; IOWMonitoringQualityAssessment"],
  ["SCR-IOW-002","IOW Definition Workspace","review","IOW-001..005 IOW-009","IOWDefinition; IOWLimitSet; IOWSourceReference; DerivedIOWVariableDefinition; IOWAssetLink; IOWMechanismLink; IOWBarrierLink"],
  ["SCR-IOW-003","IOW Monitoring / Excursions","analysis","IOW-006 IOW-008 IOW-010","IOWSignal; IOWExcursion; IOWMonitoringQualityAssessment","An absent historian signal must not be interpreted as compliant."],
  ["SCR-IOW-004","IOW Excursion Review","review","IOW-007 IOW-011","IOWDisposition; IOWFollowUp","Process recovery and engineering disposition are separate."],
  ["SCR-FFS-001","FFS Assessment Register","register","FFS-001 FFS-010 FFS-011","FFSAssessment; Reassessment references"],
  ["SCR-FFS-002","FFS Assessment Workspace","review","FFS-001..011","FFSAssessment; FlawCharacterization; FFSInputSet; FFSCalculationTrace; FFSRemainingLife","FFS remaining life and corrosion remaining life must not be conflated."],
  ["SCR-FFS-003","FFS Scenario / Sensitivity","analysis","FFS-008","FFSScenario","Scenario results cannot become approved FFS results without controlled assessment."],
  ["SCR-ANA-001","Risk Analytics","analysis","ANA-003","RBI RiskResult; FutureRiskProfile"],
  ["SCR-ANA-002","Corrosion & Remaining-Life Analytics","analysis","ANA-004 ANA-005","COR results; FFS remaining-life results","COR and FFS remaining-life values are separate data series."],
  ["SCR-ANA-003","Obligation / Performance Analytics","analysis","ANA-006 ANA-007","Inspection obligations; Integrity actions; Bad-actor ranking","Rankings must be explainable and method-versioned."],
  ["SCR-ANA-004","Data Confidence","analysis","ANA-009","AnalyticsQualityAssessment"],
  ["SCR-ANA-005","Forward Exposure & Workload","analysis","ANA-010","AnalyticsProjection; Obligation references","Forecast work cannot change technical due dates."],
  ["SCR-ANA-006","Reports / Query Builder","analysis","ANA-008","SavedQuery; ReportDefinition; ReportExecution","Use governed semantic models; never unrestricted SQL."],
  ["SCR-VIS-001","P&ID Viewer","context","VIS-003 VIS-007 VIS-008","VisualSource; VisualSourceRevision; VisualObjectMapping"],
  ["SCR-VIS-002","2D Drawing Viewer","context","VIS-004 VIS-007 VIS-008 GOV-013","VisualSource; VisualObjectMapping; EvidenceArtifact"],
  ["SCR-VIS-003","3D Model Viewer","context","VIS-005 VIS-007 VIS-008","VisualSource; VisualModelAlignment; VisualObjectMapping"],
  ["SCR-VIS-004","GIS / Map Viewer","context","VIS-006 VIS-007 VIS-008","VisualSource; VisualObjectMapping"],
  ["SCR-VIS-005","Overlay Controls","context","VIS-007","OverlayDefinition; OverlayStyleDefinition","Visually distinguish approved, projected, scenario, unknown and stale overlays."],
  ["SCR-VIS-006","Visual Mapping & Alignment Admin","review","VIS-008","VisualObjectMapping; VisualModelAlignment","Visual mapping approval never mutates AIR/COR/RBI source objects."],
  ["SCR-FLD-001","My Field Work","field","FLD-001","FieldWorkpackPackage"],
  ["SCR-FLD-002","Field Workpack Context","field","FLD-002 FLD-009","OfflineAssetContext; FieldIdentityConfirmation"],
  ["SCR-FLD-003","Field Capture","field","FLD-003..006","FieldMeasurement; ChecklistExecution; FieldEvidenceCapture; FieldFindingDraft","Field completion is not inspection approval."],
  ["SCR-FLD-004","Field Sync Status","field","FLD-007","OfflineSyncBatch; OfflineSyncItem; ClientServerIdentityMap"],
  ["SCR-FLD-005","Field Conflict Resolution","field","FLD-008","SyncConflict","Controlled data cannot use last-write-wins conflict resolution."],
  ["SCR-GOV-001","Users / Principals","configuration","GOV-001 GOV-010","Principal; UserPrincipal; ServicePrincipal"],
  ["SCR-GOV-002","Access Profiles & Capabilities","configuration","GOV-002","AccessProfile; Capability"],
  ["SCR-GOV-003","Scope Administration","configuration","GOV-003","ScopeGrant"],
  ["SCR-GOV-004","Approval Authority & Delegation","configuration","GOV-004","ApprovalAuthority; Delegation","Administrative access is not engineering approval authority."],
  ["SCR-GOV-005","Workflow / State Policy","configuration","GOV-005","WorkflowPolicy; StatePolicy"],
  ["SCR-GOV-006","Audit Explorer","register","GOV-006","AuditEvent"],
  ["SCR-GOV-007","Revision History","register","GOV-007","RecordRevision"],
  ["SCR-GOV-008","Controlled Methodology Packages","review","GOV-008","MethodologyPackage; ConfigurationPackage"],
  ["SCR-GOV-009","Notification / Escalation Rules","configuration","GOV-009","Notification; Escalation policy/configuration"],
  ["SCR-GOV-010","Evidence Library","register","GOV-013","EvidenceArtifact; EvidenceLink"],
  ["SCR-GOV-011","Retention / Legal Hold","configuration","GOV-011","RetentionPolicy; LegalHold"],
  ["SCR-GOV-012","AI Policy & Provenance","configuration","GOV-014","AIPolicy; AIExecutionProvenance","AI is advisory and cannot execute controlled approvals."],
  ["SCR-INT-001","Systems & Connectors","configuration","INT-001..005","ExternalSystem; IntegrationConnector"],
  ["SCR-INT-002","API & Event Integration","configuration","INT-006 INT-007","API contract references; Event/webhook contract configuration"],
  ["SCR-INT-003","Bulk Exchange / Migration","review","INT-008","IntegrationJob; Migration manifest/batch","Import cannot manufacture domain approvals."],
  ["SCR-INT-004","Integration Contracts & Mapping","configuration","INT-009","IntegrationContract; ExternalObjectMapping"],
  ["SCR-INT-005","Sync / Reconciliation","review","INT-010","SyncCheckpoint; IdempotencyRecord; IntegrationConflict; ReconciliationRun; DeadLetterItem"],
  ["SCR-INT-006","Integration Health & Lineage","analysis","INT-011","IntegrationHealthRecord; IntegrationLineageRecord"],
];

const protectedScreenFunctions: Readonly<Record<string,readonly string[]>> = Object.freeze({
  "SCR-DGM-001":["DGM-010"], "SCR-COR-004":["COR-018"], "SCR-INS-002":["INS-017"],
  "SCR-INS-004":["INS-018"], "SCR-INS-006":["INS-012","INS-020"], "SCR-RBI-002":["RBI-018"],
  "SCR-FND-002":["FND-004"], "SCR-FND-003":["FND-009","FND-011"],
  "SCR-REC-002":["REC-005","REC-009","REC-010"], "SCR-ACT-002":["ACT-010","ACT-011"],
  "SCR-ACT-004":["ACT-007"], "SCR-IOW-002":["IOW-009"], "SCR-IOW-004":["IOW-007"],
  "SCR-FFS-002":["FFS-010"], "SCR-GOV-008":["GOV-008"], "SCR-VIS-006":["VIS-008"],
});

export const SCREENS:readonly ScreenDefinition[] = Object.freeze(rows.map(([id,title,surface,functions,objects,notes])=>{
  const domain = id.split("-")[1] as ScreenDomain;
  const functionIds=expandFunctions(functions);
  for (const functionId of functionIds) if(!CAPABILITY_BY_ID.has(functionId))throw new Error(`Unknown function ${functionId} in ${id}`);
  const protectedFunctions=protectedScreenFunctions[id] ?? [];
  for (const functionId of protectedFunctions)if(!functionIds.includes(functionId))throw new Error(`Protected function not assigned to ${id}: ${functionId}`);
  return Object.freeze({id,domain,title,surface,functionIds,objects:Object.freeze(objects.split(";").map(s=>s.trim()).filter(Boolean)),protectedFunctions:Object.freeze([...protectedFunctions]),...(notes ? {notes} : {})});
}));
export const SCREEN_BY_ID:ReadonlyMap<string,ScreenDefinition> = new Map(SCREENS.map(s=>[s.id,s]));
export const SCREENS_BY_FUNCTION:ReadonlyMap<string,readonly ScreenDefinition[]> = new Map(
  [...CAPABILITY_BY_ID.keys()].map(id=>[id,Object.freeze(SCREENS.filter(s=>s.functionIds.includes(id)))]),
);
/** Integrity assertions execute at module initialization to expose missing design mappings early. */
if (SCREEN_BY_ID.size!==SCREENS.length) throw new Error("Duplicate screen ID");
for(const domain of DOMAINS) {
  if(SCREENS.filter(s=>s.domain===domain.code).length!==SCREEN_COUNTS[domain.code]) throw new Error(`Screen count mismatch: ${domain.code}`);
}
for(const [id,refs] of SCREENS_BY_FUNCTION) if(refs.length===0) throw new Error(`Missing screen coverage for ${id}`);
if(SCREENS.length!==78)throw new Error(`Unexpected primary screen inventory: ${SCREENS.length}`);
export const TOTAL_SCREEN_TARGETS = SCREENS.length;
