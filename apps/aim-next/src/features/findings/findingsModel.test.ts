import { describe, expect, it } from "vitest";
import { ASSESSMENT_STATES, CASE_STATES, DISPOSITION_KINDS, DISPOSITION_STATES, EMPTY_FINDINGS, FINDING_STATES, MONITORING_STATES, SEVERITIES, filterFindings, findingsCaseContext, parseFindingsSnapshot } from "./findingsModel";
import { F0, F1, F2, findingsFixture } from "./findingsFixtures.test-utils";
type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? {-readonly [K in keyof T]:Mutable<T[K]>} : T;
const fixture=():Mutable<ReturnType<typeof findingsFixture>>=>structuredClone(findingsFixture()) as Mutable<ReturnType<typeof findingsFixture>>;
const accepted=()=>{const r=parseFindingsSnapshot(fixture());expect(r.ok).toBe(true);if(!r.ok)throw Error("Test fixture failed validation");return r.snapshot;};
const invalid=(mutator:(f:ReturnType<typeof fixture>)=>void)=>{const f=fixture();mutator(f);const r=parseFindingsSnapshot(f);expect(r.ok).toBe(false);if(!r.ok)expect(r.issues.length).toBeGreaterThan(0);};
const closure=(f:ReturnType<typeof fixture>)=>{f.cases[0]!.status="CLOSED";f.cases[0]!.closure={decisionAt:"2026-06-01T00:00:00Z",basisRef:"test-independent-closure-decision",authorizedByRef:"test-authorized-reviewer",verificationRef:"test-closure-evidence"};};

describe("FND complete snapshot boundary",()=>{
 it("accepts synthetic source-backed finding, case and disposition",()=>{const s=accepted();expect(s.findings).toHaveLength(2);expect(s.cases).toHaveLength(1);});
 it("accepts authorized empty snapshot without inventing cases",()=>{const r=parseFindingsSnapshot(EMPTY_FINDINGS);expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.cases).toHaveLength(0);});
 it.each([null,undefined,false,0,"case",[],{},new Date(),{findings:[]}])("rejects noncanonical snapshot root %#",(x:unknown)=>{expect(parseFindingsSnapshot(x).ok).toBe(false);});
 it.each(["findings","cases","assessments","dispositions","monitoring"] as const)("rejects non-array %s",(key: "findings"|"cases"|"assessments"|"dispositions"|"monitoring")=>invalid(f=>{(f as Record<string,unknown>)[key]={};}));
 it("rejects unexpected root key",()=>{expect(parseFindingsSnapshot({...fixture(),untrustedSession:"test"}).ok).toBe(false);});
 it("rejects unexpected finding fields",()=>invalid(f=>Object.assign(f.findings[0]!,{stateDecision:"SAFE"})));
 it("rejects unexpected closure fields",()=>invalid(f=>{closure(f);Object.assign(f.cases[0]!.closure!,{completedWorkOrder:true});}));
 it("sanitizes issue messages rather than echoing input",()=>{const f=fixture();Object.assign(f.findings[0]!,{unexpected:"SECRET_TEST_INPUT"});const r=parseFindingsSnapshot(f);expect(r.ok).toBe(false);if(!r.ok)expect(r.issues.join(" ")).not.toContain("SECRET_TEST_INPUT");});
 it("freezes parsed copies, not caller-owned records",()=>{const f=fixture();const r=parseFindingsSnapshot(f);expect(r.ok).toBe(true);if(r.ok){expect(Object.isFrozen(r.snapshot)).toBe(true);expect(Object.isFrozen(r.snapshot.findings[0])).toBe(true);expect(Object.isFrozen(r.snapshot.cases[0]?.findingIds)).toBe(true);expect(Object.isFrozen(r.snapshot.assessments[0]?.evidenceRefs)).toBe(true);}expect(Object.isFrozen(f.findings[0])).toBe(false);});
 it("rejects duplicate cross-collection IDs",()=>invalid(f=>{f.dispositions[0]!.id="finding-test-1";}));
 it("rejects duplicate finding codes",()=>invalid(f=>{f.findings.push({...f.findings[1]!,id:"additional-test",code:"TEST-FND-001"});}));
 it("rejects duplicate case codes",()=>invalid(f=>{f.cases.push({...f.cases[0]!,id:"additional-case"});}));
});

