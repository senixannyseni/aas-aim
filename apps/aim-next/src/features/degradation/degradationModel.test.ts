import {describe,expect,it} from "vitest";
import {EMPTY_DEGRADATION,filterMechanisms,getAssessmentContext,parseDegradationSnapshot} from "./degradationModel";

export const fixture=()=>({
  mechanisms:[
    {id:"m1",code:"DGM-M01",name:"Test general thinning",category:"Metal loss",revision:"2",state:"ACTIVE",basisReference:"test-method-v2",description:"Test-only mechanism"},
    {id:"m2",code:"DGM-M02",name:"Test chloride cracking",category:"Cracking",revision:"1",state:"DRAFT",basisReference:"test-method-v1"}
  ],
  assessments:[{id:"a1",assetId:"equipment-test-1",revision:"3",state:"APPROVED",assessedAt:"2026-10-19T10:00:00Z",basisReference:"test-assessment-r3"}],
  evidence:[{id:"e1",assessmentId:"a1",mechanismId:"m1",description:"Test thickness survey",sourceReference:"test-inspection-report",quality:"STALE",observedAt:"2025-10-19T10:00:00Z"}],
  factors:[{id:"f1",mechanismId:"m1",label:"Test temperature factor",basisReference:"test-factors"}],
  applicability:[{id:"ap1",assessmentId:"a1",mechanismId:"m1",applicability:"POTENTIAL",susceptibility:"UNKNOWN",evidenceIds:["e1"],factorIds:["f1"],basisReference:"test-assessment-r3"}],
  techniques:[{id:"t1",mechanismId:"m1",technique:"Test UT",capability:"LIMITED",basisReference:"test-technique-matrix"}],
  barrierDefinitions:[{id:"b1",name:"Test coating",purpose:"PREVENTIVE",designBasisReference:"test-coating-standard",mechanismIds:["m1"]}],
  barrierCriteria:[{id:"bc1",definitionId:"b1",indicator:"Test coating condition",acceptanceCriterion:"Test acceptance basis",basisReference:"test-criteria"}],
  barrierInstances:[{id:"bi1",assessmentId:"a1",definitionId:"b1",health:"UNKNOWN",assessmentBasisReference:"test-barrier-review"}],
  monitoringLinks:[{id:"ml1",assessmentId:"a1",mechanismId:"m1",sourceDomain:"IOW",sourceObjectId:"iow-test-1",sourceReference:"test-monitoring-reference"}]
});
const accepted=()=>{const r=parseDegradationSnapshot(fixture());if(!r.ok)throw Error(r.issues.join(" / "));return r.snapshot;};
const change=(key:keyof ReturnType<typeof fixture>,items:unknown[]):unknown=>({...fixture(),[key]:items});

