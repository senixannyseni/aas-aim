import {describe,it,expect} from "vitest";
import {governanceFixture} from "./governanceFixtures.test-utils";
import {EMPTY_GOVERNANCE,GOVERNANCE_KEYS,governanceContext,governanceRows,parseGovernanceSnapshot} from "./governanceModel";

type Fixture=ReturnType<typeof governanceFixture>;
const good=():Fixture=>governanceFixture();
const success=(v:unknown)=>{const p=parseGovernanceSnapshot(v);expect(p.ok).toBe(true);return p;};
const rejected=(v:unknown)=>{const p=parseGovernanceSnapshot(v);expect(p.ok).toBe(false);return p;};
const bad=<T extends keyof Fixture>(key:T,update:(row:Fixture[T][number])=>void):void=>{const v=good();update(v[key][0]!);rejected(v);};

describe("GOV structure and fail closed boundary",()=>{
 it("accepts source-complete synthetic fixture",()=>{const p=success(good());if(p.ok)expect(p.snapshot.principals).toHaveLength(4);});
 it("accepts an explicit empty record set",()=>{const p=success(EMPTY_GOVERNANCE);if(p.ok)expect(p.snapshot.aiExecutions).toHaveLength(0);});
 it("has exactly sixteen canonical object collections",()=>expect(GOVERNANCE_KEYS).toHaveLength(16));
 it("rejects null",()=>{rejected(null);});
 it("rejects undefined",()=>{rejected(undefined);});
 it("rejects arrays",()=>{rejected([]);});
 it("rejects a missing collection",()=>{const v={...good()} as Record<string,unknown>;delete v.principals;rejected(v);});
 it("rejects an extra collection",()=>rejected({...good(),secretToken:[] }));
 it("rejects a collection that is not an array",()=>rejected({...good(),principals:{}}));
 it("rejects primitive record",()=>{const v=good();(v.principals as unknown[])[0]="hello";rejected(v);});
 it("rejects unexpected record property",()=>rejected({...good(),principals:[{...good().principals[0],rawToken:"unsafe"}]}));
 it("rejects duplicate IDs within one collection",()=>{const v=good();v.principals.push({...v.principals[0]!});rejected(v);});
 it("rejects oversized batches",()=>{const v={...good(),tenants:new Array(10001).fill(good().tenants[0])};rejected(v);});
 it("does not freeze caller-owned records",()=>{const v=good();success(v);expect(Object.isFrozen(v.principals[0])).toBe(false);v.principals[0]!.displayName="Updated after parse";expect(v.principals[0]!.displayName).toBe("Updated after parse");});
 it("freezes its own parsed records and nested capability arrays",()=>{const p=success(good());if(p.ok){expect(Object.isFrozen(p.snapshot)).toBe(true);expect(Object.isFrozen(p.snapshot.profiles[0])).toBe(true);expect(Object.isFrozen(p.snapshot.profiles[0]!.capabilities)).toBe(true);}});
 it("copies source data instead of retaining caller aliases",()=>{const v=good();const p=success(v);v.principals[0]!.displayName="Changed after read";if(p.ok)expect(p.snapshot.principals[0]!.displayName).toBe("Test Engineer");});
 it("accepts missing optional grant expiry",()=>{const v=good();delete (v.grants[0] as Partial<Fixture["grants"][number]>).expiresAt;success(v);});
 it("rejects null optional expiry",()=>{const v=good();(v.grants[0] as unknown as Record<string,unknown>).expiresAt=null;rejected(v);});
 it("rejects impossible dates",()=>{bad("auditEvents",v=>{v.occurredAt="2026-02-30T12:00:00Z";});});
 it("rejects timestamps without a timezone",()=>{bad("auditEvents",v=>{v.occurredAt="2026-04-01T12:00:00";});});
 it("rejects control-character references",()=>{bad("evidence",v=>{v.sourceRef="hello\nworld";});});
 it("fails the complete batch, never returns partial on mismatch",()=>{const v=good();v.principals[0]!.tenantId="ghost";const p=rejected(v);expect(p.ok).toBe(false);});
});

