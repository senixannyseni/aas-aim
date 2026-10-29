import {describe,it,expect} from "vitest";
import {EMPTY_RECOMMENDATIONS, EXECUTION_KINDS, EXECUTION_STATES, RECOMMENDATION_BASIS, RECOMMENDATION_PRIORITIES, RECOMMENDATION_STATES, VERIFICATION_STATES, filterRecommendations, parseRecommendationsSnapshot, recommendationContext, type RecommendationsSnapshot} from "./recommendationsModel";
import {R0,R1,R2,R3,R4,R5,recommendationsFixture,closedRecommendationsFixture} from "./recommendationsFixtures.test-utils";
type Mutable<T>=T extends readonly (infer U)[]?Mutable<U>[]:T extends object?{-readonly [K in keyof T]:Mutable<T[K]>}:T;
type Editable=Mutable<RecommendationsSnapshot>;
const fixture=():Editable=>structuredClone(recommendationsFixture()) as Editable;
const closed=():Editable=>structuredClone(closedRecommendationsFixture()) as Editable;
const parse=(f:Editable)=>parseRecommendationsSnapshot(f);
const rejected=(edit:(f:Editable)=>void)=>{const f=fixture();edit(f);const result=parse(f);expect(result.ok).toBe(false);};
const accepted=(edit:(f:Editable)=>void)=>{const f=fixture();edit(f);const result=parse(f);expect(result.ok).toBe(true);};

describe("REC snapshot boundary and records",()=>{
 it("accepts source-backed approved and draft recommendations",()=>{const r=parse(fixture());expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.recommendations).toHaveLength(2);});
 it("accepts empty externally supplied records",()=>{const r=parseRecommendationsSnapshot(EMPTY_RECOMMENDATIONS);expect(r.ok).toBe(true);});
 it("rejects null and undefined",()=>{expect(parseRecommendationsSnapshot(null).ok).toBe(false);expect(parseRecommendationsSnapshot(undefined).ok).toBe(false);});
 it("rejects arrays and strings as snapshots",()=>{expect(parseRecommendationsSnapshot([]).ok).toBe(false);expect(parseRecommendationsSnapshot("trusted").ok).toBe(false);});
 it("rejects missing root collection",()=>{const f=fixture() as unknown as Record<string,unknown>;delete f.fulfillment;expect(parseRecommendationsSnapshot(f).ok).toBe(false);});
 it("rejects unexpected root properties",()=>{expect(parseRecommendationsSnapshot({...fixture(),tenantAuthorized:true}).ok).toBe(false);});
 it("rejects non-array root collection",()=>{expect(parseRecommendationsSnapshot({...fixture(),closeout:{}}).ok).toBe(false);});
 it("rejects extra keys in recommendation",()=>rejected(f=>{Object.assign(f.recommendations[0]!,{safetyApproved:true});}));
 it("rejects extra fields within requirements",()=>rejected(f=>{Object.assign(f.requirements[0]!,{treatAsCompleted:true});}));
 it("does not leak untrusted record values through errors",()=>{const f=fixture();f.recommendations[0]!.title="private-secret";Object.assign(f.recommendations[0]!,{extra:"PRIVATE_PAYLOAD"});const r=parse(f);expect(r.ok).toBe(false);if(!r.ok)expect(r.issues.join(" ")).not.toContain("PRIVATE_PAYLOAD");});
 it("does not freeze caller-owned arrays or records",()=>{const f=fixture();const r=parse(f);expect(Object.isFrozen(f.recommendations[0])).toBe(false);expect(Object.isFrozen(f.fulfillment[0]?.verificationEvidenceRefs)).toBe(false);if(r.ok){expect(Object.isFrozen(r.snapshot.recommendations)).toBe(true);expect(Object.isFrozen(r.snapshot.recommendations[0])).toBe(true);expect(Object.isFrozen(r.snapshot.fulfillment[0]?.verificationEvidenceRefs)).toBe(true);}});
 it("rejects duplicate recommendation IDs",()=>rejected(f=>{f.recommendations.push({...f.recommendations[0]!,code:"new-code"});}));
 it("rejects duplicate recommendation codes",()=>rejected(f=>{f.recommendations[1]!.code=f.recommendations[0]!.code;}));
 it("rejects IDs duplicated across object families",()=>rejected(f=>{f.requirements[0]!.id="rec-test-1";}));
 it("rejects whitespace-only technical basis",()=>rejected(f=>{f.recommendations[0]!.technicalBasisRef=" ";}));
 it("rejects control characters in asset identity",()=>rejected(f=>{f.recommendations[0]!.assetId="bad\nasset";}));
 it("rejects very large text",()=>rejected(f=>{f.recommendations[0]!.title="x".repeat(2501);}));
 it("rejects an invalid calendar date",()=>rejected(f=>{f.recommendations[0]!.createdAt="2026-02-30T00:00:00Z";}));
 it("rejects timestamp without timezone",()=>rejected(f=>{f.recommendations[0]!.createdAt="2026-02-10";}));
 it("rejects malformed timezone",()=>rejected(f=>{f.recommendations[0]!.createdAt="2026-02-10T00:00:00+19:00";}));
 it("rejects unexpected lifecycle fields",()=>rejected(f=>{Object.assign(f.recommendations[0]!,{lifecycleDecision:{kind:"WITHDRAW",decisionAt:R3,basisRef:"test",authorityRef:"test",dangerous:true}});}));
});

