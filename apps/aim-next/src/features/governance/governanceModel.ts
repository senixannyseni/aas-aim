/** GOV-001–014: presentation-only governance projections from an authenticated, scope-authorized source.
 * Validation here is structural; authentication, authorization, audit and approval remain server owned.
 * Never use these records to determine what the current browser principal is allowed to do.
 */
import {SCREENS} from "../../screenRegistry";

const CONTROLLED_FUNCTIONS:ReadonlySet<string>=new Set(SCREENS.flatMap(s=>s.protectedFunctions));
export const GOVERNANCE_KEYS = ["tenants","principals","profiles","grants","authorities","delegations","policies","auditEvents","revisions","packages","notificationRules","evidence","retentionPolicies","holds","aiPolicies","aiExecutions"] as const;
export type GovernanceKey = typeof GOVERNANCE_KEYS[number];
export type GovernanceRecord = Readonly<Record<string, unknown> & {id:string}>;
export type GovernanceSnapshot = Readonly<Record<GovernanceKey,readonly GovernanceRecord[]>>;
export type GovernanceParseResult = Readonly<{ok:true;snapshot:GovernanceSnapshot}> | Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_GOVERNANCE:GovernanceSnapshot = Object.freeze(Object.fromEntries(GOVERNANCE_KEYS.map(k=>[k,Object.freeze([])])) as unknown as Record<GovernanceKey,readonly GovernanceRecord[]>);