describe("GOV principal, scope and engineering authority separation",()=>{
 it("rejects principal from nonexistent tenant",()=>{bad("principals",v=>{v.tenantId="ghost";});});
 it("rejects profile from nonexistent tenant",()=>{bad("profiles",v=>{v.tenantId="ghost";});});
 it("rejects profile duplicate capabilities",()=>{bad("profiles",v=>{v.capabilities=["AIR_READ","AIR_READ"];});});
 it("allows service principals to exist without engineering authority",()=>{const p=success(good());if(p.ok)expect(p.snapshot.principals.find(x=>x.id==="service-a")?.kind).toBe("SERVICE");});
 it("rejects service principal holding human engineering authority",()=>{bad("authorities",v=>{v.principalId="service-a";});});
 it("rejects nonexistent human authority principal",()=>{bad("authorities",v=>{v.principalId="unknown";});});
 it("rejects invalid engineering function code",()=>{bad("authorities",v=>{v.decisionFunction="EXECUTE_ADMIN";});});
 it("rejects authority end earlier than start",()=>{bad("authorities",v=>{v.validUntil="2025-01-01T00:00:00Z";});});
 it("rejects grant principal/profile across tenant boundaries",()=>{bad("grants",v=>{v.profileId="profile-b";});});
 it("rejects nonexistent grant principal",()=>{bad("grants",v=>{v.principalId="ghost";});});
 it("rejects foreign tenant-level scope",()=>{bad("grants",v=>{v.scopeRef="tenant-b";});});
 it("accepts site-level grants separately",()=>{const v=good();v.grants[0]!.scopeKind="SITE";v.grants[0]!.scopeRef="test-site";success(v);});
 it("rejects grant expiry before granting",()=>{bad("grants",v=>{v.expiresAt="2025-01-01T00:00:00Z";});});
 it("rejects grant outside known access profile",()=>{bad("grants",v=>{v.profileId="missing";});});
 it("rejects service principal delegate",()=>{bad("delegations",v=>{v.delegatePrincipalId="service-a";});});
 it("rejects cross-tenant delegate",()=>{bad("delegations",v=>{v.delegatePrincipalId="user-foreign";});});
 it("rejects unknown authority delegation",()=>{bad("delegations",v=>{v.authorityId="absent";});});
 it("rejects delegation extending past parent authority",()=>{bad("delegations",v=>{v.validUntil="2027-06-01T00:00:00Z";});});
 it("rejects delegation beginning before parent authority",()=>{bad("delegations",v=>{v.validFrom="2025-06-01T00:00:00Z";});});
 it("rejects reverse delegation dates",()=>{bad("delegations",v=>{v.validUntil="2026-01-01T00:00:00Z";});});
 it("rejects active delegation against suspended authority",()=>{const v=good();v.authorities[0]!.status="SUSPENDED";rejected(v);});
 it("allows suspended authority if delegation is revoked",()=>{const v=good();v.authorities[0]!.status="SUSPENDED";v.delegations[0]!.status="REVOKED";success(v);});
});

describe("GOV policy, audit, revision and controlled methodology",()=>{
 it("accepts active workflow policy with exact activation provenance",()=>success(good()));
 it("rejects unproven active workflow policy",()=>{const v=good();delete (v.policies[0] as Partial<Fixture["policies"][number]>).approvedBy;rejected(v);});
 it("rejects draft policy with activation metadata",()=>{const v=good();v.policies[0]!.status="DRAFT";rejected(v);});
 it("accepts historical denied audit outcome",()=>{const v=good();v.auditEvents[0]!.outcome="DENIED";success(v);});
 it("rejects audit without server integrity reference",()=>{bad("auditEvents",v=>{v.integrityRef="";});});
 it("rejects audit missing owning tenant",()=>{bad("auditEvents",v=>{v.tenantId="ghost";});});
 it("rejects revision pointing at missing predecessor",()=>{const v=good();v.revisions[1]!.previousId="missing";rejected(v);});
 it("rejects revision pointing to another object",()=>{const v=good();v.revisions[0]!.objectRef="other-object";rejected(v);});
 it("rejects revision whose predecessor is later",()=>{const v=good();v.revisions[0]!.createdAt="2026-03-01T00:00:00Z";rejected(v);});
 it("rejects an active methodology without approval reference",()=>{const v=good();delete (v.packages[0] as Partial<Fixture["packages"][number]>).approvalRef;rejected(v);});
 it("rejects a draft methodology with activation provenance",()=>{const v=good();v.packages[0]!.status="DRAFT";rejected(v);});
 it("rejects incomplete package approval trio",()=>{const v=good();delete (v.packages[0] as Partial<Fixture["packages"][number]>).approvedBy;rejected(v);});
 it("rejects invalid notification escalation level",()=>{bad("notificationRules",v=>{v.escalationLevel=12;});});
 it("rejects negative escalation",()=>{bad("notificationRules",v=>{v.escalationLevel=-1;});});
});

