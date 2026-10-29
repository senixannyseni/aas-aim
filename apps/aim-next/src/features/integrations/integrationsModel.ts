/** INT-001–011: source-backed integration projections. Never authorize a domain mutation from this data. */
export const INTEGRATION_KEYS = ["systems","connectors","apiContracts","eventSubscriptions","jobs","contracts","mappings","checkpoints","conflicts","reconciliationRuns","deadLetters","health","lineage"] as const;
export type IntegrationKey = typeof INTEGRATION_KEYS[number];
export type IntegrationRecord = Readonly<Record<string,unknown> & {id:string;tenantId:string}>;
export type IntegrationSnapshot = Readonly<Record<IntegrationKey,readonly IntegrationRecord[]>>;
export type IntegrationParseResult = Readonly<{ok:true;snapshot:IntegrationSnapshot}> | Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_INTEGRATIONS:IntegrationSnapshot=Object.freeze(Object.fromEntries(INTEGRATION_KEYS.map(k=>[k,Object.freeze([])])) as unknown as Record<IntegrationKey,readonly IntegrationRecord[]>);
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const nonempty=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=1024&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const integer=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=1e9;
const enumCheck=(values:readonly string[])=>(v:unknown)=>typeof v==="string"&&values.includes(v);
const timestamp=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))&&(()=>{const d=new Date(v);const m=/^(\d{4})-(\d{2})-(\d{2})T/.exec(v);if(!m)return false;const [y,mo,day]=[+m[1]!,+m[2]!,+m[3]!];return y>0&&mo>=1&&mo<=12&&day>=1&&day<=new Date(Date.UTC(y,mo,0)).getUTCDate()&&d.toString()!=="Invalid Date";})();
const domains=["AIR","DGM","COR","INS","RBI","FND","REC","ACT","IOW","FFS","GOV","INT","ANA","FLD","VIS"] as const;
const statuses=["DRAFT","ACTIVE","RETIRED"];
type Spec=Readonly<{required:readonly string[];optional?:readonly string[];checks:Readonly<Record<string,(x:unknown)=>boolean>>}>;
const specs:Readonly<Record<IntegrationKey,Spec>>={
 systems:{required:["id","tenantId","name","category","status"],checks:{id:nonempty,tenantId:nonempty,name:nonempty,category:enumCheck(["ERP_CMMS","HISTORIAN","EDMS","ENGINEERING","GIS","OTHER"]),status:enumCheck(["ENABLED","DISABLED","UNKNOWN"])}},
 connectors:{required:["id","tenantId","systemId","name","mode","state","configRevision"],checks:{id:nonempty,tenantId:nonempty,systemId:nonempty,name:nonempty,mode:enumCheck(["PULL","PUSH","BIDIRECTIONAL"]),state:enumCheck(["CONFIGURED","DISABLED","UNKNOWN"]),configRevision:nonempty}},
 apiContracts:{required:["id","tenantId","connectorId","name","direction","revision","schemaRef","status"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,name:nonempty,direction:enumCheck(["INBOUND","OUTBOUND"]),revision:nonempty,schemaRef:nonempty,status:enumCheck(statuses)}},
 eventSubscriptions:{required:["id","tenantId","connectorId","eventType","direction","schemaRef","status"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,eventType:nonempty,direction:enumCheck(["INBOUND","OUTBOUND"]),schemaRef:nonempty,status:enumCheck(statuses)}},
 jobs:{required:["id","tenantId","connectorId","contractId","kind","state","receivedRows","validatedRows","rejectedRows","receivedAt","sourceManifestRef"],optional:["validatedAt","promotionRef","errorRef"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,contractId:nonempty,kind:enumCheck(["IMPORT","EXPORT","MIGRATION"]),state:enumCheck(["RECEIVED","VALIDATED","PARTIAL","REJECTED","PROMOTED"]),receivedRows:integer,validatedRows:integer,rejectedRows:integer,receivedAt:timestamp,sourceManifestRef:nonempty,validatedAt:timestamp,promotionRef:nonempty,errorRef:nonempty}},
 contracts:{required:["id","tenantId","connectorId","ownerDomain","revision","status","sourceSchemaRef","targetSchemaRef","mappingPolicyRef"],optional:["activatedAt","approvalRef"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,ownerDomain:enumCheck(domains),revision:nonempty,status:enumCheck(statuses),sourceSchemaRef:nonempty,targetSchemaRef:nonempty,mappingPolicyRef:nonempty,activatedAt:timestamp,approvalRef:nonempty}},
 mappings:{required:["id","tenantId","contractId","sourceField","targetField","direction","fieldOwner","state"],optional:["reviewedAt","reviewRef","externalObjectRef","aimObjectRef"],checks:{id:nonempty,tenantId:nonempty,contractId:nonempty,sourceField:nonempty,targetField:nonempty,direction:enumCheck(["INBOUND","OUTBOUND"]),fieldOwner:enumCheck(["EXTERNAL","AIM"]),state:enumCheck(["STAGED","VERIFIED","REJECTED"]),reviewedAt:timestamp,reviewRef:nonempty,externalObjectRef:nonempty,aimObjectRef:nonempty}},
 checkpoints:{required:["id","tenantId","connectorId","cursorRef","sequence","processedAt"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,cursorRef:nonempty,sequence:integer,processedAt:timestamp}},
 conflicts:{required:["id","tenantId","connectorId","contractId","sourceObjectRef","targetObjectRef","kind","status","detectedAt"],optional:["resolvedAt","resolutionRef","reviewerRef"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,contractId:nonempty,sourceObjectRef:nonempty,targetObjectRef:nonempty,kind:enumCheck(["OWNERSHIP","REVISION","IDENTITY","SCHEMA","DATA"]),status:enumCheck(["OPEN","RESOLVED"]),detectedAt:timestamp,resolvedAt:timestamp,resolutionRef:nonempty,reviewerRef:nonempty}},
 reconciliationRuns:{required:["id","tenantId","connectorId","state","startedAt","inspectedCount","matchedCount","exceptionCount","auditRef"],optional:["completedAt"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,state:enumCheck(["RUNNING","SUCCEEDED","PARTIAL","FAILED"]),startedAt:timestamp,inspectedCount:integer,matchedCount:integer,exceptionCount:integer,auditRef:nonempty,completedAt:timestamp}},
 deadLetters:{required:["id","tenantId","connectorId","messageRef","errorCode","status","retryCount","failedAt"],optional:["resolvedAt"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,messageRef:nonempty,errorCode:nonempty,status:enumCheck(["PENDING","QUARANTINED","RESOLVED"]),retryCount:integer,failedAt:timestamp,resolvedAt:timestamp}},
 health:{required:["id","tenantId","connectorId","dimension","state","observedAt","evidenceRef"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,dimension:enumCheck(["CONNECTION","AUTHENTICATION","PROCESSING","FRESHNESS","BACKLOG","RECONCILIATION"]),state:enumCheck(["OK","DEGRADED","FAILED","UNKNOWN","STALE"]),observedAt:timestamp,evidenceRef:nonempty}},
 lineage:{required:["id","tenantId","connectorId","sourceRef","targetRef","eventRef","observedAt","operation","disposition"],optional:["domainCommandRef"],checks:{id:nonempty,tenantId:nonempty,connectorId:nonempty,sourceRef:nonempty,targetRef:nonempty,eventRef:nonempty,observedAt:timestamp,operation:enumCheck(["RECEIVED","STAGED","RECONCILED","EXPORTED"]),disposition:enumCheck(["PENDING","ACCEPTED","REJECTED","UNKNOWN"]),domainCommandRef:nonempty}},
};
const reject=(issues:readonly string[]):IntegrationParseResult=>Object.freeze({ok:false as const,issues:Object.freeze([...issues])});
const hasAll=(r:IntegrationRecord,ks:readonly string[])=>ks.every(k=>own(r,k));
const hasNone=(r:IntegrationRecord,ks:readonly string[])=>ks.every(k=>!own(r,k));
const ref=(r:IntegrationRecord,k:string)=>String(r[k]);
const time=(r:IntegrationRecord,k:string)=>Date.parse(ref(r,k));
const securitySensitive=/^(?:approval|approved|inspectioncredit|creditgranted|conditionclosed|recommendationclosed|technicalduedate|riskapproved|fitnessapproved|workverified|authorization|authorized|audit|auditlog|signature|role|permission|accessgranted|evidenceverified|lifecycleclosed|closedat|decisionstatus)(?:$|[_\-./])/i;
/** Import/export can stage data; no inbound mapping to protected AIM state is permitted by this projection contract. */
export function isProtectedTargetField(field:string):boolean {
 return field.split(/[.\/]/).some(segment=>securitySensitive.test(segment)||/^(?:approvedBy|approvedAt|approvedStatus|creditGranted|approvalRef|closureDecision|governingDue|technicalDue|recordApproved)$/i.test(segment));
}
export function parseIntegrationSnapshot(value:unknown):IntegrationParseResult{
 if(!plain(value)||Object.keys(value).length!==INTEGRATION_KEYS.length||INTEGRATION_KEYS.some(k=>!Array.isArray(value[k]))||Object.keys(value).some(k=>!INTEGRATION_KEYS.includes(k as IntegrationKey)))return reject(["Invalid INT snapshot structure"]);
 const issues:string[]=[];const result={} as Record<IntegrationKey,readonly IntegrationRecord[]>;
 for(const key of INTEGRATION_KEYS){
  const rows=value[key] as unknown[];if(rows.length>10000){issues.push(`${key}: collection limit exceeded`);result[key]=Object.freeze([]);continue;}
  const accepted:IntegrationRecord[]=[];const spec=specs[key];
  for(let i=0;i<rows.length;i++){
   const r=rows[i];if(!plain(r)||!spec.required.every(k=>own(r,k))||Object.keys(r).some(k=>!spec.required.includes(k)&&!(spec.optional??[]).includes(k))||Object.entries(spec.checks).some(([k,fn])=>own(r,k)&&!fn(r[k]))){issues.push(`${key}[${i}]: invalid record`);continue;}
   const copied=Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Array.isArray(v)?Object.freeze([...v]):v])) as IntegrationRecord;
   accepted.push(Object.freeze(copied));
  }
  if(new Set(accepted.map(r=>r.id)).size!==accepted.length)issues.push(`${key}: duplicate id`);
  result[key]=Object.freeze(accepted);
 }
 if(issues.length)return reject(issues);
 const maps=Object.fromEntries(INTEGRATION_KEYS.map(k=>[k,new Map(result[k].map(r=>[r.id,r]))])) as Record<IntegrationKey,Map<string,IntegrationRecord>>;
 const link=(item:IntegrationRecord,targetKey:IntegrationKey,field:string)=>{
  const target=maps[targetKey].get(ref(item,field));if(!target||target.tenantId!==item.tenantId){issues.push(`${item.id}: invalid ${field} / tenant scope`);return undefined;}return target;
 };
 for(const [key,rows] of Object.entries(result) as [IntegrationKey,readonly IntegrationRecord[]][]){for(const row of rows){
  if(key==="connectors")link(row,"systems","systemId");
  if(["apiContracts","eventSubscriptions","contracts","checkpoints","reconciliationRuns","deadLetters","health","lineage"].includes(key))link(row,"connectors","connectorId");
  if(key==="mappings"){const c=link(row,"contracts","contractId");if(row.direction==="INBOUND"&&(row.fieldOwner==="AIM"||isProtectedTargetField(ref(row,"targetField"))))issues.push(`${row.id}: inbound cannot own or mutate protected AIM state`);
   if(row.state==="VERIFIED"&&!hasAll(row,["reviewedAt","reviewRef"]))issues.push(`${row.id}: verified mapping missing independent review`);
   if(row.state!=="VERIFIED"&&!hasNone(row,["reviewedAt","reviewRef"]))issues.push(`${row.id}: staged mapping cannot carry verified review`);
   if(!hasAll(row,["externalObjectRef","aimObjectRef"])&&!hasNone(row,["externalObjectRef","aimObjectRef"]))issues.push(`${row.id}: partial object identity mapping`);
   if(c&&row.direction==="INBOUND"&&c.status==="RETIRED")issues.push(`${row.id}: inbound mapping for retired contract`);
  }
  if(key==="jobs"){const c=link(row,"contracts","contractId"),connector=link(row,"connectors","connectorId");if(c&&connector&&c.connectorId!==connector.id)issues.push(`${row.id}: contract belongs to another connector`);
   const received=Number(row.receivedRows),valid=Number(row.validatedRows),bad=Number(row.rejectedRows);
   if(valid+bad>received)issues.push(`${row.id}: row totals exceed received`);
   if(["VALIDATED","PARTIAL","REJECTED","PROMOTED"].includes(ref(row,"state"))&&(!hasAll(row,["validatedAt"])||valid+bad!==received))issues.push(`${row.id}: terminal staging lacks complete validation`);
   if(row.state==="PROMOTED"&&(!hasAll(row,["promotionRef"])||bad!==0||valid!==received||!c||c.status!=="ACTIVE"))issues.push(`${row.id}: promotion lacks clean validated active contract / authorization reference`);
   if(row.state!=="PROMOTED"&&own(row,"promotionRef"))issues.push(`${row.id}: promotion evidence on non-promoted job`);
   if(row.state==="VALIDATED"&&bad!==0||row.state==="PARTIAL"&&(bad===0||valid===0)||row.state==="REJECTED"&&bad===0)issues.push(`${row.id}: incompatible validation outcome`);
   if(row.state==="RECEIVED"&&(valid!==0||bad!==0||own(row,"validatedAt")))issues.push(`${row.id}: received job already assessed`);
  }
  if(key==="contracts"){
   if(row.status==="ACTIVE"&&!hasAll(row,["activatedAt","approvalRef"]))issues.push(`${row.id}: active contract missing controlled activation`);
   if(row.status==="DRAFT"&&!hasNone(row,["activatedAt","approvalRef"]))issues.push(`${row.id}: draft contract carrying activation`);
  }
  if(key==="conflicts"){
   const c=link(row,"contracts","contractId"),connector=link(row,"connectors","connectorId");if(c&&connector&&c.connectorId!==connector.id)issues.push(`${row.id}: conflict/connector mismatch`);
   const keys=["resolvedAt","resolutionRef","reviewerRef"];
   if(row.status==="RESOLVED"&&(!hasAll(row,keys)||time(row,"resolvedAt")<time(row,"detectedAt")))issues.push(`${row.id}: conflict resolution lacks independent review`);
   if(row.status==="OPEN"&&!hasNone(row,keys))issues.push(`${row.id}: open conflict marked resolved`);
  }
  if(key==="reconciliationRuns"){
   if(Number(row.matchedCount)+Number(row.exceptionCount)>Number(row.inspectedCount))issues.push(`${row.id}: invalid reconciliation totals`);
   if(row.state==="RUNNING"&&own(row,"completedAt")||row.state!=="RUNNING"&&!own(row,"completedAt"))issues.push(`${row.id}: incorrect completion marker`);
   if(own(row,"completedAt")&&time(row,"completedAt")<time(row,"startedAt"))issues.push(`${row.id}: completion precedes start`);
   if(row.state==="SUCCEEDED"&&Number(row.exceptionCount)>0)issues.push(`${row.id}: exceptions cannot be hidden by success`);
  }
  if(key==="deadLetters"&&(row.status==="RESOLVED")!==own(row,"resolvedAt"))issues.push(`${row.id}: unresolved message presented as complete`);
  if(key==="lineage"&&row.operation!=="RECONCILED"&&own(row,"domainCommandRef"))issues.push(`${row.id}: domain command proof cannot be inferred from mere transfer`);
  if(key==="health"){
    // Each dimension is an independent observation, never a synthetic aggregate 'healthy' classification.
  }
 }}
 const dimensions=new Set<string>();for(const h of result.health){const key=`${h.tenantId}:${h.connectorId}:${h.dimension}`;if(dimensions.has(key))issues.push(`${h.connectorId}: duplicate health dimension ${h.dimension}`);dimensions.add(key);}
 return issues.length?reject(issues):Object.freeze({ok:true as const,snapshot:Object.freeze(result)});
}
export function integrationRows(data:IntegrationSnapshot,key:IntegrationKey,query:string):readonly IntegrationRecord[]{
 const tokens=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return data[key].filter(r=>{const str=Object.values(r).map(v=>Array.isArray(v)?v.join(" "):String(v)).join(" ").toLocaleLowerCase();return tokens.every(t=>str.includes(t));});
}
export function integrationContext(data:IntegrationSnapshot,key:IntegrationKey,id:string):IntegrationRecord|undefined{return data[key].find(r=>r.id===id);}