describe("FND observation and validation identity",()=>{
 it.each(FINDING_STATES)("accepts canonical finding state %s",(state:typeof FINDING_STATES[number])=>{const f=fixture();f.findings[1]!.status=state;if(state==="VALIDATED"){f.findings[1]!.evidenceRefs=["test-new-evidence"];f.findings[1]!.validatedAt=F1;f.findings[1]!.validationBasisRef="test-basis";}expect(parseFindingsSnapshot(f).ok).toBe(true);});
 it.each(SEVERITIES)("preserves severity %s",(severity:typeof SEVERITIES[number])=>{const f=fixture();f.findings[1]!.severity=severity;expect(parseFindingsSnapshot(f).ok).toBe(true);});
 it("rejects unsupported severe-sounding classification",()=>invalid(f=>{f.findings[1]!.severity="SAFE" as never;}));
 it("rejects validated finding without evidence",()=>invalid(f=>{f.findings[0]!.evidenceRefs=[];}));
 it("rejects validated finding without timestamp",()=>invalid(f=>{delete f.findings[0]!.validatedAt;}));
 it("rejects validated finding without validation basis",()=>invalid(f=>{delete f.findings[0]!.validationBasisRef;}));
 it("keeps an unreviewed observation without evidence unvalidated",()=>{const s=accepted();expect(s.findings[1]?.status).toBe("TRIAGE_PENDING");expect(s.findings[1]?.evidenceRefs).toHaveLength(0);});
 it("rejects missing source record provenance",()=>invalid(f=>{f.findings[0]!.sourceRecordRef="";}));
 it("rejects missing asset identity",()=>invalid(f=>{f.findings[0]!.assetId="";}));
 it("rejects invalid observed date",()=>invalid(f=>{f.findings[0]!.observedAt="2026-02-30T00:00:00Z";}));
 it("rejects missing timezone",()=>invalid(f=>{f.findings[0]!.observedAt="2026-03-01";}));
 it("rejects duplicate evidence IDs",()=>invalid(f=>{f.findings[0]!.evidenceRefs=["test-evidence-1","test-evidence-1"];}));
 it("rejects duplicate finding identifiers",()=>invalid(f=>{f.findings.push({...f.findings[1]!});}));
 it("allows independent source observations with unknown severity",()=>{const s=accepted();expect(s.findings[1]?.severity).toBe("UNKNOWN");});
});

