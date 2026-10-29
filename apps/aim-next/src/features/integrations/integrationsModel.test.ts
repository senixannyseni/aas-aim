import {describe,expect,it} from "vitest";
import {EMPTY_INTEGRATIONS,INTEGRATION_KEYS,integrationContext,integrationRows,isProtectedTargetField,parseIntegrationSnapshot} from "./integrationsModel";
import {integrationFixture,type MutableIntegrationFixture} from "./integrationsFixtures.test-utils";
const good=integrationFixture;
function rejected(value:unknown){const out=parseIntegrationSnapshot(value);expect(out.ok).toBe(false);if(!out.ok)expect(out.issues.length).toBeGreaterThan(0);}
function accepted(value:unknown){const out=parseIntegrationSnapshot(value);expect(out.ok).toBe(true);return out;}
function edit(key:keyof MutableIntegrationFixture,fn:(row:Record<string,unknown>)=>void,index=0){const obj=good();fn(obj[key][index]!);rejected(obj);}
const ts="2026-05-01T10:00:00Z";
describe("INT canonical validated snapshot",()=>{
 it("accepts a scope-authorized 13-collection snapshot",()=>{const r=accepted(good());if(r.ok)expect(r.snapshot.systems[0]?.name).toBe("Synthetic historian");});
 it("accepts explicit empty evidence without inventing connectors",()=>accepted(EMPTY_INTEGRATIONS));
 it("rejects missing source",()=>rejected(undefined));
 it("rejects null source",()=>rejected(null));
 it("rejects primitive source",()=>rejected("connected"));
 it("rejects array-shaped source",()=>rejected([]));
 it("rejects missing collection",()=>{const v=good();delete (v as unknown as Record<string,unknown>).lineage;rejected(v);});
 it("rejects unknown collection",()=>{const v=good();(v as unknown as Record<string,unknown>).tokens=[];rejected(v);});
 it("rejects non-array collection",()=>{const v=good();(v as unknown as Record<string,unknown>).health={};rejected(v);});
 it("preserves all 13 canonical collections",()=>expect(INTEGRATION_KEYS).toHaveLength(13));
 it("freezes returned structures without freezing input",()=>{const v=good();const r=accepted(v);if(r.ok){expect(Object.isFrozen(r.snapshot)).toBe(true);expect(Object.isFrozen(r.snapshot.health)).toBe(true);expect(Object.isFrozen(r.snapshot.health[0])).toBe(true);}expect(Object.isFrozen(v.health[0])).toBe(false);});
 it("does not leak partial accepted records when another is invalid",()=>{const v=good();v.systems.push({id:"bad",tenantId:"other"});const p=parseIntegrationSnapshot(v);expect(p.ok).toBe(false);expect("snapshot" in p).toBe(false);});
 it("rejects duplicate record identity per collection",()=>{const v=good();v.systems.push({...v.systems[0]!});rejected(v);});
 it("rejects extra credentials",()=>edit("connectors",r=>{r.accessToken="unsafe";}));
 it("rejects functions smuggled into source",()=>edit("systems",r=>{r.name=()=>"synthetic";}));
 it("rejects whitespace-padded IDs",()=>edit("systems",r=>{r.id=" system-a ";}));
 it("rejects control characters",()=>edit("systems",r=>{r.name="bad\nname";}));
 it("accepts a valid non-UTC instant",()=>{const v=good();v.health[0]!.observedAt="2026-05-01T17:00:00+07:00";accepted(v);});
 it("rejects impossible calendar date",()=>edit("health",r=>{r.observedAt="2026-02-31T10:00:00Z";}));
 it("rejects missing timestamp",()=>edit("lineage",r=>{delete r.observedAt;}));
 it("rejects oversized collection",()=>{const v=good();v.lineage=Array.from({length:10001},(_,i)=>({...v.lineage[0]!,id:`lineage-${i}`}));rejected(v);});
});
describe("INT external system, connectors, APIs and events",()=>{
 for(const [k,field] of [["connectors","systemId"],["apiContracts","connectorId"],["eventSubscriptions","connectorId"],["contracts","connectorId"],["checkpoints","connectorId"],["reconciliationRuns","connectorId"],["deadLetters","connectorId"],["health","connectorId"],["lineage","connectorId"]] as const){
  it(`rejects unknown ${k}.${field}`,()=>edit(k,row=>{row[field]="no-such-id";}));
  it(`rejects cross-tenant ${k}`,()=>edit(k,row=>{row.tenantId="different-tenant";}));
 }
 it("does not confuse connector CONFIGURED with health OK",()=>{const v=good();v.connectors[0]!.state="CONFIGURED";v.health[0]!.state="FAILED";accepted(v);});
 it("retains UNKNOWN source freshness even with connection OK",()=>{const out=accepted(good());if(out.ok)expect(out.snapshot.health.find(r=>r.dimension==="FRESHNESS")?.state).toBe("UNKNOWN");});
 it("rejects duplicate independent health dimension",()=>{const v=good();v.health.push({...v.health[0]!,id:"health-duplicate"});rejected(v);});
 it("accepts missing health dimensions rather than inventing OK",()=>{const v=good();v.health=[];accepted(v);});
 it("rejects unknown systems category",()=>edit("systems",r=>{r.category="APPROVAL_ENGINE";}));
 it("rejects invalid API direction",()=>edit("apiContracts",r=>{r.direction="UNRESTRICTED";}));
 it("rejects schema-less events",()=>edit("eventSubscriptions",r=>{r.schemaRef="";}));
});
describe("INT mapping ownership, protections and contract revisions",()=>{
 for(const field of ["approval","approvedBy","approvedAt","inspectionCredit","creditGranted","ConditionClosed","technicalDueDate","riskApproved","fitnessApproved","authorization","audit","permission","x.approvedStatus","x/closureDecision","x.governingDue"]){
  it(`recognizes protected target ${field}`,()=>expect(isProtectedTargetField(field)).toBe(true));
 }
 for(const field of ["thicknessReadingValue","nominalDiameter","externalTag","sourceStatus","inspectionNotes"]){it(`does not confuse ordinary source field ${field} with approval`,()=>expect(isProtectedTargetField(field)).toBe(false));}
 it("rejects inbound source claiming ownership of AIM field",()=>edit("mappings",r=>{r.fieldOwner="AIM";}));
 it("rejects inbound approval mapping",()=>edit("mappings",r=>{r.targetField="assessment.approvedAt";}));
 it("rejects inbound credit mapping",()=>edit("mappings",r=>{r.targetField="inspectionCredit";}));
 it("accepts outbound view of protected field without direct write",()=>{const v=good();v.mappings[0]!.direction="OUTBOUND";v.mappings[0]!.fieldOwner="AIM";v.mappings[0]!.targetField="approvedAt";accepted(v);});
 it("rejects verified mapping without reviewer basis",()=>edit("mappings",r=>{delete r.reviewRef;}));
 it("rejects staged mapping with prior review",()=>edit("mappings",r=>{r.state="STAGED";}));
 it("accepts staged mapping without review",()=>{const v=good();const r=v.mappings[0]!;r.state="STAGED";delete r.reviewedAt;delete r.reviewRef;accepted(v);});
 it("rejects orphan mapping contract",()=>edit("mappings",r=>{r.contractId="other";}));
 it("rejects half of an external object identity pair",()=>edit("mappings",r=>{delete r.aimObjectRef;}));
 it("accepts completely absent external mapping pair",()=>{const v=good();delete v.mappings[0]!.aimObjectRef;delete v.mappings[0]!.externalObjectRef;accepted(v);});
 it("rejects active contract without activation evidence",()=>edit("contracts",r=>{delete r.approvalRef;}));
 it("rejects draft contract with active metadata",()=>edit("contracts",r=>{r.status="DRAFT";}));
 it("accepts inactive draft contract without active metadata",()=>{const v=good();v.contracts[0]!.status="DRAFT";delete v.contracts[0]!.activatedAt;delete v.contracts[0]!.approvalRef;accepted(v);});
 it("rejects unknown owner domain",()=>edit("contracts",r=>{r.ownerDomain="AUTOMATIC_APPROVAL";}));
});
describe("INT import staging, validation and reconciliation",()=>{
 it("accepts independently validated job",()=>accepted(good()));
 it("rejects more accepted rows than received",()=>edit("jobs",r=>{r.validatedRows=13;}));
 it("rejects missing validation timestamp",()=>edit("jobs",r=>{delete r.validatedAt;}));
 it("rejects success label concealing rejected rows",()=>edit("jobs",r=>{r.rejectedRows=1;}));
 it("accepts explicit PARTIAL with all rows classified",()=>{const v=good();v.jobs[0]!.state="PARTIAL";v.jobs[0]!.validatedRows=11;v.jobs[0]!.rejectedRows=1;accepted(v);});
 it("rejects PARTIAL with no failures",()=>edit("jobs",r=>{r.state="PARTIAL";}));
 it("accepts REJECTED with classified rows",()=>{const v=good();v.jobs[0]!.state="REJECTED";v.jobs[0]!.validatedRows=0;v.jobs[0]!.rejectedRows=12;accepted(v);});
 it("rejects received-unvalidated job with counts",()=>edit("jobs",r=>{r.state="RECEIVED";}));
 it("accepts RECEIVED only with zero classified rows",()=>{const v=good();v.jobs[0]!.state="RECEIVED";v.jobs[0]!.validatedRows=0;delete v.jobs[0]!.validatedAt;accepted(v);});
 it("rejects promotion without explicit governance reference",()=>edit("jobs",r=>{r.state="PROMOTED";}));
 it("accepts promotion with provenance but no native approval claim",()=>{const v=good();v.jobs[0]!.state="PROMOTED";v.jobs[0]!.promotionRef="test-staging-promotion";accepted(v);});
 it("rejects promotion of partial rows",()=>{const v=good();v.jobs[0]!.state="PROMOTED";v.jobs[0]!.promotionRef="test-promotion";v.jobs[0]!.validatedRows=11;v.jobs[0]!.rejectedRows=1;rejected(v);});
 it("rejects cross-connector job/contract mismatch",()=>{const v=good();v.systems.push({...v.systems[0]!,id:"system-b"});v.connectors.push({...v.connectors[0]!,id:"connector-b",systemId:"system-b"});v.jobs[0]!.connectorId="connector-b";rejected(v);});
 it("rejects invalid conflict contract",()=>edit("conflicts",r=>{r.contractId="nope";}));
 it("rejects open conflict with forged resolution metadata",()=>edit("conflicts",r=>{r.resolutionRef="fake-review";}));
 it("rejects resolved conflict without independent review",()=>edit("conflicts",r=>{r.status="RESOLVED";}));
 it("accepts reviewed resolution without last-write-wins",()=>{const v=good();v.conflicts[0]!.status="RESOLVED";v.conflicts[0]!.resolvedAt="2026-05-02T10:00:00Z";v.conflicts[0]!.resolutionRef="test-resolution";v.conflicts[0]!.reviewerRef="engineer-a";accepted(v);});
 it("rejects resolution predating conflict",()=>{const v=good();v.conflicts[0]!.status="RESOLVED";v.conflicts[0]!.resolvedAt="2026-04-01T10:00:00Z";v.conflicts[0]!.resolutionRef="test-resolution";v.conflicts[0]!.reviewerRef="engineer-a";rejected(v);});
 it("rejects succeeded reconciliation with exceptions",()=>edit("reconciliationRuns",r=>{r.state="SUCCEEDED";}));
 it("accepts fully matched reconciled outcome",()=>{const v=good();v.reconciliationRuns[0]!.state="SUCCEEDED";v.reconciliationRuns[0]!.matchedCount=12;v.reconciliationRuns[0]!.exceptionCount=0;accepted(v);});
 it("rejects over-counted reconciliation",()=>edit("reconciliationRuns",r=>{r.matchedCount=12;}));
 it("rejects completed run missing timestamp",()=>edit("reconciliationRuns",r=>{delete r.completedAt;}));
 it("accepts running without completedAt",()=>{const v=good();v.reconciliationRuns[0]!.state="RUNNING";delete v.reconciliationRuns[0]!.completedAt;accepted(v);});
 it("rejects resolved dead letter lacking resolution time",()=>edit("deadLetters",r=>{r.status="RESOLVED";}));
 it("accepts separately reviewed dead-letter handling",()=>{const v=good();v.deadLetters[0]!.status="RESOLVED";v.deadLetters[0]!.resolvedAt=ts;accepted(v);});
 it("rejects lineage domain approval claim from staging",()=>edit("lineage",r=>{r.domainCommandRef="fake-approval";}));
 it("allows a reference to a separately audited domain command only on reconciled operation",()=>{const v=good();v.lineage[0]!.operation="RECONCILED";v.lineage[0]!.domainCommandRef="reference-only-not-authority";accepted(v);});
});
describe("INT read-only query helpers",()=>{
 it("filters source systems",()=>{const p=parseIntegrationSnapshot(good());if(p.ok)expect(integrationRows(p.snapshot,"systems","historian")).toHaveLength(1);});
 it("finds records by exact identity",()=>{const p=parseIntegrationSnapshot(good());if(p.ok)expect(integrationContext(p.snapshot,"jobs","job-a")?.kind).toBe("IMPORT");});
 it("does not match missing records",()=>{const p=parseIntegrationSnapshot(good());if(p.ok)expect(integrationContext(p.snapshot,"jobs","nonexistent")).toBeUndefined();});
 it("does not turn unknown health into success during search",()=>{const p=parseIntegrationSnapshot(good());if(p.ok)expect(integrationRows(p.snapshot,"health","UNKNOWN")[0]?.dimension).toBe("FRESHNESS");});
 it("supports multiple search terms",()=>{const p=parseIntegrationSnapshot(good());if(p.ok)expect(integrationRows(p.snapshot,"systems","synthetic historian")).toHaveLength(1);});
 it("returns no results for unmatched query",()=>{const p=parseIntegrationSnapshot(good());if(p.ok)expect(integrationRows(p.snapshot,"systems","oracle")).toHaveLength(0);});
});
