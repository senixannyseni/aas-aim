import {describe,expect,it} from "vitest";
import {projectCrossDomainInvestigation, type CrossDomainInput} from "./crossDomainInvestigationModel";
import {EVIDENCE_INDEX_LIMIT} from "./engineeringEvidenceModel";
import {EMPTY_CORROSION} from "../corrosion/corrosionModel";
import {inspectionFixture} from "../inspection/inspectionFixtures.test-utils";
const at="2026-03-01T00:00:00Z";
const assetSnapshot={assets:[
  {id:"A1",tag:"V-101",name:"Synthetic Vessel",kind:"EQUIPMENT",state:"ACTIVE"},
  {id:"A2",tag:"V-202",name:"Foreign Vessel",kind:"EQUIPMENT",state:"ACTIVE"},
],relationships:[],history:[]};
const cor=()=>({...EMPTY_CORROSION,
  loops:[{id:"L1",name:"Loop",assetId:"A1",systemReference:"A",basisReference:"LOOP-1"},
    {id:"L2",name:"Other",assetId:"A2",systemReference:"B",basisReference:"SECRET-LOOP"}],
  circuits:[{id:"C1",loopId:"L1",code:"COR-1",name:"Pipe",assetId:"A1",revision:"r1",state:"ACTIVE"},
    {id:"C2",loopId:"L2",code:"COR-2",name:"Pipe",assetId:"A2",revision:"r2",state:"ACTIVE"}],
  locations:[{id:"LOC1",circuitId:"C1",tag:"TML-1",componentReference:"shell",kind:"TML",sourceReference:"SOURCE-A"},
    {id:"LOC2",circuitId:"C2",tag:"TML-2",componentReference:"shell",kind:"TML",sourceReference:"SECRET-SOURCE"}],
  points:[{id:"P1",locationId:"LOC1",tag:"one",orientation:"TOP"}],
  sets:[{id:"S1",circuitId:"C1",reference:"MEAS-A",measuredAt:at,state:"VALIDATED"}],
  readings:[{id:"R1",setId:"S1",pointId:"P1",measuredAt:at,thicknessMm:12.1,quality:"VALID",sourceReference:"READ-A"}],
  calculations:[{id:"CAL1",circuitId:"C1",revision:"rc1",status:"DRAFT",basisReference:"CAL-BASIS",inputReadingIds:["R1"],traceReference:"CAL-TRACE",calculatedAt:at}],
});
const ins=()=>({...inspectionFixture(),
  requirements:inspectionFixture().requirements.map(r=>({...r,assetId:"A1"})),
});
const base=():CrossDomainInput=>({navigationScopeKey:"NAV",crossDomainScopeKey:"NAV",assetScopeKey:"AIR",corrosionScopeKey:"COR",inspectionScopeKey:"INS",
  selectedAssetId:"A1",assetSnapshot,corrosionSnapshot:cor(),inspectionSnapshot:ins()});
function context(input:CrossDomainInput=base()){
  const result=projectCrossDomainInvestigation(input);
  if(result.kind!=="ready")throw Error(`Expected ready: ${result.kind}`);
  return result.context;
}
describe("Phase 46.5: source-bound engineering reference directory",()=>{
  it("collects per-record provenance without foreign asset source leakage",()=>{
    const evidence=context().evidence;
    expect(evidence.corrosion.entries.map(x=>x.reference)).toContain("CAL-TRACE");
    expect(evidence.corrosion.entries.map(x=>x.reference)).toContain("SOURCE-A");
    expect(JSON.stringify(evidence)).not.toContain("SECRET");
    expect(evidence.corrosion.entries.find(x=>x.sourceRecordId==="CAL1")).toMatchObject({
      domain:"COR",ownerRecordId:"C1",revision:"rc1",reportedAt:at,supportingReference:"CAL-BASIS"});
  });
  it("keeps INS due candidates, governing decision and reviews as separate authorities",()=>{
    const entries=context().evidence.inspection.entries;
    expect(entries.find(x=>x.sourceRecordId==="cand-cor")?.authority).toBe("DUE_CANDIDATE");
    expect(entries.find(x=>x.sourceRecordId==="due-test-1")?.authority).toBe("GOVERNING_INS_DECISION");
    expect(entries.find(x=>x.sourceRecordId==="review-test-1")?.authority).toBe("TECHNICAL_REVIEW");
    expect(entries.some(x=>x.reference==="test-evidence-1")).toBe(true);
    expect(entries.find(x=>x.sourceRecordId==="evt-test-1")?.ownerRecordId).toBe("req-test-1");
  });
  it("does not infer a governing due from a candidate when INS has no decision",()=>{
    const source=ins();
    const entries=context({...base(),inspectionSnapshot:{...source,dueDecisions:[]}}).evidence.inspection.entries;
    expect(entries.filter(x=>x.authority==="DUE_CANDIDATE")).toHaveLength(3);
    expect(entries.filter(x=>x.authority==="GOVERNING_INS_DECISION")).toHaveLength(0);
  });
  it("does not infer inspection credit from a field event without an approved review",()=>{
    const source=ins();
    const entries=context({...base(),inspectionSnapshot:{...source,reviews:[]}}).evidence.inspection.entries;
    expect(entries.some(x=>x.kind==="Field evidence reference")).toBe(true);
    expect(entries.some(x=>x.authority==="TECHNICAL_REVIEW")).toBe(false);
  });
  it("withholds both indexes if AIR cannot be validated or navigation is not attested",()=>{
    expect(projectCrossDomainInvestigation({...base(),crossDomainScopeKey:"FOREIGN"}).kind).toBe("disabled");
    expect(projectCrossDomainInvestigation({...base(),assetSnapshot:{assets:[{id:"A1"}]}}).kind).toBe("rejected");
  });
  it("never exposes invalid or disconnected independent source references",()=>{
    const invalid=context({...base(),corrosionSnapshot:{readings:[{secret:"LEAK"}]}});
    expect(invalid.evidence.corrosion.entries).toHaveLength(0);
    expect(invalid.corrosion.state).toBe("rejected");
    expect(invalid.evidence.inspection.entries.length).toBeGreaterThan(0);
    const missing=context({...base(),inspectionScopeKey:undefined});
    expect(missing.evidence.inspection.entries).toHaveLength(0);
    expect(missing.evidence.corrosion.entries.length).toBeGreaterThan(0);
  });
  it("bounds the per-domain index, preserves source count and marks truncation",()=>{
    const lots={...cor(),locations:[cor().locations[0]!,...Array.from({length:EVIDENCE_INDEX_LIMIT+5},(_,i)=>({
      id:`LOC-${i}`,circuitId:"C1",tag:`TML-${i}`,componentReference:"shell",kind:"TML",sourceReference:`SRC-${i}`}))]};
    const index=context({...base(),corrosionSnapshot:lots}).evidence.corrosion;
    expect(index.truncated).toBe(true);
    expect(index.entries).toHaveLength(EVIDENCE_INDEX_LIMIT);
    expect(index.total).toBeGreaterThan(EVIDENCE_INDEX_LIMIT);
  });
  it("treats source reference strings as inert text, never document URLs",()=>{
    const entries=context().evidence.corrosion.entries;
    expect(entries.every(x=>!Object.hasOwn(x,"url")&&!Object.hasOwn(x,"href"))).toBe(true);
  });
});