describe("FND case identity and links",()=>{
 it.each(CASE_STATES)("validates case state %s with required transition basis",(state:typeof CASE_STATES[number])=>{const f=fixture();f.cases[0]!.status=state;if(state==="CLOSED"||state==="REOPENED")closure(f);if(state==="REOPENED"){f.cases[0]!.status="REOPENED";f.cases[0]!.reopenedAt="2026-07-01T00:00:00Z";f.cases[0]!.reopenBasisRef="test-reopen-review";}expect(parseFindingsSnapshot(f).ok).toBe(true);});
 it("rejects case linked to pending finding",()=>invalid(f=>{f.cases[0]!.findingIds=["finding-test-2"];}));
 it("rejects case linked to a finding on another asset",()=>invalid(f=>{f.findings[0]!.assetId="TEST-ASSET-2";}));
 it("rejects absent linked finding",()=>invalid(f=>{f.cases[0]!.findingIds=["unknown-finding"];}));
 it("rejects empty case finding list",()=>invalid(f=>{f.cases[0]!.findingIds=[];}));
 it("rejects duplicate linked finding",()=>invalid(f=>{f.cases[0]!.findingIds=["finding-test-1","finding-test-1"];}));
 it("rejects missing assessment link",()=>invalid(f=>{f.cases[0]!.assessmentId="unknown";}));
 it("rejects wrong-case assessment link",()=>invalid(f=>{f.assessments[0]!.caseId="wrong-case";}));
 it("rejects missing disposition link",()=>invalid(f=>{f.cases[0]!.dispositionId="unknown";}));
 it("rejects disposition from another case",()=>invalid(f=>{f.dispositions[0]!.caseId="other-case";}));
 it("preserves work links without making them closure evidence",()=>{const s=accepted();expect(s.cases[0]?.actionRefs).toContain("test-action-1");expect(s.cases[0]?.status).toBe("MONITORING");});
 it("rejects duplicate action references",()=>invalid(f=>{f.cases[0]!.actionRefs=["work","work"];}));
 it("does not synthesize closure from linked recommendations",()=>{const s=accepted();expect(s.cases[0]?.recommendationRefs).toHaveLength(1);expect(s.cases[0]?.closure).toBeUndefined();});
});

describe("FND assessment, authorization and independent closure",()=>{
 it.each(ASSESSMENT_STATES)("accepts assessment state %s under its basis requirements",(state:typeof ASSESSMENT_STATES[number])=>{const f=fixture();f.assessments[0]!.status=state;if(state!=="APPROVED"){f.dispositions[0]!.status="PROPOSED";}expect(parseFindingsSnapshot(f).ok).toBe(true);});
 it("rejects approved assessment without evidence",()=>invalid(f=>{f.assessments[0]!.evidenceRefs=[];}));
 it("rejects approved assessment without approval date",()=>invalid(f=>{delete f.assessments[0]!.approvedAt;}));
 it("rejects approved assessment without approval basis",()=>invalid(f=>{delete f.assessments[0]!.approvalBasisRef;}));
 it("rejects approved assessment using evidence unlinked to findings",()=>invalid(f=>{f.assessments[0]!.evidenceRefs=["unknown-evidence"];}));
 it("rejects missing assessment technical basis",()=>invalid(f=>{f.assessments[0]!.basisRef="";}));
 it("rejects assessment without case",()=>invalid(f=>{f.assessments[0]!.caseId="unknown";}));
 it.each(DISPOSITION_KINDS)("preserves disposition type %s",(kind:typeof DISPOSITION_KINDS[number])=>{const f=fixture();f.dispositions[0]!.kind=kind;expect(parseFindingsSnapshot(f).ok).toBe(true);});
 it.each(DISPOSITION_STATES)("accepts controlled disposition state %s",(state:typeof DISPOSITION_STATES[number])=>{const f=fixture();f.dispositions[0]!.status=state;expect(parseFindingsSnapshot(f).ok).toBe(true);});
 it("rejects authorized disposition without timestamp",()=>invalid(f=>{delete f.dispositions[0]!.authorizedAt;}));
 it("rejects authorized disposition from unapproved assessment",()=>invalid(f=>{f.assessments[0]!.status="IN_REVIEW";}));
 it("rejects disposition referencing another assessment",()=>invalid(f=>{f.dispositions[0]!.assessmentId="wrong";}));
 it("rejects a condition case marked closed solely because linked work exists",()=>invalid(f=>{f.cases[0]!.status="CLOSED";}));
 it("accepts closed case with independent authorization and verification",()=>{const f=fixture();closure(f);const r=parseFindingsSnapshot(f);expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.cases[0]?.status).toBe("CLOSED");});
 it("rejects closure if disposition is merely proposed",()=>invalid(f=>{closure(f);f.dispositions[0]!.status="PROPOSED";}));
 it("rejects closure if assessment no longer approved",()=>invalid(f=>{closure(f);f.assessments[0]!.status="DRAFT";}));
 it("rejects closure without a verification reference",()=>invalid(f=>{closure(f);f.cases[0]!.closure!.verificationRef="";}));
 it("rejects closure without a separate reviewer reference",()=>invalid(f=>{closure(f);f.cases[0]!.closure!.authorizedByRef="";}));
 it("rejects closure dated before disposition authorization",()=>invalid(f=>{closure(f);f.cases[0]!.closure!.decisionAt=F1;}));
 it("rejects reopened case without reopened timestamp",()=>invalid(f=>{closure(f);f.cases[0]!.status="REOPENED";f.cases[0]!.reopenBasisRef="test-reopen-review";}));
 it("rejects reopened case without reopen basis",()=>invalid(f=>{closure(f);f.cases[0]!.status="REOPENED";f.cases[0]!.reopenedAt="2026-07-01T00:00:00Z";}));
 it("rejects reopen date preceding original closure",()=>invalid(f=>{closure(f);f.cases[0]!.status="REOPENED";f.cases[0]!.reopenedAt=F0;f.cases[0]!.reopenBasisRef="test-reopen-review";}));
 it("preserves historical closure after an authorized reopen",()=>{const f=fixture();closure(f);f.cases[0]!.status="REOPENED";f.cases[0]!.reopenedAt="2026-07-01T00:00:00Z";f.cases[0]!.reopenBasisRef="test-reopen-review";const r=parseFindingsSnapshot(f);expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.cases[0]?.closure?.basisRef).toBe("test-independent-closure-decision");});
 it("rejects an invalid closure calendar day",()=>invalid(f=>{closure(f);f.cases[0]!.closure!.decisionAt="2026-02-30T00:00:00Z";}));
});