describe("DGM canonical presentation snapshot",()=>{
  it("validates a complete snapshot and preserves independent engineering classifications",()=>{
    const result=parseDegradationSnapshot(fixture());expect(result.ok).toBe(true);
    if(result.ok){expect(result.snapshot.applicability[0]?.applicability).toBe("POTENTIAL");expect(result.snapshot.applicability[0]?.susceptibility).toBe("UNKNOWN");expect(result.snapshot.evidence[0]?.quality).toBe("STALE");expect(result.snapshot.barrierInstances[0]?.health).toBe("UNKNOWN");}
  });
  it("accepts an explicit empty snapshot without inventing engineering objects",()=>{const r=parseDegradationSnapshot(EMPTY_DEGRADATION);expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.assessments).toHaveLength(0);});
  it.each([null,undefined,[],{},"[]",{mechanisms:[]}])("rejects a missing or incorrect envelope %#",(input:unknown)=>expect(parseDegradationSnapshot(input).ok).toBe(false));
  it("rejects extra envelope metadata, including untrusted tenant claims",()=>expect(parseDegradationSnapshot({...fixture(),tenant:"other"}).ok).toBe(false));
  it("rejects all data if any collection has the wrong shape",()=>expect(parseDegradationSnapshot({...fixture(),evidence:{}}).ok).toBe(false));
  it("rejects arrays beyond the bounded presentation size",()=>expect(parseDegradationSnapshot(change("mechanisms",Array(10001).fill(null))).ok).toBe(false));
  it("rejects extra properties on a mechanism",()=>expect(parseDegradationSnapshot(change("mechanisms",[{...fixture().mechanisms[0],authorization:"approved"}])).ok).toBe(false));
  it("rejects missing mechanism basis",()=>{const {basisReference:_basis,...rest}=fixture().mechanisms[0]!;void _basis;expect(parseDegradationSnapshot(change("mechanisms",[rest])).ok).toBe(false);});
  it.each(["READY","approved","UNKNOWN",null,undefined])("rejects unsupported library state %s",(state:unknown)=>expect(parseDegradationSnapshot(change("mechanisms",[{...fixture().mechanisms[0],state},fixture().mechanisms[1]])).ok).toBe(false));
  it.each(["READY","ACCEPTED","UNKNOWN",null])("rejects unsupported assessment state %s",(state:unknown)=>expect(parseDegradationSnapshot(change("assessments",[{...fixture().assessments[0],state}])).ok).toBe(false));
  it.each(["TRUE","YES","VALID",null])("rejects unsupported applicability %s",(applicability:unknown)=>expect(parseDegradationSnapshot(change("applicability",[{...fixture().applicability[0],applicability}])).ok).toBe(false));
  it.each(["SEVERE","NONE",null])("rejects unsupported susceptibility %s",(susceptibility:unknown)=>expect(parseDegradationSnapshot(change("applicability",[{...fixture().applicability[0],susceptibility}])).ok).toBe(false));
  it.each(["GOOD","MISSING",null])("rejects unsupported evidence quality %s",(quality:unknown)=>expect(parseDegradationSnapshot(change("evidence",[{...fixture().evidence[0],quality}])).ok).toBe(false));
  it.each(["SAFE","NOT_PROVIDED",null])("rejects unsupported barrier health %s",(health:unknown)=>expect(parseDegradationSnapshot(change("barrierInstances",[{...fixture().barrierInstances[0],health}])).ok).toBe(false));
  it("rejects evidence without explicit provenance",()=>expect(parseDegradationSnapshot(change("evidence",[{...fixture().evidence[0],sourceReference:""}])).ok).toBe(false));
  it("rejects unrecognized or fabricated technique capability",()=>expect(parseDegradationSnapshot(change("techniques",[{...fixture().techniques[0],capability:"CERTIFIED"}])).ok).toBe(false));
  it("rejects unrecognized monitoring domains",()=>expect(parseDegradationSnapshot(change("monitoringLinks",[{...fixture().monitoringLinks[0],sourceDomain:"ERP"}])).ok).toBe(false));
  it("rejects duplicate definition identity",()=>expect(parseDegradationSnapshot(change("mechanisms",[fixture().mechanisms[0],fixture().mechanisms[0]])).ok).toBe(false));
  it("rejects duplicate codes case-insensitively",()=>expect(parseDegradationSnapshot(change("mechanisms",[fixture().mechanisms[0],{...fixture().mechanisms[1],code:"dgm-m01"}])).ok).toBe(false));
  it("rejects duplicate applicability for the same assessment/mechanism",()=>expect(parseDegradationSnapshot(change("applicability",[fixture().applicability[0],{...fixture().applicability[0],id:"ap2"}])).ok).toBe(false));
  it.each(["mechanisms","assessments","evidence","factors","applicability","techniques","barrierDefinitions","barrierCriteria","barrierInstances","monitoringLinks"] as const)("rejects duplicate identities in %s",(key:keyof ReturnType<typeof fixture>)=>{const record=fixture()[key][0];expect(parseDegradationSnapshot(change(key,[record,record])).ok).toBe(false);});
  it("rejects unresolved assessment identity on evidence",()=>expect(parseDegradationSnapshot(change("evidence",[{...fixture().evidence[0],assessmentId:"other"}])).ok).toBe(false));
  it("rejects unresolved mechanism on evidence",()=>expect(parseDegradationSnapshot(change("evidence",[{...fixture().evidence[0],mechanismId:"other"}])).ok).toBe(false));
  it("rejects unresolved applicability factor link",()=>expect(parseDegradationSnapshot(change("applicability",[{...fixture().applicability[0],factorIds:["absent"]}])).ok).toBe(false));
  it("rejects unresolved applicability evidence link",()=>expect(parseDegradationSnapshot(change("applicability",[{...fixture().applicability[0],evidenceIds:["absent"]}])).ok).toBe(false));
  it("rejects evidence associated with the wrong mechanism",()=>{const f=fixture();f.evidence[0]!.mechanismId="m2";expect(parseDegradationSnapshot(f).ok).toBe(false);});
  it("rejects factor linked to the wrong mechanism",()=>{const f=fixture();f.factors[0]!.mechanismId="m2";expect(parseDegradationSnapshot(f).ok).toBe(false);});
  it("rejects duplicate evidence ID within applicability links",()=>expect(parseDegradationSnapshot(change("applicability",[{...fixture().applicability[0],evidenceIds:["e1","e1"]}])).ok).toBe(false));
  it("rejects unresolved barrier mechanism reference",()=>expect(parseDegradationSnapshot(change("barrierDefinitions",[{...fixture().barrierDefinitions[0],mechanismIds:["missing"]}])).ok).toBe(false));
  it("rejects unresolved barrier criterion",()=>expect(parseDegradationSnapshot(change("barrierCriteria",[{...fixture().barrierCriteria[0],definitionId:"missing"}])).ok).toBe(false));
  it("rejects barrier instance missing an assessment",()=>expect(parseDegradationSnapshot(change("barrierInstances",[{...fixture().barrierInstances[0],assessmentId:"missing"}])).ok).toBe(false));
  it("rejects monitoring with nonexistent mechanism",()=>expect(parseDegradationSnapshot(change("monitoringLinks",[{...fixture().monitoringLinks[0],mechanismId:"missing"}])).ok).toBe(false));
  it.each(["2026-02-30T13:00:00Z","2026-13-01T13:00:00Z","2026-01-01T25:00:00Z","2026-01-01","2026-01-01T10:00:00+15:00"]) ("rejects impossible assessed timestamp %s",(assessedAt:unknown)=>expect(parseDegradationSnapshot(change("assessments",[{...fixture().assessments[0],assessedAt}])).ok).toBe(false));
  it("requires a recorded basis and timestamp for APPROVED assessments",()=>{
    expect(parseDegradationSnapshot(change("assessments",[{id:"a1",assetId:"equipment-test-1",revision:"3",state:"APPROVED"}])).ok).toBe(false);
    expect(parseDegradationSnapshot(change("assessments",[{...fixture().assessments[0],basisReference:""}])).ok).toBe(false);
  });
  it("rejects asserted applicability and susceptibility without a recorded technical basis",()=>{
    expect(parseDegradationSnapshot(change("applicability",[{...fixture().applicability[0],basisReference:""}])).ok).toBe(false);
  });
  it("rejects reported effective barriers without a recorded assessment basis",()=>{
    expect(parseDegradationSnapshot(change("barrierInstances",[{...fixture().barrierInstances[0],health:"EFFECTIVE",assessmentBasisReference:""}])).ok).toBe(false);
  });
  it("preserves omitted optional fields rather than manufacturing a basis",()=>{const r=parseDegradationSnapshot(change("assessments",[{id:"a1",assetId:"equipment-test-1",revision:"3",state:"DRAFT"}]));expect(r.ok).toBe(true);if(r.ok){expect(Object.hasOwn(r.snapshot.assessments[0]!,"basisReference")).toBe(false);expect(Object.hasOwn(r.snapshot.assessments[0]!,"assessedAt")).toBe(false);}});
  it("does not mutate or share caller-owned arrays and objects",()=>{
    const f=fixture();const r=parseDegradationSnapshot(f);expect(r.ok).toBe(true);
    if(r.ok){expect(Object.isFrozen(r.snapshot)).toBe(true);expect(Object.isFrozen(r.snapshot.mechanisms)).toBe(true);expect(Object.isFrozen(r.snapshot.applicability[0]?.evidenceIds)).toBe(true);f.mechanisms[0]!.name="Caller mutation";f.applicability[0]!.evidenceIds.push("mutated");expect(r.snapshot.mechanisms[0]?.name).toBe("Test general thinning");expect(r.snapshot.applicability[0]?.evidenceIds).toEqual(["e1"]);}
  });
  it("never includes rejected untrusted values in validation issues",()=>{const marker="SECRET-SHOULD-NOT-BE-LOGGED";const r=parseDegradationSnapshot(change("mechanisms",[{...fixture().mechanisms[0],state:marker}]));expect(r.ok).toBe(false);if(!r.ok)expect(r.issues.join(" ")).not.toContain(marker);});
});