describe("GOV controlled evidence, retention and AI provenance",()=>{
 it("rejects a malformed evidence checksum",()=>{bad("evidence",v=>{v.sha256="broken";});});
 it("rejects unknown evidence retention reference",()=>{bad("evidence",v=>{v.retentionPolicyId="absent";});});
 it("rejects cross-tenant retention references",()=>{const v=good();v.retentionPolicies[0]!.tenantId="tenant-b";rejected(v);});
 it("rejects negative retention",()=>{bad("retentionPolicies",v=>{v.years=-1;});});
 it("rejects unsupported retention value",()=>{bad("retentionPolicies",v=>{v.years=201;});});
 it("accepts zero-year policy explicitly as an upstream field, not auto deletion",()=>{const v=good();v.retentionPolicies[0]!.years=0;success(v);});
 it("rejects hold with no retention policy",()=>{bad("holds",v=>{v.policyId="missing";});});
 it("rejects hold release preceding original hold",()=>{const v=good();(v.holds[0] as unknown as Record<string,unknown>).releasedAt="2025-01-01T00:00:00Z";rejected(v);});
 it("accepts separately recorded legal hold release",()=>{const v=good();(v.holds[0] as unknown as Record<string,unknown>).releasedAt="2026-03-01T00:00:00Z";success(v);});
 it("rejects incomplete active AI policy approval",()=>{const v=good();delete (v.aiPolicies[0] as Partial<Fixture["aiPolicies"][number]>).approvalRef;rejected(v);});
 it("rejects AI policy duplicate prohibited transitions",()=>{bad("aiPolicies",v=>{v.prohibitedFunctions=["RBI-018","RBI-018"];});});
 it("rejects AI execution with unknown policy",()=>{bad("aiExecutions",v=>{v.policyId="ghost";});});
 it("rejects AI execution with cross-tenant policy",()=>{bad("aiExecutions",v=>{v.tenantId="tenant-b";});});
 it("rejects invented AI approval output kind",()=>{bad("aiExecutions",v=>{v.outputKind="APPROVAL";});});
 it("accepts advisory AI draft without introducing decision authority",()=>{const v=good();v.aiExecutions[0]!.outputKind="DRAFT";success(v);});
 it("rejects nonexistent AI provenance sources fields",()=>{bad("aiExecutions",v=>{v.sourceRefs=[""];});});
});

describe("GOV search and read-only projections",()=>{
 it("finds principal by name and kind",()=>{const p=success(good());if(p.ok)expect(governanceRows(p.snapshot,"principals","test engineer user")).toHaveLength(1);});
 it("finds metadata across case-insensitive terms",()=>{const p=success(good());if(p.ok)expect(governanceRows(p.snapshot,"packages","test-rbi active")).toHaveLength(1);});
 it("does not synthesize absent governance objects",()=>expect(governanceRows(EMPTY_GOVERNANCE,"authorities","")).toHaveLength(0));
 it("resolves exact selected object only",()=>{const p=success(good());if(p.ok){expect(governanceContext(p.snapshot,"authorities","auth-a")?.id).toBe("auth-a");expect(governanceContext(p.snapshot,"authorities","missing")).toBeUndefined();}});
 it("does not use record body strings as dynamic executable authorization",()=>{const p=success(good());if(p.ok)expect(p.snapshot.principals.find(x=>x.id==="user-a")?.identityRef).toBe("test-idp-subject-a");});
});

describe("GOV protected decision provenance and revision ownership",()=>{
 it("rejects non-protected function disguised as human approval",()=>{bad("authorities",v=>{v.decisionFunction="AIR-001";});});
 it("rejects non-active principal retaining active engineering authority",()=>{const v=good();v.principals[0]!.status="SUSPENDED";rejected(v);});
 it("rejects service principal approving workflow policy",()=>{bad("policies",v=>{if(v.id==="workflow-a")v.approvedBy="service-a";});});
 it("rejects missing workflow policy approver reference",()=>{bad("policies",v=>{if(v.id==="workflow-a")v.approvedBy="unknown";});});
 it("rejects cross-tenant package approver",()=>{bad("packages",v=>{v.approvedBy="user-foreign";});});
 it("rejects service principal approving methodology",()=>{bad("packages",v=>{v.approvedBy="service-a";});});
 it("rejects effective date before package approval",()=>{bad("packages",v=>{v.effectiveAt="2026-01-01T00:00:00Z";});});
 it("rejects a same-time revision predecessor",()=>{const v=good();v.revisions[0]!.createdAt="2026-02-01T00:00:00Z";rejected(v);});
 it("rejects cross-tenant AI policy approver",()=>{bad("aiPolicies",v=>{v.approvedBy="user-foreign";});});
 it("rejects service AI-policy approver",()=>{bad("aiPolicies",v=>{v.approvedBy="service-a";});});
});