const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const nonempty=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=2048&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const oneOf=(v:unknown,options:readonly string[])=>typeof v==="string"&&options.includes(v);
const instant=(v:unknown):v is string=>{
 if(typeof v!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
 if(!m)return false;
 const yr=+m[1]!,mo=+m[2]!,day=+m[3]!,hour=+m[4]!,minute=+m[5]!,second=+m[6]!,tz=m[7]!;
 const days=[31,yr%4===0&&(yr%100!==0||yr%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 return yr>0&&mo>=1&&mo<=12&&day>=1&&day<=days[mo-1]!&&hour<=23&&minute<=59&&second<=59&&
 (tz==="Z"||(+tz.slice(1,3)<=14&&+tz.slice(4,6)<=59&&(+tz.slice(1,3)!==14||+tz.slice(4,6)===0)))&&Number.isFinite(Date.parse(v));
};
const optional=(v:Record<string,unknown>,k:string,check:(x:unknown)=>boolean)=>!own(v,k)||check(v[k]);
const arrayOf=(v:unknown,check:(x:unknown)=>boolean)=>Array.isArray(v)&&v.length<=1000&&v.every(check)&&new Set(v).size===v.length;
const textArray=(v:unknown)=>arrayOf(v,nonempty);
const digest=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{64}$/i.test(v);
const enumField=(options:readonly string[])=>(x:unknown)=>oneOf(x,options);
const RECORD_LIMIT=10000;
const specs:Record<GovernanceKey,Readonly<{required:readonly string[];optional?:readonly string[];checks:Readonly<Record<string,(x:unknown)=>boolean>>}>>={
 tenants:{required:["id","code","name"],checks:{id:nonempty,code:nonempty,name:nonempty}},
 principals:{required:["id","tenantId","displayName","kind","status","identityRef"],checks:{id:nonempty,tenantId:nonempty,displayName:nonempty,kind:enumField(["USER","SERVICE"]),status:enumField(["ACTIVE","SUSPENDED","REVOKED"]),identityRef:nonempty}},
 profiles:{required:["id","tenantId","name","capabilities"],checks:{id:nonempty,tenantId:nonempty,name:nonempty,capabilities:textArray}},
 grants:{required:["id","principalId","profileId","scopeKind","scopeRef","grantedAt"],optional:["expiresAt"],checks:{id:nonempty,principalId:nonempty,profileId:nonempty,scopeKind:enumField(["TENANT","SITE","UNIT","RESOURCE"]),scopeRef:nonempty,grantedAt:instant,expiresAt:instant}},
 authorities:{required:["id","principalId","scopeRef","discipline","decisionFunction","validFrom","status"],optional:["validUntil"],checks:{id:nonempty,principalId:nonempty,scopeRef:nonempty,discipline:nonempty,decisionFunction:(v)=>typeof v==="string"&&CONTROLLED_FUNCTIONS.has(v),validFrom:instant,validUntil:instant,status:enumField(["ACTIVE","SUSPENDED","REVOKED"])}},
 delegations:{required:["id","authorityId","delegatePrincipalId","validFrom","validUntil","basisRef","status"],checks:{id:nonempty,authorityId:nonempty,delegatePrincipalId:nonempty,validFrom:instant,validUntil:instant,basisRef:nonempty,status:enumField(["ACTIVE","REVOKED"])}},
 policies:{required:["id","tenantId","kind","domain","revision","status","basisRef"],optional:["activatedAt","approvedBy"],checks:{id:nonempty,tenantId:nonempty,kind:enumField(["WORKFLOW","STATE"]),domain:nonempty,revision:nonempty,status:enumField(["DRAFT","ACTIVE","RETIRED"]),basisRef:nonempty,activatedAt:instant,approvedBy:nonempty}},
 auditEvents:{required:["id","tenantId","actorRef","eventType","objectRef","objectRevision","occurredAt","integrityRef","outcome"],checks:{id:nonempty,tenantId:nonempty,actorRef:nonempty,eventType:nonempty,objectRef:nonempty,objectRevision:nonempty,occurredAt:instant,integrityRef:nonempty,outcome:enumField(["SUCCESS","DENIED","ERROR"])}},
 revisions:{required:["id","tenantId","objectRef","revision","authorRef","createdAt","changeBasisRef","status"],optional:["previousId"],checks:{id:nonempty,tenantId:nonempty,objectRef:nonempty,revision:nonempty,authorRef:nonempty,createdAt:instant,changeBasisRef:nonempty,status:enumField(["DRAFT","FROZEN","SUPERSEDED"]),previousId:nonempty}},
 packages:{required:["id","tenantId","kind","code","revision","status","basisRef"],optional:["approvalRef","approvedBy","approvedAt","effectiveAt"],checks:{id:nonempty,tenantId:nonempty,kind:enumField(["METHODOLOGY","CONFIGURATION"]),code:nonempty,revision:nonempty,status:enumField(["DRAFT","ACTIVE","WITHDRAWN"]),basisRef:nonempty,approvalRef:nonempty,approvedBy:nonempty,approvedAt:instant,effectiveAt:instant}},
 notificationRules:{required:["id","tenantId","code","eventType","recipientScope","ruleRef","status","escalationLevel"],checks:{id:nonempty,tenantId:nonempty,code:nonempty,eventType:nonempty,recipientScope:nonempty,ruleRef:nonempty,status:enumField(["ENABLED","DISABLED"]),escalationLevel:(v)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=10}},
 evidence:{required:["id","tenantId","objectRef","sourceRef","sha256","recordedAt","classification"],optional:["retentionPolicyId"],checks:{id:nonempty,tenantId:nonempty,objectRef:nonempty,sourceRef:nonempty,sha256:digest,recordedAt:instant,classification:enumField(["PUBLIC","INTERNAL","CONFIDENTIAL","RESTRICTED"]),retentionPolicyId:nonempty}},
 retentionPolicies:{required:["id","tenantId","code","years","status","legalBasisRef"],checks:{id:nonempty,tenantId:nonempty,code:nonempty,years:(v)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=200,status:enumField(["DRAFT","ACTIVE"]),legalBasisRef:nonempty}},
 holds:{required:["id","tenantId","policyId","objectRef","reasonRef","startAt","authorizedBy"],optional:["releasedAt"],checks:{id:nonempty,tenantId:nonempty,policyId:nonempty,objectRef:nonempty,reasonRef:nonempty,startAt:instant,authorizedBy:nonempty,releasedAt:instant}},
 aiPolicies:{required:["id","tenantId","code","revision","status","allowedTools","prohibitedFunctions","dataPolicyRef"],optional:["approvedBy","approvedAt","approvalRef"],checks:{id:nonempty,tenantId:nonempty,code:nonempty,revision:nonempty,status:enumField(["DRAFT","ACTIVE","RETIRED"]),allowedTools:textArray,prohibitedFunctions:textArray,dataPolicyRef:nonempty,approvedBy:nonempty,approvedAt:instant,approvalRef:nonempty}},
 aiExecutions:{required:["id","tenantId","policyId","executedAt","actorRef","modelRef","outputKind","sourceRefs","auditRef"],checks:{id:nonempty,tenantId:nonempty,policyId:nonempty,executedAt:instant,actorRef:nonempty,modelRef:nonempty,outputKind:enumField(["EXPLANATION","DRAFT","ASSISTIVE_ANALYSIS"]),sourceRefs:textArray,auditRef:nonempty}},
};
const fail=(issues:readonly string[]):GovernanceParseResult=>Object.freeze({ok:false as const,issues:Object.freeze([...issues])});
const recordValid=(raw:unknown,key:GovernanceKey):raw is GovernanceRecord=>{
 if(!plain(raw))return false;
 const spec=specs[key];
 return spec.required.every(k=>own(raw,k))&&Object.keys(raw).every(k=>spec.required.includes(k)||(spec.optional??[]).includes(k))&&
 Object.entries(spec.checks).every(([k,check])=>optional(raw,k,check));
};
const ref=(v:GovernanceRecord,k:string)=>String(v[k]);
const date=(v:GovernanceRecord,k:string)=>Date.parse(ref(v,k));
const sameTenant=(a:GovernanceRecord,b:GovernanceRecord)=>a.tenantId===b.tenantId;
const triples=(obj:GovernanceRecord,keys:readonly string[])=>keys.every(k=>own(obj,k))||keys.every(k=>!own(obj,k));
/** Rejects the entire snapshot if any record fails structural or cross-record checks. */
export function parseGovernanceSnapshot(input:unknown):GovernanceParseResult {
 if(!plain(input)||Object.keys(input).length!==GOVERNANCE_KEYS.length||GOVERNANCE_KEYS.some(k=>!Array.isArray(input[k]))||Object.keys(input).some(k=>!GOVERNANCE_KEYS.includes(k as GovernanceKey)))return fail(["Invalid GOV snapshot structure"]);
 const issues:string[]=[];
 const output={} as Record<GovernanceKey,readonly GovernanceRecord[]>;
 for(const key of GOVERNANCE_KEYS){
  const raw=input[key] as unknown[];
  if(raw.length>RECORD_LIMIT){issues.push(`${key}: collection exceeds limit`);output[key]=Object.freeze([]);continue;}
  const records:GovernanceRecord[]=[];
  for(let i=0;i<raw.length;i++){
   const v=raw[i];if(!recordValid(v,key)){issues.push(`${key}[${i}]: invalid record`);continue;}
   const copy:Record<string,unknown>={...v};
   for(const [k,val] of Object.entries(copy))if(Array.isArray(val))copy[k]=Object.freeze([...val]);
   records.push(Object.freeze(copy) as GovernanceRecord);
  }
  if(new Set(records.map(x=>x.id)).size!==records.length)issues.push(`${key}: duplicate record id`);
  output[key]=Object.freeze(records);
 }
 if(issues.length)return fail(issues);
 const by=<K extends GovernanceKey>(key:K)=>new Map(output[key].map(v=>[v.id,v]));
 const tenants=by("tenants"),principals=by("principals"),profiles=by("profiles"),authorities=by("authorities"),retention=by("retentionPolicies"),aiPolicies=by("aiPolicies"),revisions=by("revisions");
 const hasTenant=(v:GovernanceRecord)=>tenants.has(ref(v,"tenantId"));
 const humanApprover=(tenantId:string,approverId:string)=>{const p=principals.get(approverId);return !!p&&p.kind==="USER"&&p.status==="ACTIVE"&&p.tenantId===tenantId;};
 for(const key of GOVERNANCE_KEYS){
  if(key==="tenants"||key==="grants"||key==="authorities"||key==="delegations")continue;
  for(const item of output[key])if(!hasTenant(item))issues.push(`${key}/${item.id}: unknown tenant`);
 }
 for(const g of output.grants){
  const p=principals.get(ref(g,"principalId")),profile=profiles.get(ref(g,"profileId"));
  if(!p||!profile||!sameTenant(p,profile))issues.push(`grants/${g.id}: principal/profile tenant mismatch`);
  if(g.scopeKind==="TENANT"&&p&&g.scopeRef!==p.tenantId)issues.push(`grants/${g.id}: tenant scope mismatch`);
  if(own(g,"expiresAt")&&date(g,"expiresAt")<=date(g,"grantedAt"))issues.push(`grants/${g.id}: invalid expiry`);
 }
 for(const a of output.authorities){
  const p=principals.get(ref(a,"principalId"));
  if(!p||p.kind!=="USER")issues.push(`authorities/${a.id}: engineering authority requires human principal`);
  if(a.status==="ACTIVE"&&p?.status!=="ACTIVE")issues.push(`authorities/${a.id}: principal is not active`);
  if(own(a,"validUntil")&&date(a,"validUntil")<=date(a,"validFrom"))issues.push(`authorities/${a.id}: invalid interval`);
 }
 for(const d of output.delegations){
  const a=authorities.get(ref(d,"authorityId")),p=principals.get(ref(d,"delegatePrincipalId"));
  if(!a||!p||p.kind!=="USER"||!principals.has(ref(a,"principalId"))||!sameTenant(p,principals.get(ref(a,"principalId"))!))issues.push(`delegations/${d.id}: invalid principal or authority`);
  if(date(d,"validUntil")<=date(d,"validFrom")||(a&&(date(d,"validFrom")<date(a,"validFrom")||(own(a,"validUntil")&&date(d,"validUntil")>date(a,"validUntil")))))issues.push(`delegations/${d.id}: invalid delegation interval`);
  if(a&&a.status!=="ACTIVE"&&d.status==="ACTIVE")issues.push(`delegations/${d.id}: non-active authority`);
 }
 for(const p of output.policies){
  if(p.status==="ACTIVE"&&(!own(p,"activatedAt")||!own(p,"approvedBy")))issues.push(`policies/${p.id}: active policy without provenance`);
  if(p.status!=="ACTIVE"&&(own(p,"activatedAt")||own(p,"approvedBy")))issues.push(`policies/${p.id}: unauthorized activation metadata`);
  if(own(p,"approvedBy")&&!humanApprover(ref(p,"tenantId"),ref(p,"approvedBy")))issues.push(`policies/${p.id}: invalid human approver`);
 }
 for(const p of output.packages){
  if(!triples(p,["approvalRef","approvedBy","approvedAt"]))issues.push(`packages/${p.id}: incomplete approval`);
  if(p.status==="ACTIVE"&&(!own(p,"effectiveAt")||!own(p,"approvalRef")))issues.push(`packages/${p.id}: active package without approval`);
  if(p.status==="DRAFT"&&(own(p,"effectiveAt")||own(p,"approvalRef")))issues.push(`packages/${p.id}: draft with approval metadata`);
  if(own(p,"approvedBy")&&!humanApprover(ref(p,"tenantId"),ref(p,"approvedBy")))issues.push(`packages/${p.id}: invalid human approver`);
  if(own(p,"approvedAt")&&own(p,"effectiveAt")&&date(p,"effectiveAt")<date(p,"approvedAt"))issues.push(`packages/${p.id}: effective date precedes approval`);
 }
 for(const r of output.revisions){
  if(own(r,"previousId")){
   const prev=revisions.get(ref(r,"previousId"));
   if(!prev||prev.objectRef!==r.objectRef||!sameTenant(prev,r)||date(prev,"createdAt")>=date(r,"createdAt"))issues.push(`revisions/${r.id}: invalid predecessor`);
  }
 }
 for(const e of output.evidence){
  if(own(e,"retentionPolicyId")){
   const p=retention.get(ref(e,"retentionPolicyId"));if(!p||!sameTenant(e,p))issues.push(`evidence/${e.id}: invalid retention policy`);
  }
 }
 for(const h of output.holds){
  const p=retention.get(ref(h,"policyId"));if(!p||!sameTenant(h,p))issues.push(`holds/${h.id}: invalid retention policy`);
  if(own(h,"releasedAt")&&date(h,"releasedAt")<=date(h,"startAt"))issues.push(`holds/${h.id}: release before hold`);
 }
 for(const p of output.aiPolicies){
  if(!triples(p,["approvedBy","approvedAt","approvalRef"]))issues.push(`aiPolicies/${p.id}: incomplete approval`);
  if(p.status==="ACTIVE"&&!own(p,"approvalRef"))issues.push(`aiPolicies/${p.id}: active AI policy without approval`);
  if(p.status==="DRAFT"&&own(p,"approvalRef"))issues.push(`aiPolicies/${p.id}: draft AI policy with approval`);
  if(own(p,"approvedBy")&&!humanApprover(ref(p,"tenantId"),ref(p,"approvedBy")))issues.push(`aiPolicies/${p.id}: invalid human approver`);
 }
 for(const x of output.aiExecutions){
  const p=aiPolicies.get(ref(x,"policyId"));if(!p||!sameTenant(x,p))issues.push(`aiExecutions/${x.id}: unknown policy`);
  // Audit records may be in a different archive partition; the reference remains mandatory.
 }
 return issues.length?fail(issues):Object.freeze({ok:true as const,snapshot:Object.freeze(output)});
}
export function governanceRows(data:GovernanceSnapshot,key:GovernanceKey,query:string):readonly GovernanceRecord[]{
 const tokens=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return data[key].filter(row=>{const haystack=Object.entries(row).filter(([k])=>!["sha256"].includes(k)).map(([,v])=>Array.isArray(v)?v.join(" "):String(v)).join(" ").toLocaleLowerCase();return tokens.every(t=>haystack.includes(t));});
}
export function governanceContext(data:GovernanceSnapshot,key:GovernanceKey,id:string):GovernanceRecord|undefined{return data[key].find(row=>row.id===id);}
