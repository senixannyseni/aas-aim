import { describe, expect, it } from "vitest";
import { EMPTY_RBI, DATA_QUALITY, INPUT_CATEGORIES, RBI_STATES, RESULT_KINDS, RESULT_STATES, STRATEGY_STATES, filterRbiAssessments, parseRbiSnapshot, rbiAssessmentContext, rbiDueCandidate, type RbiAssessment } from "./rbiModel";
import { rbiFixture, T0, T1, T2 } from "./rbiFixtures.test-utils";

type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? {-readonly [K in keyof T]: Mutable<T[K]>} : T;
const copy=():Mutable<ReturnType<typeof rbiFixture>>=>structuredClone(rbiFixture()) as Mutable<ReturnType<typeof rbiFixture>>;
const bad=(mutate:(f:ReturnType<typeof copy>)=>void)=>{const f=copy();mutate(f);const result=parseRbiSnapshot(f);expect(result.ok).toBe(false);if(!result.ok)expect(result.issues.length).toBeGreaterThan(0);};
const approved=()=>{const result=parseRbiSnapshot(copy());expect(result.ok).toBe(true);if(!result.ok)throw Error("Synthetic fixture failed validation");return result.snapshot;};

describe("RBI frontend — complete snapshot boundary",()=>{
 it("accepts a complete synthetic approved assessment",()=>{const x=approved();expect(x.assessments).toHaveLength(1);expect(x.results).toHaveLength(5);});
 it("accepts an explicit empty, authorized snapshot",()=>{const x=structuredClone(EMPTY_RBI);const r=parseRbiSnapshot(x);expect(r.ok).toBe(true);});
 it.each([null,undefined,[],false,"risk",42,{},new Date(),{assessments:[],results:[]}])("rejects noncanonical root %#",(x:unknown)=>{expect(parseRbiSnapshot(x).ok).toBe(false);});
 const ROOT_ARRAY_KEYS = ["assessments","inputSets","results","strategies","scenarios"] as const;
 it.each(ROOT_ARRAY_KEYS)("rejects a non-array %s",(key:typeof ROOT_ARRAY_KEYS[number])=>{const f=copy();(f as Record<string,unknown>)[key]={};expect(parseRbiSnapshot(f).ok).toBe(false);});
 it("rejects unexpected root fields",()=>{expect(parseRbiSnapshot({...copy(),tenantId:"not-trusted"}).ok).toBe(false);});
 it("rejects extra fields within records",()=>bad(f=>{Object.assign(f.assessments[0]!,{authoritativeSafetyDecision:true});}));
 it("does not expose arbitrary rejected content in issues",()=>{const f=copy();f.assessments[0]!.code="UNTRUSTED_SECRET_TEXT";Object.assign(f.assessments[0]!,{unknownKey:"PRIVATE"});const r=parseRbiSnapshot(f);expect(r.ok).toBe(false);if(!r.ok)expect(r.issues.join(" ")).not.toContain("PRIVATE");});
 it("freezes output arrays and records without freezing source input",()=>{const f=copy();const o=approved();expect(Object.isFrozen(o.assessments)).toBe(true);expect(Object.isFrozen(o.assessments[0])).toBe(true);expect(Object.isFrozen(o.inputSets[0]?.inputs[0])).toBe(true);expect(Object.isFrozen(o.scenarios[0]?.results[0])).toBe(true);expect(Object.isFrozen(f.assessments[0])).toBe(false);});
 it("rejects duplicate ids within a collection",()=>bad(f=>f.results.push({...f.results[0]!,kind:"COF"})));
 it("rejects duplicate ids across collections",()=>bad(f=>{f.strategies[0]!.id="res-due";}));
 it("rejects a missing cross-domain field instead of fabricating status",()=>bad(f=>{delete (f.assessments[0] as unknown as Record<string,unknown>).quality;}));
 it("does not interpret missing source data as acceptable risk",()=>{const result=parseRbiSnapshot(EMPTY_RBI);expect(result.ok).toBe(true);expect(rbiDueCandidate(EMPTY_RBI,"rbi-absent")).toBeUndefined();});
});