describe("REC approved basis, requirements, and owner",()=>{
 it.each(RECOMMENDATION_BASIS)("preserves canonical source domain %s",(basis:typeof RECOMMENDATION_BASIS[number])=>accepted(f=>{f.recommendations[0]!.technicalBasisDomain=basis;}));
 it.each(RECOMMENDATION_PRIORITIES)("preserves priority %s",(priority:typeof RECOMMENDATION_PRIORITIES[number])=>accepted(f=>{f.recommendations[0]!.priority=priority;}));
 it.each(["DRAFT","IN_REVIEW","APPROVED"] as const)("allows review state %s with matching lifecycle provenance",(status:typeof RECOMMENDATION_STATES[number])=>accepted(f=>{f.recommendations[0]!.status=status;if(status!=="APPROVED"){delete f.recommendations[0]!.approvedAt;delete f.recommendations[0]!.approvalBasisRef;delete f.recommendations[0]!.approvedRevision;f.requirements=[];f.accountability=[];f.execution=[];f.fulfillment=[];}}));
 it("rejects draft with stale approved metadata",()=>rejected(f=>{f.recommendations[0]!.status="DRAFT";}));
 it("rejects unsupported priority",()=>rejected(f=>{f.recommendations[0]!.priority="SAFE" as never;}));
 it("rejects invented approval state",()=>rejected(f=>{f.recommendations[0]!.status="AUTO_APPROVED" as never;}));
 it("rejects missing approval timestamp for APPROVED",()=>rejected(f=>{delete f.recommendations[0]!.approvedAt;}));
 it("rejects missing approval basis for APPROVED",()=>rejected(f=>{delete f.recommendations[0]!.approvalBasisRef;}));
 it("rejects missing approved revision",()=>rejected(f=>{delete f.recommendations[0]!.approvedRevision;}));
 it("rejects approval predating creation",()=>rejected(f=>{f.recommendations[0]!.approvedAt="2026-02-09T08:00:00Z";}));
 it("rejects an approved recommendation without requirements",()=>rejected(f=>{f.requirements=[];f.fulfillment=[];}));
 it("rejects an approved recommendation without accountability",()=>rejected(f=>{f.accountability=[];}));
 it("rejects missing acceptance criterion",()=>rejected(f=>{f.requirements[0]!.acceptanceCriterion="";}));
 it("rejects missing criterion provenance",()=>rejected(f=>{f.requirements[0]!.sourceBasisRef="";}));
 it("rejects duplicate accountability on a recommendation",()=>rejected(f=>{f.accountability.push({...f.accountability[0]!,id:"account-test-2"});}));
 it("rejects an orphan requirement",()=>rejected(f=>{f.requirements[0]!.recommendationId="not-present";}));
 it("rejects orphan accountability",()=>rejected(f=>{f.accountability[0]!.recommendationId="not-present";}));
 it("allows an unapproved draft with no requirement and no owner",()=>accepted(f=>{f.recommendations=f.recommendations.filter(x=>x.id==="rec-test-2");f.requirements=[];f.accountability=[];f.execution=[];f.fulfillment=[];f.closeout=[];}));
 it("preserves unknown priority as distinct from LOW",()=>{const r=parse(fixture());if(r.ok)expect(r.snapshot.recommendations[1]?.priority).toBe("UNKNOWN");});
 it("rejects invalid technical due date",()=>rejected(f=>{f.recommendations[0]!.technicalDueAt="2027-13-01T00:00:00Z";}));
});

