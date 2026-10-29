/** Synthetic integration records only for tests. Never imported by production application code. */
import {INTEGRATION_KEYS} from "./integrationsModel";
type Row=Record<string,unknown>;
export type MutableIntegrationFixture=Record<typeof INTEGRATION_KEYS[number],Row[]>;
export function integrationFixture():MutableIntegrationFixture{
 const t="test-tenant",at="2026-05-01T10:00:00Z",later="2026-05-02T10:00:00Z";
 return {
 systems:[{id:"system-a",tenantId:t,name:"Synthetic historian",category:"HISTORIAN",status:"ENABLED"}],
 connectors:[{id:"connector-a",tenantId:t,systemId:"system-a",name:"Test historian connector",mode:"PULL",state:"CONFIGURED",configRevision:"rev-1"}],
 apiContracts:[{id:"api-a",tenantId:t,connectorId:"connector-a",name:"Test readings API",direction:"INBOUND",revision:"rev-1",schemaRef:"test-schema-1",status:"ACTIVE"}],
 eventSubscriptions:[{id:"event-a",tenantId:t,connectorId:"connector-a",eventType:"ExternalReadingReceived",direction:"INBOUND",schemaRef:"event-schema-1",status:"ACTIVE"}],
 jobs:[{id:"job-a",tenantId:t,connectorId:"connector-a",contractId:"contract-a",kind:"IMPORT",state:"VALIDATED",receivedRows:12,validatedRows:12,rejectedRows:0,receivedAt:at,validatedAt:later,sourceManifestRef:"manifest-a"}],
 contracts:[{id:"contract-a",tenantId:t,connectorId:"connector-a",ownerDomain:"COR",revision:"rev-1",status:"ACTIVE",sourceSchemaRef:"source-schema-a",targetSchemaRef:"target-schema-a",mappingPolicyRef:"policy-a",approvalRef:"test-contract-activation-a",activatedAt:at}],
 mappings:[{id:"mapping-a",tenantId:t,contractId:"contract-a",sourceField:"readingValue",targetField:"thicknessReadingValue",direction:"INBOUND",fieldOwner:"EXTERNAL",state:"VERIFIED",reviewRef:"review-a",reviewedAt:at,externalObjectRef:"external-reading-a",aimObjectRef:"staging-reading-a"}],
 checkpoints:[{id:"checkpoint-a",tenantId:t,connectorId:"connector-a",cursorRef:"cursor-a",sequence:5,processedAt:at}],
 conflicts:[{id:"conflict-a",tenantId:t,connectorId:"connector-a",contractId:"contract-a",sourceObjectRef:"source-a",targetObjectRef:"target-a",kind:"REVISION",status:"OPEN",detectedAt:at}],
 reconciliationRuns:[{id:"recon-a",tenantId:t,connectorId:"connector-a",state:"PARTIAL",startedAt:at,completedAt:later,inspectedCount:12,matchedCount:11,exceptionCount:1,auditRef:"test-audit-a"}],
 deadLetters:[{id:"dead-a",tenantId:t,connectorId:"connector-a",messageRef:"msg-a",errorCode:"VALIDATION_REJECTED",status:"PENDING",retryCount:2,failedAt:at}],
 health:[{id:"health-conn",tenantId:t,connectorId:"connector-a",dimension:"CONNECTION",state:"OK",observedAt:at,evidenceRef:"health-proof-1"},{id:"health-fresh",tenantId:t,connectorId:"connector-a",dimension:"FRESHNESS",state:"UNKNOWN",observedAt:at,evidenceRef:"health-proof-2"}],
 lineage:[{id:"lineage-a",tenantId:t,connectorId:"connector-a",sourceRef:"historian-a",targetRef:"staging-reading-a",eventRef:"event-instance-a",observedAt:at,operation:"STAGED",disposition:"PENDING"}],
 };
}