describe("FND monitoring, read-only inspection and filtering",()=>{
 it.each(MONITORING_STATES)("preserves monitoring state %s",(state:typeof MONITORING_STATES[number])=>{const f=fixture();f.monitoring[0]!.status=state;expect(parseFindingsSnapshot(f).ok).toBe(true);});
 it("rejects monitoring pointing at an absent case",()=>invalid(f=>{f.monitoring[0]!.caseId="unknown";}));
 it("rejects monitoring with missing source",()=>invalid(f=>{f.monitoring[0]!.sourceRef="";}));
 it("searches case-insensitively across location and description",()=>{const s=accepted();expect(filterFindings(s.findings,"localized test nozzle")).toHaveLength(1);});
 it("filters severity independently from validation status",()=>{const s=accepted();expect(filterFindings(s.findings,"","VALIDATED","UNKNOWN")).toHaveLength(0);});
 it("keeps unknown severity distinct from low",()=>{const s=accepted();expect(filterFindings(s.findings,"","ALL","UNKNOWN")).toHaveLength(1);});
 it("does not return unrelated findings",()=>{const s=accepted();expect(filterFindings(s.findings,"not-present")).toHaveLength(0);});
 it("trims multiple search terms",()=>{const s=accepted();expect(filterFindings(s.findings,"  TEST-FND-001 TEST-ASSET-1 ")).toHaveLength(1);});
 it("resolves linked findings, assessment, disposition and monitoring separately",()=>{const s=accepted();const c=findingsCaseContext(s,"case-test-1");expect(c.findings).toHaveLength(1);expect(c.assessment?.status).toBe("APPROVED");expect(c.disposition?.status).toBe("AUTHORIZED");expect(c.monitoring).toHaveLength(1);});
 it("missing case context does not assume a closed condition",()=>{const s=accepted();const c=findingsCaseContext(s,"none");expect(c.record).toBeUndefined();expect(c.findings).toHaveLength(0);});
 it("keeps the finding observation date and approved assessment time separate",()=>{const s=accepted();expect(s.findings[0]?.observedAt).toBe(F0);expect(s.assessments[0]?.approvedAt).toBe(F2);});
});