describe("REC work execution is not technical fulfillment",()=>{
 it.each(EXECUTION_KINDS)("accepts linked execution kind %s",(kind:typeof EXECUTION_KINDS[number])=>accepted(f=>{f.execution[0]!.kind=kind;}));
 it.each(EXECUTION_STATES)("accepts work state %s separately",(state:typeof EXECUTION_STATES[number])=>accepted(f=>{f.execution[0]!.state=state;}));
 it("rejects an absent execution record reference",()=>rejected(f=>{f.execution[0]!.externalRecordRef="";}));
 it("rejects work linked to missing recommendation",()=>rejected(f=>{f.execution[0]!.recommendationId="not-present";}));
 it("allows completed CMMS work with unverified acceptance criterion",()=>{const r=parse(fixture());expect(r.ok).toBe(true);if(r.ok){expect(r.snapshot.execution[0]?.state).toBe("COMPLETED");expect(r.snapshot.fulfillment[1]?.state).toBe("PENDING");expect(r.snapshot.recommendations[0]?.status).toBe("APPROVED");}});
 it("allows work to be absent without silently completing criteria",()=>accepted(f=>{f.execution=[];}));
 it("does not turn execution into a closeout record",()=>{const r=parse(fixture());if(r.ok)expect(r.snapshot.closeout).toHaveLength(0);});
 it("does not infer engineering due date from updated work order",()=>{const r=parse(fixture());if(r.ok)expect(r.snapshot.recommendations[0]?.technicalDueAt).toBe("2027-06-01T00:00:00Z");});
});

describe("REC independently verified criteria",()=>{
 it.each(VERIFICATION_STATES)("accepts properly structured verification state %s",(state:typeof VERIFICATION_STATES[number])=>accepted(f=>{f.fulfillment[0]!.state=state;if(state!=="VERIFIED"){delete f.fulfillment[0]!.verifiedAt;delete f.fulfillment[0]!.reviewerRef;}}));
 it("rejects pending verification with stale approval identity",()=>rejected(f=>{f.fulfillment[0]!.state="PENDING";}));
 it("rejects verification timestamp earlier than assessment",()=>rejected(f=>{f.fulfillment[0]!.verifiedAt=R1;}));
 it("requires verification evidence on VERIFIED state",()=>rejected(f=>{f.fulfillment[0]!.verificationEvidenceRefs=[];}));
 it("requires reviewer identity on VERIFIED state",()=>rejected(f=>{delete f.fulfillment[0]!.reviewerRef;}));
 it("requires a verification timestamp on VERIFIED state",()=>rejected(f=>{delete f.fulfillment[0]!.verifiedAt;}));
 it("rejects missing independent fulfillment assessment basis",()=>rejected(f=>{f.fulfillment[0]!.assessmentBasisRef="";}));
 it("rejects duplicate evidence references",()=>rejected(f=>{f.fulfillment[0]!.verificationEvidenceRefs=["test-verified-evidence-1","test-verified-evidence-1"];}));
 it("rejects orphan fulfillment assessment",()=>rejected(f=>{f.fulfillment[0]!.recommendationId="none";}));
 it("rejects fulfillment referencing missing requirement",()=>rejected(f=>{f.fulfillment[0]!.requirementId="none";}));
 it("rejects fulfillment assigned to another recommendation's requirement",()=>rejected(f=>{f.fulfillment[0]!.recommendationId="rec-test-2";}));
 it("rejects multiple fulfillment decisions for same requirement",()=>rejected(f=>{f.fulfillment.push({...f.fulfillment[0]!,id:"ful-test-3"});}));
 it("preserves pending assessment rather than inferring fulfilled",()=>{const r=parse(fixture());if(r.ok)expect(r.snapshot.fulfillment[1]?.state).toBe("PENDING");});
 it("allows a requirement with no fulfillment assessment",()=>accepted(f=>{f.fulfillment.pop();}));
});

