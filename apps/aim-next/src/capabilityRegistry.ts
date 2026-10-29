/**
 * Future AAS–AIM: frozen canonical function registry v1.0 (Artifact 1).
 * Function IDs are stable identities, not UI routes or frontend permissions.
 */
export const DOMAIN_GROUPS = ["Engineering model", "Assurance & assessment", "Execution & delivery", "Platform & intelligence"] as const;
export type DomainGroup = (typeof DOMAIN_GROUPS)[number];
export type DomainCode = "AIR" | "DGM" | "COR" | "INS" | "RBI" | "FND" | "REC" | "ACT" | "IOW" | "FFS" | "GOV" | "INT" | "ANA" | "FLD" | "VIS";
export type Capability = Readonly<{id:string; title:string; domain:DomainCode; controlled:boolean}>;
export type DomainDefinition = Readonly<{code:DomainCode;name:string;summary:string;group:DomainGroup;functions:readonly Capability[]}>;
const domainInfo: readonly Readonly<[DomainCode,string,string,DomainGroup,number]>[] = [
  ["AIR","Asset Integrity Registry","Equipment, components, systems and the integrity timeline","Engineering model",6],
  ["DGM","Degradation Mechanisms","Damage threats, applicability, barriers and verification","Engineering model",2],
  ["COR","Corrosion & Thickness","Circuits, CMLs, measurement sets and technical calculations","Engineering model",6],
  ["IOW","Integrity Operating Windows","Operating limits, excursions and dispositions","Engineering model",4],
  ["INS","Inspection Management","Requirements, workpacks, events, evidence and credit","Assurance & assessment",6],
  ["RBI","Risk-Based Inspection","Probability, consequence, inspection strategy and approval","Assurance & assessment",3],
  ["FND","Findings & Condition Cases","Findings, significance, cases and disposition","Assurance & assessment",3],
  ["FFS","Fitness-for-Service","Flaw input, engineering evaluations and assessments","Assurance & assessment",3],
  ["REC","Recommendations","Requirements, ownership, fulfillment and closeout","Execution & delivery",2],
  ["ACT","Actions, Repairs & Deferrals","Repair plans, deferrals, controls and verification","Execution & delivery",4],
  ["FLD","Field Companion","Offline capture, field identity and safe synchronization","Execution & delivery",5],
  ["GOV","Governance","Authority, audit, evidence and controlled revisions","Platform & intelligence",12],
  ["INT","Integrations","External systems, mapping, reconciliation and lineage","Platform & intelligence",6],
  ["ANA","Analytics & Decision Support","Quality, trends, exposure and action dashboards","Platform & intelligence",6],
  ["VIS","Visualization & Context","P&ID, drawings, models, GIS and integrity overlays","Platform & intelligence",6],
];
/** Names sourced from frozen Artifact 1. Function order determines the canonical ID.
 * VIS starts at 003: VIS-001 and VIS-002 are permanently retired.
 */
