import {type VisCollection} from "./visualizationModel";
// Synthetic records exist ONLY in tests. No production seed data or authoritative decisions are shipped.
export const T0="2026-01-01T00:00:00Z";
export const T1="2026-01-03T00:00:00Z";
export const T2="2026-01-05T00:00:00Z";
export type MutableVisualFixture=Record<VisCollection,Record<string,unknown>[]>;
export function visualFixture():MutableVisualFixture{return {
 sources:[
 {id:"pid-1",tenantId:"test-tenant",label:"Test process P&ID",kind:"PID",revision:"pid-r3",sourceRef:"test-edms-PID",status:"CURRENT",observedAt:T0},
 {id:"gis-1",tenantId:"test-tenant",label:"Test GIS source",kind:"GIS",revision:"gis-r2",sourceRef:"test-gis-layer",status:"CURRENT",observedAt:T0},
 {id:"drawing-1",tenantId:"test-tenant",label:"Test 2D drawing",kind:"DRAWING_2D",revision:"dwg-r1",sourceRef:"test-dwg-ref",status:"CURRENT",observedAt:T0},
 {id:"model-1",tenantId:"test-tenant",label:"Test 3D model",kind:"MODEL_3D",revision:"3d-r1",sourceRef:"test-3d-ref",status:"CURRENT",observedAt:T0}],
 assets:[{id:"asset-1",tenantId:"test-tenant",tag:"EQ-TEST-001",assetClass:"EQUIPMENT",name:"Fixture vessel"}],
 mappings:[
 {id:"map-pid",tenantId:"test-tenant",sourceId:"pid-1",sourceRevision:"pid-r3",externalObjectRef:"P&ID-V-1",assetId:"asset-1",state:"VERIFIED",x:30,y:40,verifiedBy:"engineer-test",verifiedAt:T1,reviewRef:"review-pid"},
 {id:"map-gis",tenantId:"test-tenant",sourceId:"gis-1",sourceRevision:"gis-r2",externalObjectRef:"GIS-V-1",assetId:"asset-1",state:"VERIFIED",x:60,y:40,verifiedBy:"engineer-test",verifiedAt:T1,reviewRef:"review-gis"},
 {id:"map-pending",tenantId:"test-tenant",sourceId:"drawing-1",sourceRevision:"dwg-r1",externalObjectRef:"DWG-UNKNOWN",state:"AMBIGUOUS",x:15,y:80}],
 overlays:[
 {id:"overlay-approved",tenantId:"test-tenant",mappingId:"map-pid",sourceDomain:"RBI",engineeringRef:"test-rbi",engineeringRevision:"rbi-r2",kind:"RISK",state:"APPROVED",label:"Approved risk basis",observedAt:T0,basisRef:"test-basis",approvalRef:"rbi-approval",approvedAt:T2},
 {id:"overlay-projected",tenantId:"test-tenant",mappingId:"map-pid",sourceDomain:"COR",engineeringRef:"test-cor",engineeringRevision:"cor-r2",kind:"INTEGRITY",state:"PROJECTED",label:"Projected corrosion trend",observedAt:T0},
 {id:"overlay-scenario",tenantId:"test-tenant",mappingId:"map-pid",sourceDomain:"FFS",engineeringRef:"test-ffs",engineeringRevision:"ffs-r2",kind:"STATUS",state:"SCENARIO",label:"Scenario fitness",observedAt:T0,scenarioRef:"scenario-1"},
 {id:"overlay-unknown",tenantId:"test-tenant",mappingId:"map-pid",sourceDomain:"DGM",engineeringRef:"test-dgm",engineeringRevision:"dgm-r2",kind:"STATUS",state:"UNKNOWN",label:"Unknown barrier",observedAt:T0},
 {id:"overlay-stale",tenantId:"test-tenant",mappingId:"map-pid",sourceDomain:"INS",engineeringRef:"test-ins",engineeringRevision:"ins-r2",kind:"STATUS",state:"STALE",label:"Stale inspection status",observedAt:T0,staleAt:T1},
 {id:"overlay-gis",tenantId:"test-tenant",mappingId:"map-gis",sourceDomain:"RBI",engineeringRef:"test-rbi",engineeringRevision:"rbi-r2",kind:"RISK",state:"APPROVED",label:"GIS risk reference",observedAt:T0,basisRef:"test-basis",approvalRef:"rbi-approval",approvedAt:T2}],
 alignments:[{id:"align-gis",tenantId:"test-tenant",sourceId:"gis-1",sourceRevision:"gis-r2",state:"ALIGNED",basisRef:"gis-alignment-basis",verifiedBy:"engineer-test",verifiedAt:T1,reviewRef:"alignment-audit"}],
 reviews:[{id:"review-pid",tenantId:"test-tenant",mappingId:"map-pid",mappingState:"VERIFIED",decision:"VERIFY",reviewedBy:"engineer-test",reviewedAt:T1,basisRef:"map-basis"},{id:"review-gis",tenantId:"test-tenant",mappingId:"map-gis",mappingState:"VERIFIED",decision:"VERIFY",reviewedBy:"engineer-test",reviewedAt:T1,basisRef:"map-basis"}]
};}