describe("REC independent closeout and reopening",()=>{
 it("accepts independently verified and closed recommendation",()=>{const r=parse(closed());expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.recommendations[0]?.status).toBe("CLOSED");});
 it("rejects CLOSED without independent closeout",()=>rejected(f=>{f.recommendations[0]!.status="CLOSED";}));
 it("rejects closeout for a merely APPROVED recommendation",()=>rejected(f=>{f.closeout=closed().closeout;}));
 it("rejects closeout when requirements are unverified",()=>{const f=closed();f.fulfillment[1]!.state="PENDING";expect(parse(f).ok).toBe(false);});
 it("rejects closeout where verification happened after closure",()=>{const f=closed();f.fulfillment[1]!.verifiedAt=R5;expect(parse(f).ok).toBe(false);});
 it("rejects closeout without independent evidence",()=>{const f=closed();f.closeout[0]!.verificationEvidenceRefs=[];expect(parse(f).ok).toBe(false);});
 it("rejects closeout without authority reference",()=>{const f=closed();f.closeout[0]!.authorityRef="";expect(parse(f).ok).toBe(false);});
 it("rejects closeout on a different revision",()=>{const f=closed();f.closeout[0]!.recommendationRevision="not-approved-revision";expect(parse(f).ok).toBe(false);});
 it("rejects a closeout attached to unknown recommendation",()=>{const f=closed();f.closeout[0]!.recommendationId="missing";expect(parse(f).ok).toBe(false);});
 it("rejects a closeout dated before approval",()=>{const f=closed();f.closeout[0]!.decidedAt=R0;expect(parse(f).ok).toBe(false);});
 it("accepts reopened state preserving prior CLOSE then REOPEN",()=>{const f=closed();f.recommendations[0]!.status="REOPENED";f.closeout.push({id:"reopen-test-1",recommendationId:"rec-test-1",recommendationRevision:"rev-test-1",kind:"REOPEN",decidedAt:R5,decisionBasisRef:"test-reopen-basis",authorityRef:"test-reopen-authority",verificationEvidenceRefs:["test-reopening-evidence"]});expect(parse(f).ok).toBe(true);});
 it("rejects REOPENED without reopening decision",()=>{const f=closed();f.recommendations[0]!.status="REOPENED";expect(parse(f).ok).toBe(false);});
 it("rejects CLOSE preceded by REOPEN",()=>{const f=closed();f.closeout[0]!.kind="REOPEN";expect(parse(f).ok).toBe(false);});
 it("rejects two CLOSE decisions masquerading as reopen",()=>{const f=closed();f.recommendations[0]!.status="REOPENED";f.closeout.push({...f.closeout[0]!,id:"close-test-2",decidedAt:R5});expect(parse(f).ok).toBe(false);});
 it("rejects REOPEN earlier than CLOSE",()=>{const f=closed();f.recommendations[0]!.status="REOPENED";f.closeout.push({...f.closeout[0]!,id:"reopen-test-1",kind:"REOPEN",decidedAt:R2});expect(parse(f).ok).toBe(false);});
 it("rejects a repeated CLOSE event without intervening REOPEN",()=>{const f=closed();f.closeout.push({...f.closeout[0]!,id:"close-test-3",decidedAt:R5});expect(parse(f).ok).toBe(false);});
 it("preserves a second independent closure following reopening",()=>{const f=closed();f.closeout.push({...f.closeout[0]!,id:"reopen-test-1",kind:"REOPEN",decidedAt:R5,decisionBasisRef:"test-reopen-basis"},{...f.closeout[0]!,id:"close-test-3",decidedAt:"2026-02-16T08:00:00Z"});expect(parse(f).ok).toBe(true);});
 it("supports independent SUPERSEDED lifecycle event",()=>accepted(f=>{f.recommendations[0]!.status="SUPERSEDED";f.recommendations[0]!.lifecycleDecision={kind:"SUPERSEDE",decisionAt:R3,basisRef:"test-supersede-basis",authorityRef:"test-authority"};}));
 it("supports independent WITHDRAW lifecycle event",()=>accepted(f=>{f.recommendations[0]!.status="WITHDRAWN";f.recommendations[0]!.lifecycleDecision={kind:"WITHDRAW",decisionAt:R3,basisRef:"test-withdraw-basis",authorityRef:"test-authority"};}));
 it("rejects SUPERSEDED without authorized event",()=>rejected(f=>{f.recommendations[0]!.status="SUPERSEDED";}));
 it("rejects WITHDRAWN decision without basis",()=>rejected(f=>{f.recommendations[0]!.status="WITHDRAWN";f.recommendations[0]!.lifecycleDecision={kind:"WITHDRAW",decisionAt:R3,basisRef:"",authorityRef:"test-authority"};}));
 it("rejects supersession before approval",()=>rejected(f=>{f.recommendations[0]!.status="SUPERSEDED";f.recommendations[0]!.lifecycleDecision={kind:"SUPERSEDE",decisionAt:R0,basisRef:"test-basis",authorityRef:"test-authority"};}));
});

