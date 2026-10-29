import { describe, expect, it } from "vitest";
import { EMPTY_INSPECTION, filterInspectionRequirements, grantedInspectionCredit, inspectionDueContext, parseInspectionSnapshot } from "./inspectionModel";
import { T0,T1,T2,inspectionFixture } from "./inspectionFixtures.test-utils";

type Fixture=ReturnType<typeof inspectionFixture>;
type Collection=keyof Fixture;
function changed<K extends Collection>(key:K,rows:Fixture[K]):Fixture{return {...inspectionFixture(),[key]:rows};}
function mutate<K extends Collection>(key:K,patch:Record<string,unknown>,index=0):Fixture{
  const f=inspectionFixture();const clone=(f[key] as readonly Record<string,unknown>[]).map((v,i)=>i===index?{...v,...patch}:v);
  return {...f,[key]:clone} as Fixture;
}
function accepted(){const result=parseInspectionSnapshot(inspectionFixture());if(!result.ok)throw Error(result.issues.join("|"));return result.snapshot;}
const collections:[Collection,...Collection[]]=["requirements","candidates","dueDecisions","plans","workpacks","events","reviews"];
describe("INS source boundary: structure and identity",()=>{
  it("accepts complete scope-authorized fixture",()=>expect(parseInspectionSnapshot(inspectionFixture()).ok).toBe(true));
  it("accepts explicit empty source snapshot",()=>expect(parseInspectionSnapshot(EMPTY_INSPECTION).ok).toBe(true));
  for(const malformed of [null,undefined,[],{},"json",4,true,{requirements:[]}, {...inspectionFixture(),extra:[]}]){
    it(`rejects malformed root ${typeof malformed}`,()=>expect(parseInspectionSnapshot(malformed).ok).toBe(false));
  }
  for(const key of collections){
    it(`rejects malformed ${key} collection`,()=>expect(parseInspectionSnapshot({...inspectionFixture(),[key]:{}}).ok).toBe(false));
    it(`rejects non-record ${key} items`,()=>expect(parseInspectionSnapshot(changed(key,[null] as never)).ok).toBe(false));
    it(`rejects unexpected ${key} fields`,()=>expect(parseInspectionSnapshot(mutate(key,{unknownSecret:"should not echo"})).ok).toBe(false));
    it(`rejects duplicate ${key} IDs`,()=>{const f=inspectionFixture();expect(parseInspectionSnapshot(changed(key,[...f[key],...f[key]] as never)).ok).toBe(false);});
  }
  it("does not echo rejected user values",()=>{const input=mutate("events",{resultReference:"SECRET-TEST-CREDENTIAL",status:"garbage"});const r=parseInspectionSnapshot(input);expect(r.ok).toBe(false);if(!r.ok)expect(r.issues.join(" ")).not.toContain("SECRET-TEST-CREDENTIAL");});
  it("preserves caller ownership, without freezing source data",()=>{const f=inspectionFixture();const r=parseInspectionSnapshot(f);expect(r.ok).toBe(true);(f.requirements[0] as {code:string}).code="CHANGED";if(r.ok)expect(r.snapshot.requirements[0]?.code).toBe("TEST-REQ-001");});
  it("freezes output arrays, nested ID arrays and records",()=>{const d=accepted();expect(Object.isFrozen(d)).toBe(true);expect(Object.isFrozen(d.plans)).toBe(true);expect(Object.isFrozen(d.plans[0])).toBe(true);expect(Object.isFrozen(d.plans[0]?.requirementIds)).toBe(true);expect(Object.isFrozen(d.dueDecisions[0]?.consideredCandidateIds)).toBe(true);});
});
describe("INS requirement, candidate and governing due semantics",()=>{
  for(const status of ["APPROVED","SUPERSEDED"] as const){it(`requires approval evidence for ${status} requirement`,()=>{const {approvedAt:discard,...r}=inspectionFixture().requirements[0]!;expect(discard).toBe(T0);expect(parseInspectionSnapshot(changed("requirements",[{...r,status}])).ok).toBe(false);});}
  it("allows draft requirement without approval timestamp",()=>{const {approvedAt:discard,...r}=inspectionFixture().requirements[0]!;expect(discard).toBe(T0);expect(parseInspectionSnapshot(changed("requirements",[{...r,status:"DRAFT"}])).ok).toBe(true);});
  for(const n of [-1,101,NaN,Infinity,"100",null])it(`rejects invalid required coverage ${String(n)}`,()=>expect(parseInspectionSnapshot(mutate("requirements",{requiredCoveragePercent:n})).ok).toBe(false));
  it("preserves 0% recorded requirement coverage as explicit zero",()=>{const r=parseInspectionSnapshot(mutate("requirements",{requiredCoveragePercent:0}));expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.requirements[0]?.requiredCoveragePercent).toBe(0);});
  it("rejects unknown effectiveness classification",()=>expect(parseInspectionSnapshot(mutate("requirements",{requiredEffectiveness:"EXTREME"})).ok).toBe(false));
  it("keeps UNKNOWN required effectiveness",()=>expect(parseInspectionSnapshot(mutate("requirements",{requiredEffectiveness:"UNKNOWN"})).ok).toBe(true));
  it("rejects candidate with unknown source",()=>expect(parseInspectionSnapshot(mutate("candidates",{source:"INS"})).ok).toBe(false));
  it("rejects COR candidate referencing absent requirement",()=>expect(parseInspectionSnapshot(mutate("candidates",{requirementId:"missing"})).ok).toBe(false));
  it("rejects calendar-invalid candidate date",()=>expect(parseInspectionSnapshot(mutate("candidates",{dueAt:"2026-02-30T00:00:00Z"})).ok).toBe(false));
  it("rejects INS governing due without basis",()=>expect(parseInspectionSnapshot(mutate("dueDecisions",{basisReference:""})).ok).toBe(false));
  it("rejects INS governing due for absent requirement",()=>expect(parseInspectionSnapshot(mutate("dueDecisions",{requirementId:"no-req"})).ok).toBe(false));
  it("rejects cross-requirement candidate in INS decision",()=>{const f=inspectionFixture();return expect(parseInspectionSnapshot({...f,dueDecisions:[{...f.dueDecisions[0]!,consideredCandidateIds:["bogus"]}]}).ok).toBe(false);});
  it("rejects duplicate governing decisions per requirement",()=>{const f=inspectionFixture();expect(parseInspectionSnapshot({...f,dueDecisions:[...f.dueDecisions,{...f.dueDecisions[0]!,id:"due-test-2"}]}).ok).toBe(false);});
  it("preserves a supplied INS due earlier than all COR/RBI/FFS candidates",()=>{const d=accepted();const due=inspectionDueContext(d,"req-test-1");expect(due.governing?.technicalDueAt).toBe(T1);expect(due.candidates.map(c=>c.source)).toEqual(["COR","RBI","FFS"]);expect(due.candidates.every(c=>c.dueAt===T2)).toBe(true);});
  it("does not calculate an INS due from COR/RBI/FFS proposals",()=>{const f=inspectionFixture();const r=parseInspectionSnapshot({...f,dueDecisions:[]});expect(r.ok).toBe(true);if(r.ok){const ctx=inspectionDueContext(r.snapshot,"req-test-1");expect(ctx.governing).toBeNull();expect(ctx.candidates).toHaveLength(3);}});
  it("does not fabricate candidates",()=>{const f=inspectionFixture();const r=parseInspectionSnapshot({...f,candidates:[],dueDecisions:[{...f.dueDecisions[0]!,consideredCandidateIds:[]}]});expect(r.ok).toBe(true);if(r.ok)expect(inspectionDueContext(r.snapshot,"req-test-1").candidates).toHaveLength(0);});
  it("unknown requirement returns no due",()=>{const d=accepted();expect(inspectionDueContext(d,"missing")).toEqual({candidates:[],governing:null});});
});
describe("INS planning/workpacks/events",()=>{
  it("rejects plan with nonexistent requirement",()=>expect(parseInspectionSnapshot(mutate("plans",{requirementIds:["absent"]})).ok).toBe(false));
  it("rejects plan with duplicate requirements",()=>expect(parseInspectionSnapshot(mutate("plans",{requirementIds:["req-test-1","req-test-1"]})).ok).toBe(false));
  it("rejects impossible execution schedule",()=>expect(parseInspectionSnapshot(mutate("plans",{plannedStart:T2,plannedEnd:T0})).ok).toBe(false));
  it("rejects unlinked workpack plan",()=>expect(parseInspectionSnapshot(mutate("workpacks",{planId:"missing"})).ok).toBe(false));
  it("rejects workpack requirement that is not in plan",()=>expect(parseInspectionSnapshot(mutate("workpacks",{requirementIds:["not-in-plan"]})).ok).toBe(false));
  it("requires release timestamp for RELEASED workpack",()=>{const {releasedAt:discard,...w}=inspectionFixture().workpacks[0]!;expect(discard).toBe(T0);expect(parseInspectionSnapshot(changed("workpacks",[w])).ok).toBe(false);});
  it("does not require release time for DRAFT workpack",()=>{const {releasedAt:discard,...w}=inspectionFixture().workpacks[0]!;expect(discard).toBe(T0);expect(parseInspectionSnapshot(changed("workpacks",[{...w,status:"DRAFT"}])).ok).toBe(true);});
  it("rejects event pointing to unknown workpack",()=>expect(parseInspectionSnapshot(mutate("events",{workpackId:"missing"})).ok).toBe(false));
  it("rejects event attached to a requirement outside workpack",()=>expect(parseInspectionSnapshot(mutate("events",{requirementId:"missing"})).ok).toBe(false));
  it("rejects duplicate event evidence references",()=>expect(parseInspectionSnapshot(mutate("events",{evidenceReferences:["same","same"]})).ok).toBe(false));
  it("rejects FINALIZED event without result reference",()=>{const {resultReference:discard,...e}=inspectionFixture().events[0]!;expect(discard).toBe("test-result");expect(parseInspectionSnapshot(changed("events",[{...e,status:"FINALIZED"}])).ok).toBe(false);});
  it("FIELD_COMPLETE event does not imply inspection credit",()=>{const f=inspectionFixture();const r=parseInspectionSnapshot({...f,reviews:[]});expect(r.ok).toBe(true);if(r.ok){expect(r.snapshot.events[0]?.status).toBe("FIELD_COMPLETE");expect(grantedInspectionCredit(r.snapshot,"evt-test-1")).toBeNull();}});
});
describe("INS technical review / credit separation",()=>{
  it("accepts explicitly approved, partially credited review",()=>{const d=accepted();expect(grantedInspectionCredit(d,"evt-test-1")?.credit).toBe("PARTIAL");});
  it("rejects review attached to wrong requirement",()=>expect(parseInspectionSnapshot(mutate("reviews",{requirementId:"missing"})).ok).toBe(false));
  it("rejects review for unknown event",()=>expect(parseInspectionSnapshot(mutate("reviews",{eventId:"missing"})).ok).toBe(false));
  it("rejects duplicate current reviews per event",()=>{const f=inspectionFixture();expect(parseInspectionSnapshot({...f,reviews:[...f.reviews,{...f.reviews[0]!,id:"review-2"}]}).ok).toBe(false);});
  it("rejects APPROVED review without reviewedAt",()=>{const {reviewedAt:discard,...r}=inspectionFixture().reviews[0]!;expect(discard).toBe(T2);expect(parseInspectionSnapshot(changed("reviews",[r])).ok).toBe(false);});
  it("rejects GRANTED credit without basis",()=>{const {creditBasisReference:discard,...r}=inspectionFixture().reviews[0]!;expect(discard).toBe("test-credit-basis");expect(parseInspectionSnapshot(changed("reviews",[{...r,credit:"GRANTED"}])).ok).toBe(false);});
  it("rejects PARTIAL credit without credit timestamp",()=>{const {creditGrantedAt:discard,...r}=inspectionFixture().reviews[0]!;expect(discard).toBe(T2);expect(parseInspectionSnapshot(changed("reviews",[r])).ok).toBe(false);});
  it("rejects credit grant on PENDING review",()=>expect(parseInspectionSnapshot(mutate("reviews",{status:"PENDING",credit:"GRANTED"})).ok).toBe(false));
  it("rejects a non-granted outcome carrying grant timestamp",()=>expect(parseInspectionSnapshot(mutate("reviews",{credit:"NOT_GRANTED"})).ok).toBe(false));
  it("accepts NOT_DETERMINED with missing grant metadata",()=>{const {creditBasisReference:ignored,creditGrantedAt:discard,...r}=inspectionFixture().reviews[0]!;expect(ignored).toBe("test-credit-basis");expect(discard).toBe(T2);const p=parseInspectionSnapshot(changed("reviews",[{...r,credit:"NOT_DETERMINED",status:"PENDING"}]));expect(p.ok).toBe(true);if(p.ok)expect(grantedInspectionCredit(p.snapshot,"evt-test-1")).toBeNull();});
  it("never grants credit merely because event is FINALIZED",()=>{const f=inspectionFixture();const finalized=mutate("events",{status:"FINALIZED"});const {creditBasisReference:ignored,creditGrantedAt:discard,...r}=f.reviews[0]!;expect(ignored).toBe("test-credit-basis");expect(discard).toBe(T2);const p=parseInspectionSnapshot({...finalized,reviews:[{...r,credit:"NOT_GRANTED"}]});expect(p.ok).toBe(true);if(p.ok)expect(grantedInspectionCredit(p.snapshot,"evt-test-1")).toBeNull();});
  it("rejects invalid achieved coverage",()=>expect(parseInspectionSnapshot(mutate("reviews",{achievedCoveragePercent:101})).ok).toBe(false));
  it("keeps recorded zero achieved coverage",()=>{const p=parseInspectionSnapshot(mutate("reviews",{achievedCoveragePercent:0}));expect(p.ok).toBe(true);});
  it("retains residual obligation as a separate string",()=>expect(accepted().reviews[0]?.residualObligation).toContain("outstanding"));
});
describe("INS local-only view helpers",()=>{
  it("filters requirement search by asset/scope and status",()=>{const rows=accepted().requirements;expect(filterInspectionRequirements(rows,{search:"TEST-ASSET-1",state:"APPROVED"})).toHaveLength(1);expect(filterInspectionRequirements(rows,{search:"test ut",state:"DRAFT"})).toHaveLength(0);});
  it("applies all multi-term search words",()=>{expect(filterInspectionRequirements(accepted().requirements,{search:"  test vessel  ut ",state:"ALL"})).toHaveLength(1);});
  it("never mutates input requirement ordering",()=>{const rows=accepted().requirements;filterInspectionRequirements(rows,{search:"",state:"ALL"});expect(rows.map(r=>r.id)).toEqual(["req-test-1"]);});
});
