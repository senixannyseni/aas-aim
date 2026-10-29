import {describe,expect,it} from "vitest";
import {projectCrossDomainInvestigation, type CrossDomainInput} from "./crossDomainInvestigationModel";
import {inspectionFixture, T1, T2} from "../inspection/inspectionFixtures.test-utils";
import {EMPTY_CORROSION} from "../corrosion/corrosionModel";

const asset=()=>({assets:[
  {id:"TEST-ASSET-1",tag:"V-101",name:"Test Vessel",kind:"EQUIPMENT",state:"ACTIVE",revision:"AIR-2"},
  {id:"OTHER-ASSET",tag:"P-22",name:"Other Pump",kind:"EQUIPMENT",state:"ACTIVE"}],
  relationships:[],history:[]});
const corrosion=()=>({...EMPTY_CORROSION,
  loops:[{id:"loop-1",name:"Vessel loop",assetId:"TEST-ASSET-1",systemReference:"S",basisReference:"loop-basis"},
    {id:"loop-2",name:"Foreign loop",assetId:"OTHER-ASSET",systemReference:"S",basisReference:"foreign-basis"}],
  circuits:[{id:"cor-1",loopId:"loop-1",code:"COR-TEST",name:"Test circuit",assetId:"TEST-ASSET-1",revision:"COR-1",state:"ACTIVE"},
    {id:"cor-2",loopId:"loop-2",code:"COR-PRIVATE",name:"Other circuit",assetId:"OTHER-ASSET",revision:"COR-3",state:"ACTIVE"}],
  calculations:[{id:"calc-1",circuitId:"cor-1",revision:"3",status:"APPROVED",basisReference:"calc-basis",inputReadingIds:[],traceReference:"calc-trace",calculatedAt:"2026-03-01T00:00:00Z",approvedAt:"2026-03-01T00:00:00Z"}],
});
function input():CrossDomainInput{return {navigationScopeKey:"principal/tenant/site/epoch-1",
  crossDomainScopeKey:"principal/tenant/site/epoch-1",assetScopeKey:"asset-auth-1",
  corrosionScopeKey:"cor-auth-1",inspectionScopeKey:"ins-auth-1",
  selectedAssetId:"TEST-ASSET-1",assetSnapshot:asset(),corrosionSnapshot:corrosion(),
  inspectionSnapshot:inspectionFixture()};}
function ready(p:CrossDomainInput=input()){
  const value=projectCrossDomainInvestigation(p);
  if(value.kind!=="ready")throw Error(`Expected ready, got ${value.kind}`);
  return value.context;
}
describe("Phase 46.4: independent scope-bound AIR → COR → INS projection",()=>{
  it("denies navigation without an explicit same-epoch attestation",()=>{
    expect(projectCrossDomainInvestigation({...input(),crossDomainScopeKey:undefined}).kind).toBe("disabled");
    expect(projectCrossDomainInvestigation({...input(),crossDomainScopeKey:"other-epoch"}).kind).toBe("disabled");
    expect(projectCrossDomainInvestigation({...input(),navigationScopeKey:undefined}).kind).toBe("disabled");
  });
  it("denies navigation without independently scoped AIR data",()=>{
    expect(projectCrossDomainInvestigation({...input(),assetScopeKey:undefined}).kind).toBe("disabled");
    expect(projectCrossDomainInvestigation({...input(),assetSnapshot:null}).kind).toBe("disabled");
  });
  it("rejects invalid AIR as a whole and never discloses COR/INS",()=>{
    expect(projectCrossDomainInvestigation({...input(),assetSnapshot:{assets:[{id:"SECRET"}]}}).kind).toBe("rejected");
  });
  it("never invents a selection for an absent or foreign asset",()=>{
    expect(projectCrossDomainInvestigation({...input(),selectedAssetId:"missing"}).kind).toBe("unselected");
    expect(projectCrossDomainInvestigation({...input(),selectedAssetId:undefined}).kind).toBe("unselected");
  });
  it("retains explicitly matched source identities and strips unrelated records",()=>{
    const v=ready();
    expect(v.asset.tag).toBe("V-101");
    expect(v.corrosion.state).toBe("ready");
    expect(v.corrosion.records.map(x=>x.code)).toEqual(["COR-TEST"]);
    expect(JSON.stringify(v)).not.toContain("COR-PRIVATE");
    expect(v.corrosion.records[0]?.calculationReferences[0]?.basisReference).toBe("calc-basis");
    expect(v.inspection.records.map(x=>x.code)).toEqual(["TEST-REQ-001"]);
  });
  it("preserves INS technical due independently of COR candidates",()=>{
    const r=ready().inspection.records[0]!;
    expect(r.governingTechnicalDueAt).toBe(T1);
    expect(r.dueCandidates[0]?.dueAt).toBe(T2);
    expect(r.dueCandidates[0]?.source).toBe("COR");
    expect(r.governingBasis).toBe("test-ins016-decision");
  });
  it("grants no inspection credit from a field-complete event alone",()=>{
    const ins=inspectionFixture();
    expect(ready({...input(),inspectionSnapshot:{...ins,reviews:[]}}).inspection.records[0]?.reviewedCreditCount).toBe(0);
    expect(ready().inspection.records[0]?.reviewedCreditCount).toBe(1);
  });
  it("keeps invalid COR disconnected from otherwise valid INS",()=>{
    const v=ready({...input(),corrosionSnapshot:{loops:[{untrusted:"payload"}]}});
    expect(v.corrosion).toEqual({state:"rejected",records:[]});
    expect(v.inspection.state).toBe("ready");
  });
  it("keeps missing domain scope disconnected even when a payload exists",()=>{
    const v=ready({...input(),corrosionScopeKey:undefined,inspectionScopeKey:undefined});
    expect(v.corrosion).toEqual({state:"disconnected",records:[]});
    expect(v.inspection).toEqual({state:"disconnected",records:[]});
  });
  it("does not derive an INS governing due from COR or RBI candidates",()=>{
    const ins=inspectionFixture();
    const r=ready({...input(),inspectionSnapshot:{...ins,dueDecisions:[]}}).inspection.records[0]!;
    expect(r.dueCandidates).toHaveLength(3);
    expect(r.governingTechnicalDueAt).toBeNull();
  });
  it("never reports nonmatching records as universally absent",()=>{
    const v=ready({...input(),corrosionSnapshot:EMPTY_CORROSION,inspectionSnapshot:{...inspectionFixture(),requirements:[],candidates:[],dueDecisions:[],plans:[],workpacks:[],events:[],reviews:[]}});
    expect(v.corrosion).toEqual({state:"ready",records:[]});
    expect(v.inspection).toEqual({state:"ready",records:[]});
  });
});