describe("REC search and review context",()=>{
 it("searches code and asset with case-insensitive terms",()=>{expect(filterRecommendations(fixture().recommendations,"test-rec-001 test-asset-1")).toHaveLength(1);});
 it("searches technical source basis",()=>{expect(filterRecommendations(fixture().recommendations,"approved-condition")).toHaveLength(1);});
 it("filters controlled recommendation state",()=>{expect(filterRecommendations(fixture().recommendations,"","DRAFT")).toHaveLength(1);});
 it("filters priority independently",()=>{expect(filterRecommendations(fixture().recommendations,"","ALL","HIGH")).toHaveLength(1);});
 it("returns no match without substituting a draft",()=>{expect(filterRecommendations(fixture().recommendations,"unavailable")).toHaveLength(0);});
 it("keeps only source-provided execution and verification in context",()=>{const c=recommendationContext(fixture(),"rec-test-1");expect(c.requirements).toHaveLength(2);expect(c.execution).toHaveLength(1);expect(c.fulfillment).toHaveLength(2);expect(c.closeout).toHaveLength(0);});
 it("does not invent missing recommendation context",()=>{const c=recommendationContext(fixture(),"unknown");expect(c.recommendation).toBeUndefined();expect(c.accountability).toBeUndefined();expect(c.fulfillment).toHaveLength(0);});
 it("keeps artificial fixture timestamps deterministic",()=>{expect(Date.parse(R1)).toBeGreaterThan(Date.parse(R0));expect(Date.parse(R4)).toBeGreaterThan(Date.parse(R3));});
});
