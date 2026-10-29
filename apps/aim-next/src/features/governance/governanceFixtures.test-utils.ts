/** Synthetic GOVERNANCE fixtures for tests ONLY. Never import into production. */
export function governanceFixture(){return {
 tenants:[{id:"tenant-a",code:"TEST-A",name:"Test tenant A"},{id:"tenant-b",code:"TEST-B",name:"Test tenant B"}],
 principals:[
  {id:"user-a",tenantId:"tenant-a",displayName:"Test Engineer",kind:"USER",status:"ACTIVE",identityRef:"test-idp-subject-a"},
  {id:"user-b",tenantId:"tenant-a",displayName:"Test Delegate",kind:"USER",status:"ACTIVE",identityRef:"test-idp-subject-b"},
  {id:"service-a",tenantId:"tenant-a",displayName:"Test Connector",kind:"SERVICE",status:"ACTIVE",identityRef:"test-client-id"},
  {id:"user-foreign",tenantId:"tenant-b",displayName:"Other tenant",kind:"USER",status:"ACTIVE",identityRef:"other-idp"},
 ],
 profiles:[{id:"profile-a",tenantId:"tenant-a",name:"Test Read Profile",capabilities:["AIR_READ","GOV_READ"]},{id:"profile-b",tenantId:"tenant-b",name:"Other tenant profile",capabilities:["AIR_READ"]}],
 grants:[{id:"grant-a",principalId:"user-a",profileId:"profile-a",scopeKind:"TENANT",scopeRef:"tenant-a",grantedAt:"2026-01-01T00:00:00Z",expiresAt:"2027-01-01T00:00:00Z"}],
 authorities:[{id:"auth-a",principalId:"user-a",scopeRef:"TEST-SITE",discipline:"Mechanical",decisionFunction:"RBI-018",validFrom:"2026-01-01T00:00:00Z",validUntil:"2027-01-01T00:00:00Z",status:"ACTIVE"}],
 delegations:[{id:"delegate-a",authorityId:"auth-a",delegatePrincipalId:"user-b",validFrom:"2026-06-01T00:00:00Z",validUntil:"2026-12-01T00:00:00Z",basisRef:"test-delegation-basis",status:"ACTIVE"}],
 policies:[{id:"workflow-a",tenantId:"tenant-a",kind:"WORKFLOW",domain:"RBI",revision:"1",status:"ACTIVE",basisRef:"test-workflow-basis",activatedAt:"2026-01-01T00:00:00Z",approvedBy:"user-a"},{id:"state-a",tenantId:"tenant-a",kind:"STATE",domain:"INS",revision:"1",status:"DRAFT",basisRef:"test-state-basis"}],
 auditEvents:[{id:"audit-a",tenantId:"tenant-a",actorRef:"user-a",eventType:"RBI_APPROVAL",objectRef:"test-rbi",objectRevision:"r1",occurredAt:"2026-04-01T12:00:00Z",integrityRef:"test-server-integrity-proof",outcome:"SUCCESS"}],
 revisions:[{id:"revision-a",tenantId:"tenant-a",objectRef:"test-rbi",revision:"r1",authorRef:"user-a",createdAt:"2026-01-01T00:00:00Z",changeBasisRef:"test-basis",status:"SUPERSEDED"},{id:"revision-b",tenantId:"tenant-a",objectRef:"test-rbi",revision:"r2",authorRef:"user-a",createdAt:"2026-02-01T00:00:00Z",changeBasisRef:"test-new-basis",status:"FROZEN",previousId:"revision-a"}],
 packages:[{id:"package-a",tenantId:"tenant-a",kind:"METHODOLOGY",code:"TEST-RBI",revision:"r2",status:"ACTIVE",basisRef:"test-methodology-basis",approvalRef:"test-approval",approvedBy:"user-a",approvedAt:"2026-02-01T00:00:00Z",effectiveAt:"2026-02-02T00:00:00Z"},{id:"package-b",tenantId:"tenant-a",kind:"CONFIGURATION",code:"TEST-IOW",revision:"r1",status:"DRAFT",basisRef:"test-package-draft"}],
 notificationRules:[{id:"notify-a",tenantId:"tenant-a",code:"TEST-ESCALATION",eventType:"WORKPACK_OVERDUE",recipientScope:"TEST-SITE",ruleRef:"test-rule",status:"ENABLED",escalationLevel:2}],
 evidence:[{id:"evidence-a",tenantId:"tenant-a",objectRef:"test-rbi",sourceRef:"test-inspection",sha256:"a".repeat(64),recordedAt:"2026-02-03T00:00:00Z",classification:"INTERNAL",retentionPolicyId:"retention-a"}],
 retentionPolicies:[{id:"retention-a",tenantId:"tenant-a",code:"TEST-RETAIN",years:7,status:"ACTIVE",legalBasisRef:"test-retention-law"}],
 holds:[{id:"hold-a",tenantId:"tenant-a",policyId:"retention-a",objectRef:"test-rbi",reasonRef:"test-legal-hold",startAt:"2026-02-10T00:00:00Z",authorizedBy:"user-a"}],
 aiPolicies:[{id:"ai-policy-a",tenantId:"tenant-a",code:"TEST-AI",revision:"r1",status:"ACTIVE",allowedTools:["EXPLAIN"],prohibitedFunctions:["RBI-018","FFS-010"],dataPolicyRef:"test-ai-data-policy",approvedBy:"user-a",approvedAt:"2026-02-01T00:00:00Z",approvalRef:"test-ai-approval"}],
 aiExecutions:[{id:"ai-exec-a",tenantId:"tenant-a",policyId:"ai-policy-a",executedAt:"2026-04-01T00:00:00Z",actorRef:"user-a",modelRef:"test-model",outputKind:"EXPLANATION",sourceRefs:["evidence-a"],auditRef:"audit-a"}],
};}