describe("RBI assessment revision and frozen inputs",()=>{
 it.each(RBI_STATES)("accepts configured %s assessment states under appropriate basis",(state:RbiAssessment["status"])=>{const f=copy();f.assessments[0]!.status=state;if(state==="REASSESSMENT_REQUIRED")f.assessments[0]!.reassessmentReason="Synthetic changed basis";if(state==="DRAFT"||state==="IN_REVIEW"){f.results.forEach(x=>{x.state="CALCULATED";});f.strategies[0]!.status="PROPOSED";}expect(parseRbiSnapshot(f).ok).toBe(true);});
 it("rejects unsupported approval label",()=>bad(f=>{f.assessments[0]!.status="AUTHORIZED" as never;}));
 it("requires assessed timestamp for approved record",()=>bad(f=>{delete f.assessments[0]!.assessedAt;}));
 it("requires approved timestamp for approved record",()=>bad(f=>{delete f.assessments[0]!.approvedAt;}));
 it("requires approval basis for approved record",()=>bad(f=>{delete f.assessments[0]!.approvalBasisReference;}));
 it("rejects approved assessment on draft input set",()=>bad(f=>{f.inputSets[0]!.status="DRAFT";}));
 it("rejects approved assessment with empty frozen set",()=>bad(f=>{f.inputSets[0]!.inputs=[];}));
 it("rejects reassessment-required without a basis",()=>bad(f=>{f.assessments[0]!.status="REASSESSMENT_REQUIRED";}));
 it("preserves reassessment reason without inventing a new approval",()=>{const f=copy();f.assessments[0]!.status="REASSESSMENT_REQUIRED";f.assessments[0]!.reassessmentReason="Synthetic change";const r=parseRbiSnapshot(f);expect(r.ok).toBe(true);});
 it("rejects absent input-set reference",()=>bad(f=>{f.assessments[0]!.inputSetId="missing";}));
 it("rejects cross-assessment input sets",()=>bad(f=>{f.inputSets[0]!.assessmentId="different-assessment";}));
 it("rejects a missing input set freeze timestamp",()=>bad(f=>{delete f.inputSets[0]!.frozenAt;}));
 it("rejects duplicated source-input ids",()=>bad(f=>f.inputSets[0]!.inputs.push({...f.inputSets[0]!.inputs[0]!})));
 it.each(INPUT_CATEGORIES)("recognizes input category %s",(category:typeof INPUT_CATEGORIES[number])=>{const f=copy();f.inputSets[0]!.inputs[0]!.category=category;expect(parseRbiSnapshot(f).ok).toBe(true);});
 it.each(DATA_QUALITY)("preserves independent source quality %s",(quality:typeof DATA_QUALITY[number])=>{const f=copy();f.inputSets[0]!.inputs[0]!.quality=quality;expect(parseRbiSnapshot(f).ok).toBe(true);});
 it("rejects an invalid calendar date",()=>bad(f=>{f.assessments[0]!.approvedAt="2026-02-30T00:00:00Z";}));
 it("rejects date missing timezone",()=>bad(f=>{f.assessments[0]!.approvedAt="2026-03-01";}));
});

describe("RBI calculations, provenance, and due-candidate ownership",()=>{
 it.each(RESULT_KINDS)("accepts source-backed result kind %s",(kind:typeof RESULT_KINDS[number])=>{const f=copy();f.results=f.results.filter(x=>x.id==="res-pof"||x.kind!==kind);f.results[0]!.kind=kind;if(kind==="DUE_CANDIDATE"){f.results[0]!.displayValue=T2;f.strategies[0]!.dueCandidateResultId="res-pof";}else if(["POF","COF","DAMAGE_FACTOR"].includes(kind))f.results[0]!.displayValue="0.01";expect(parseRbiSnapshot(f).ok).toBe(true);});
 it.each(RESULT_STATES)("keeps calculated/approved/projected %s distinct",(state:typeof RESULT_STATES[number])=>{const f=copy();f.results[0]!.state=state;expect(parseRbiSnapshot(f).ok).toBe(true);});

 it("rejects a nonnumeric probability rather than displaying fake engineering data",()=>bad(f=>{f.results[0]!.displayValue="totally safe";}));
 it("rejects a negative corrosion-independent damage factor",()=>bad(f=>{f.results[0]!.kind="DAMAGE_FACTOR";f.results[0]!.displayValue="-0.5";}));
 it("rejects duplicate result kinds for one assessment",()=>bad(f=>{f.results.push({...f.results[0]!,id:"new-risk-result"});}));
 it("rejects ambiguous parallel strategy records for one assessment",()=>bad(f=>{f.strategies.push({...f.strategies[0]!,id:"another-strategy"});}));
 it("rejects result with incorrect input-set reference",()=>bad(f=>{f.results[0]!.inputSetId="nonexistent";}));
 it("rejects result pointing to a different assessment",()=>bad(f=>{f.results[0]!.assessmentId="wrong";}));
 it("rejects approved result on a draft assessment",()=>bad(f=>{f.assessments[0]!.status="DRAFT";}));
 it("rejects missing result trace",()=>bad(f=>{f.results[0]!.basisReference="";}));
 it("rejects malformed due candidate",()=>bad(f=>{f.results[4]!.displayValue="2027-02-30T00:00:00Z";}));
 it("rejects result approval without a frozen input set",()=>bad(f=>{f.inputSets[0]!.status="DRAFT";f.assessments[0]!.status="DRAFT";}));
 it("shows RBI due candidate but never creates an INS governing date",()=>{const v=approved();expect(rbiDueCandidate(v,"rbi-test-1")?.displayValue).toBe(T2);expect(Object.keys(rbiDueCandidate(v,"rbi-test-1")!)).not.toContain("technicalDueAt");});
 it("distinguishes approved current risk from projected future risk",()=>{const v=approved();expect(v.results.find(x=>x.kind==="CURRENT_RISK")?.state).toBe("APPROVED");expect(v.results.find(x=>x.kind==="FUTURE_RISK")?.state).toBe("PROJECTED");});
 it("returns no candidate if only a current risk result is present",()=>{const f=copy();f.results=f.results.filter(x=>x.kind!=="DUE_CANDIDATE");delete f.strategies[0]!.dueCandidateResultId;const r=parseRbiSnapshot(f);expect(r.ok).toBe(true);if(r.ok)expect(rbiDueCandidate(r.snapshot,"rbi-test-1")).toBeUndefined();});
 it("rejects wrong-kind due candidate linked by strategy",()=>bad(f=>{f.strategies[0]!.dueCandidateResultId="res-cof";}));
 it("rejects strategy linked to absent candidate",()=>bad(f=>{f.strategies[0]!.dueCandidateResultId="nonexistent";}));
});