const names: Readonly<Record<DomainCode,string>> = {
AIR: `Create / Manage Asset Hierarchy
Create / Manage Equipment
Create / Manage Components
Classify Equipment / Component Type
Maintain Design / Material / Process Attributes
Map Systems / Functional Locations
Maintain Cross-Asset Relationships
Manage Asset Lifecycle / Status
Generate / View Asset Integrity Timeline
Bulk-Import and Validate Asset Master Data
Explore Object Relationships / Impact`,
DGM: `Maintain Degradation Mechanism Library
Assign Potential Degradation Mechanisms
Assess Mechanism Applicability & Susceptibility
Link / Evaluate Degradation Evidence
Define Integrity / Degradation Barriers
Assess Barrier Design Effectiveness
Manage Mechanism Applicability Factors
Manage Mechanism–Inspection Technique Capability
Define Mechanism Monitoring / IOW Relationships
Review / Approve Degradation Assessment
Define Barrier Verification Criteria & Indicators
Determine Barrier Health / Status`,
COR: `Manage Corrosion Loop Context
Manage Corrosion Circuit
Manage Monitoring Location / CML / TML
Manage Measurement Point
Record Thickness Reading
Bulk-Import Thickness / Condition Data
Validate Thickness Reading
Detect Measurement Anomaly
Review / Disposition Measurement Anomaly
Calculate Long-Term Corrosion Rate
Calculate Short-Term Corrosion Rate
Calculate Regression Corrosion Rate
Determine Proposed Governing Corrosion Rate
Calculate Remaining Corrosion Allowance / Remaining Life
Determine Corrosion-Based Inspection Due Candidate
Detect Adverse Corrosion Trend
Project Thickness / Limit Date
Review / Approve Corrosion Calculation Set
Manage Thickness Measurement Set
Maintain Minimum Required Thickness (Tmin)
Calculate Circuit Aggregate Corrosion Rate
Manage Suggested / Assumed Corrosion Rate`,
INS: `Create / Manage Inspection Requirement
Generate Requirement from Engineering Source
Define Inspection Scope
Define NDE / Inspection Technique
Define Required Effectiveness / Coverage
Create / Manage Inspection Plan
Create / Manage Inspection Workpack
Assign / Qualify Personnel & Resources
Create / Manage Inspection Event
Record Inspection Results / Evidence
Perform Technical Review
Determine / Grant Inspection Credit
Determine Residual Inspection Obligation
Finalize Inspection Event
Define Recurrence / Next Requirement
Determine Governing Technical Inspection Due Date
Review / Approve Inspection Requirement
Review / Release Inspection Workpack
Assess Achieved Scope / Coverage / Effectiveness
Review / Approve Inspection Record`,
RBI: `Create / Manage RBI Assessment
Define RBI Basis / Methodology
Freeze RBI Input Set
Assess Data Quality / Uncertainty / Confidence
Map Degradation Mechanisms to Probability Model
Calculate Damage Factors / Probability Drivers
Qualify Inspection History / Credit for RBI
Calculate Probability / Susceptibility to Failure
Calculate Consequence of Failure
Determine Current Risk
Determine Future Risk
Define Risk Target / Acceptance Criteria
Determine RBI Inspection Due Candidate
Determine Target Inspection Effectiveness / Coverage
Develop RBI Inspection Strategy
Perform RBI What-If / Sensitivity Scenario
Review Risk Drivers / Calculation Trace
Review / Approve RBI Assessment
Initiate / Manage RBI Reassessment`,
FND: `Raise Finding
Define / Classify Finding
Locate Finding / Establish Context
Validate / Triage Finding
Create / Link Integrity Condition Case
Consolidate Condition Evidence
Assess Condition Significance / Risk
Determine Condition Disposition
Review / Approve Condition Assessment
Monitor / Reassess Integrity Condition Case
Close / Reopen Integrity Condition Case`,
REC: `Create Recommendation from Approved Basis
Define Requirement / Acceptance Criteria
Classify / Prioritize / Define Technical Timing
Assign Accountability / Ownership
Review / Approve Recommendation
Define Execution Path
Track Progress / Commitments / Exceptions
Revise / Supersede / Withdraw Recommendation
Verify Technical Fulfillment
Close / Reopen Recommendation`,
ACT: `Create / Manage Integrity Action
Manage Temporary Repair
Manage Permanent Repair
Define / Manage Temporary Controls
Create Deferral Request
Assess Deferral Risk / Compensating Measures
Review / Approve / Reject Deferral
Link / Manage MOC Reference
Monitor Expiry / Compliance
Verify Technical Completion / Reassessment
Review / Approve / Release Execution Plan
Synchronize External Work / CMMS Status
Record Execution Completion / Evidence`,
IOW: `Create / Manage IOW Definition
Define Limits / Classification / Exceedance Rules
Configure Process / Historian Source
Define Derived / Virtual Variable
Link IOW to Asset / DGM / Barrier
Detect / Consolidate Exceedances & Excursions
Review / Disposition Excursion
Analyze IOW Compliance / History / Trends
Review / Approve IOW Definition
Assess Monitoring Data Quality / Availability
Initiate Follow-Up / Reassessment`,
FFS: `Create / Manage FFS Assessment
Define Assessment Basis, Methodology, Procedure & Level
Assemble / Freeze FFS Input Set & Flaw Characterization
Assess Input Quality, Applicability & Limitations
Perform FFS Engineering Calculation / Evaluation
Determine Fitness, Remaining Life & Operating Envelope
Define FFS Conditions, Monitoring & Remediation Requirements
Perform What-If / Sensitivity Analysis
Review Calculation Trace & Engineering Basis
Review / Approve FFS Assessment
Initiate / Manage FFS Reassessment & Downstream Follow-Up`,
GOV: `Authentication / SSO
Capability-Based Authorization
Site / Unit / Resource Scope Enforcement
Approval-Authority Management
Workflow / State-Policy Enforcement
Immutable Audit Logging
Record Revision / Version Management
Manage Controlled Methodology, Standards & Configuration Packages
Notifications / Escalation
Tenant / Site Administration
Retention, Archival & Compliance Controls
Universal Object Search / Discovery
Manage Evidence Artifacts
Manage AI Policy, Provenance & Human Oversight`,
INT: `ERP / CMMS Integration
Historian / Process-Data Integration
EDMS / Document Integration
Engineering / Digital-Twin Integration
GIS Integration
Public / Internal API
Event / Webhook Integration
Data Import / Export / Migration Framework
Manage Integration Contracts, Data Ownership, Mapping & Transformation
Orchestrate Synchronization, Idempotency, Retry, Conflict & Reconciliation
Monitor Integration Health, Exceptions & Data Lineage`,
ANA: `Enterprise Integrity Dashboard
Engineer / Action Dashboard
Risk Distribution / Trend Analysis
Corrosion Trend Analytics
Remaining-Life Analytics
Overdue Inspection / Action Analytics
Bad-Actor Identification
Configurable Query / Report / Export
Assess Data Quality, Completeness & Analytics Confidence
Forecast Integrity Exposure, Obligations & Workload`,
FLD: `Download Field Workpack
View Asset / CML Information Offline
Capture Field Measurement
Complete Digital Inspection Checklist
Capture / Annotate Field Evidence
Raise Field Finding
Synchronize Offline Data
Resolve Synchronization Conflict
Confirm Field Asset / Component / Measurement-Location Identity`,
VIS: `P&ID Contextual Navigation
2D Drawing Visualization
3D Model Visualization
GIS / Map Visualization
Overlay Integrity / Risk / Status Layers
Manage Visual Object Mapping & Alignment`
};
/** Visual warning only. Authority is NEVER determined in the browser. */
const controlledIds = new Set(["DGM-010","COR-018","INS-012","INS-017","INS-018","INS-020","RBI-018","FND-004","FND-009","FND-011","REC-005","REC-009","REC-010","ACT-007","ACT-010","ACT-011","IOW-007","IOW-009","FFS-010"]);
export const DOMAINS: readonly DomainDefinition[] = Object.freeze(domainInfo.map(([code,name,summary,group]) => Object.freeze({
  code,name,summary,group,
  functions: Object.freeze(names[code].split("\n").map((title,i) => {
    const id = `${code}-${String(i+(code === "VIS" ? 3:1)).padStart(3,"0")}`;
    return Object.freeze({id,title,domain:code,controlled:controlledIds.has(id)});
  }))
})));
export const CAPABILITIES: readonly Capability[] = Object.freeze(DOMAINS.flatMap(d=>d.functions));
export const RETIRED_IDS = ["VIS-001","VIS-002"] as const;
export const CAPABILITY_BY_ID: ReadonlyMap<string,Capability> = new Map(CAPABILITIES.map(c=>[c.id,c]));
export const SCREEN_COUNTS: Readonly<Record<DomainCode,number>> = Object.freeze(Object.fromEntries(domainInfo.map(d=>[d[0],d[4]])) as Record<DomainCode,number>);
export const TOTAL_FUNCTIONS = 190;
export const TOTAL_PRIMARY_SCREENS = 78; // 74 domain screens + 3 HOME screens + 1 global shell (Artifact 6)