describe("DGM derived presentation helpers",()=>{
  it("filters names, codes and categories case-insensitively",()=>{const mechanisms=accepted().mechanisms;expect(filterMechanisms(mechanisms,{search:"TEST general",state:"ALL",category:"ALL"}).map(m=>m.id)).toEqual(["m1"]);});
  it("distinguishes draft and active library states",()=>{const mechanisms=accepted().mechanisms;expect(filterMechanisms(mechanisms,{search:"",state:"DRAFT",category:"ALL"}).map(m=>m.id)).toEqual(["m2"]);});
  it("filters exact categories",()=>{const mechanisms=accepted().mechanisms;expect(filterMechanisms(mechanisms,{search:"",state:"ALL",category:"Cracking"}).map(m=>m.id)).toEqual(["m2"]);});
  it("does not change the supplied library ordering",()=>{const mechanisms=accepted().mechanisms;filterMechanisms(mechanisms,{search:"",state:"ALL",category:"ALL"});expect(mechanisms.map(m=>m.id)).toEqual(["m1","m2"]);});
  it("returns a cross-referenced assessment without borrowing other assessments",()=>{const s=accepted();const c=getAssessmentContext(s,"a1");expect(c?.evidence).toHaveLength(1);expect(c?.applicability).toHaveLength(1);expect(c?.barrierInstances).toHaveLength(1);expect(c?.monitoringLinks).toHaveLength(1);expect(getAssessmentContext(s,"absent")).toBeNull();});
});