describe("RBI strategy and strictly non-authoritative scenarios",()=>{
 it.each(STRATEGY_STATES)("accepts strategy state %s when structurally valid",(state:typeof STRATEGY_STATES[number])=>{const f=copy();f.strategies[0]!.status=state;expect(parseRbiSnapshot(f).ok).toBe(true);});
 it("rejects strategy coverage exceeding 100 percent",()=>bad(f=>{f.strategies[0]!.targetCoveragePercent=101;}));
 it("rejects unapproved assessment with approved strategy",()=>bad(f=>{f.assessments[0]!.status="DRAFT";f.strategies[0]!.status="APPROVED";}));
 it("requires approved strategy timestamp",()=>bad(f=>{delete f.strategies[0]!.approvedAt;}));
 it("rejects scenario masquerading as approved",()=>bad(f=>{f.scenarios[0]!.status="APPROVED" as never;}));
 it("rejects scenario with invalid base revision",()=>bad(f=>{f.scenarios[0]!.basedOnRevision="old-revision";}));
 it("rejects scenario result without trace",()=>bad(f=>{f.scenarios[0]!.results[0]!.basisReference="";}));
 it("rejects duplicate result within a scenario",()=>bad(f=>f.scenarios[0]!.results.push({...f.scenarios[0]!.results[0]!})));
 it("scenario results are not authoritative risk results",()=>{const v=approved();expect(v.scenarios[0]?.status).toBe("SCENARIO");expect(v.scenarios[0]?.results[0]?.displayValue).toBe("LOW");expect(v.results.find(x=>x.id==="scenario-result-1")).toBeUndefined();});
 it("allows a scenario to have no calculated results",()=>{const f=copy();f.scenarios[0]!.results=[];expect(parseRbiSnapshot(f).ok).toBe(true);});
 it("keeps a change summary source-backed",()=>{const v=approved();expect(v.scenarios[0]?.changeSummary).toContain("Synthetic change");});
});

describe("RBI read-only search and navigation models",()=>{
 it("search is case-insensitive across asset, methodology and revision",()=>{const v=approved();expect(filterRbiAssessments(v.assessments,"test-equipment method-v1")).toHaveLength(1);});
 it("filters assessment state independently",()=>{const v=approved();expect(filterRbiAssessments(v.assessments,"", "DRAFT")).toHaveLength(0);});
 it("missing terms return no records",()=>{const v=approved();expect(filterRbiAssessments(v.assessments,"not-a-real-asset")).toHaveLength(0);});
 it("trims whitespace",()=>{const v=approved();expect(filterRbiAssessments(v.assessments,"  TEST-RBI-001  ")).toHaveLength(1);});
 it("context returns source set and separate risk results",()=>{const v=approved();const c=rbiAssessmentContext(v,"rbi-test-1");expect(c.inputSet?.status).toBe("FROZEN");expect(c.results).toHaveLength(5);expect(c.scenarios).toHaveLength(1);});
 it("unknown context returns no records",()=>{const v=approved();const c=rbiAssessmentContext(v,"none");expect(c.assessment).toBeUndefined();expect(c.results).toHaveLength(0);});
 it("keeps the test timestamps independent of the current date",()=>{expect(Date.parse(T1)).toBeGreaterThan(Date.parse(T0));});
});
