/** Phase 15 · ANA-001–010. Read-only projections, never an engineering system of record. */
export const ANALYTICS_KEYS = ["metrics","workItems","risks","corrosion","remainingLife","obligations","badActors","quality","forecasts","reports","executions"] as const;
export type AnalyticsKey = typeof ANALYTICS_KEYS[number];
export type AnalyticsRecord = Readonly<{id:string;tenantId:string} & Record<string,unknown>>;
export type AnalyticsSnapshot = Readonly<Record<AnalyticsKey,readonly AnalyticsRecord[]>>;
export type AnalyticsParseResult = Readonly<{ok:true;snapshot:AnalyticsSnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_ANALYTICS:AnalyticsSnapshot=Object.freeze(Object.fromEntries(ANALYTICS_KEYS.map(k=>[k,Object.freeze([])])) as unknown as Record<AnalyticsKey,readonly AnalyticsRecord[]>);
const own=(x:object,k:string)=>Object.prototype.hasOwnProperty.call(x,k);
const plain=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const ref=(v:unknown)=>typeof v==="string"&&v.length>0&&v.length<=512&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const enumOf=(allowed:readonly string[])=>(v:unknown)=>typeof v==="string"&&allowed.includes(v);
const date=(v:unknown)=>{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v))return false;const a=/^(\d{4})-(\d{2})-(\d{2})/.exec(v);if(!a||!Number.isFinite(Date.parse(v)))return false;const y=+a[1]!,m=+a[2]!,d=+a[3]!;return y>0&&m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();};
const number=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=1e12;
const nonnegative=(v:unknown)=>number(v)&&v>=0;
const count=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=1e9;
const percent=(v:unknown)=>number(v)&&v>=0&&v<=100;
const refArray=(v:unknown)=>Array.isArray(v)&&v.length<=30&&v.every(ref)&&new Set(v).size===v.length;
const condition=["AVAILABLE","PARTIAL","UNKNOWN","MISSING","STALE"] as const;
const recordState=["APPROVED","PROJECTED","SCENARIO","UNKNOWN"] as const;
const confidence=["HIGH","MEDIUM","LOW","UNKNOWN"] as const;
const domain=["AIR","DGM","COR","INS","RBI","FND","REC","ACT","IOW","FFS","GOV","INT","ANA","FLD","VIS"] as const;
type Spec=Readonly<{required:readonly string[];optional?:readonly string[];checks:Readonly<Record<string,(v:unknown)=>boolean>>}>;
const specs:Readonly<Record<AnalyticsKey,Spec>>={
 metrics:{required:["id","tenantId","name","metricType","dataState","quality","asOf","sourceRef","methodRevision"],optional:["value","unit","qualityId"],checks:{name:ref,metricType:enumOf(["RISK","CONDITION","INSPECTION","REPAIR","RECOMMENDATION","DEFERRAL","IOW","DATA_CONFIDENCE","WORKLOAD"]),dataState:enumOf(recordState),quality:enumOf(condition),asOf:date,sourceRef:ref,methodRevision:ref,value:number,unit:ref,qualityId:ref}},
 workItems:{required:["id","tenantId","ownerDomain","objectRef","kind","state","sourceRef","asOf"],optional:["dueAt","assetRef"],checks:{ownerDomain:enumOf(domain),objectRef:ref,kind:enumOf(["REVIEW","APPROVAL","REASSESSMENT","OBLIGATION","ACTION","ESCALATION"]),state:enumOf(["PENDING","IN_PROGRESS","OVERDUE","COMPLETED","UNKNOWN"]),sourceRef:ref,asOf:date,dueAt:date,assetRef:ref}},
 risks:{required:["id","tenantId","assetRef","assessmentRef","methodRevision","asOf","period","dataState","riskBand","quality","sourceRef"],optional:["probabilityClass","consequenceClass"],checks:{assetRef:ref,assessmentRef:ref,methodRevision:ref,asOf:date,period:enumOf(["CURRENT","FUTURE"]),dataState:enumOf(recordState),riskBand:enumOf(["VERY_LOW","LOW","MEDIUM","HIGH","VERY_HIGH","UNKNOWN"]),quality:enumOf(condition),sourceRef:ref,probabilityClass:ref,consequenceClass:ref}},
 corrosion:{required:["id","tenantId","circuitRef","readingSetRef","asOf","dataState","quality","sourceRef","methodRevision"],optional:["rateMmPerYear"],checks:{circuitRef:ref,readingSetRef:ref,asOf:date,dataState:enumOf(recordState),quality:enumOf(condition),sourceRef:ref,methodRevision:ref,rateMmPerYear:nonnegative}},
 remainingLife:{required:["id","tenantId","assetRef","sourceDomain","sourceRecordRef","asOf","dataState","quality","sourceRef","methodRevision"],optional:["years"],checks:{assetRef:ref,sourceDomain:enumOf(["COR","FFS"]),sourceRecordRef:ref,asOf:date,dataState:enumOf(recordState),quality:enumOf(condition),sourceRef:ref,methodRevision:ref,years:nonnegative}},
 obligations:{required:["id","tenantId","ownerDomain","objectRef","assetRef","technicalDueAt","asOf","state","sourceRef"],optional:["authorizedExecutionDeadline","authorizationRef"],checks:{ownerDomain:enumOf(["INS","ACT","REC","FND","FFS","IOW"]),objectRef:ref,assetRef:ref,technicalDueAt:date,asOf:date,state:enumOf(["UPCOMING","OVERDUE","COMPLETED","UNKNOWN"]),sourceRef:ref,authorizedExecutionDeadline:date,authorizationRef:ref}},
 badActors:{required:["id","tenantId","assetRef","rank","scoreBasisRef","methodRevision","windowStart","windowEnd","contributingSources","dataState","quality"],checks:{assetRef:ref,rank:count,scoreBasisRef:ref,methodRevision:ref,windowStart:date,windowEnd:date,contributingSources:refArray,dataState:enumOf(recordState),quality:enumOf(condition)}},
 quality:{required:["id","tenantId","domain","scopeRef","status","asOf","evidenceRef"],optional:["completenessPct","freshnessAt","missingCount"],checks:{domain:enumOf(domain),scopeRef:ref,status:enumOf(condition),asOf:date,evidenceRef:ref,completenessPct:percent,freshnessAt:date,missingCount:count}},
 forecasts:{required:["id","tenantId","horizonStart","horizonEnd","workloadType","projectedCount","sourceRef","methodRevision","dataState","confidence"],checks:{horizonStart:date,horizonEnd:date,workloadType:enumOf(["INSPECTION","REPAIR","REVIEW","MONITORING","REASSESSMENT"]),projectedCount:count,sourceRef:ref,methodRevision:ref,dataState:enumOf(["PROJECTED","SCENARIO"]),confidence:enumOf(confidence)}},
 reports:{required:["id","tenantId","title","semanticModelRef","definitionRevision","state","ownerRef","sourceRef"],checks:{title:ref,semanticModelRef:ref,definitionRevision:ref,state:enumOf(["DRAFT","ACTIVE","ARCHIVED"]),ownerRef:ref,sourceRef:ref}},
 executions:{required:["id","tenantId","reportId","executedAt","state","sourceRef","rowCount"],optional:["resultRef"],checks:{reportId:ref,executedAt:date,state:enumOf(["QUEUED","COMPLETED","FAILED"]),sourceRef:ref,rowCount:count,resultRef:ref}}
};
function failed(issues:readonly string[]):AnalyticsParseResult{return Object.freeze({ok:false as const,issues:Object.freeze([...issues])});}
const sameTenant=(a:AnalyticsRecord,b:AnalyticsRecord)=>a.tenantId===b.tenantId;
/** Atomic validation: never render the valid subset of an invalid projection. */
export function parseAnalyticsSnapshot(input:unknown):AnalyticsParseResult{
 if(!plain(input)||Object.keys(input).length!==ANALYTICS_KEYS.length||ANALYTICS_KEYS.some(k=>!Array.isArray(input[k]))||Object.keys(input).some(k=>!ANALYTICS_KEYS.includes(k as AnalyticsKey)))return failed(["Invalid ANA snapshot structure"]);
 const issues:string[]=[];const parsed={} as Record<AnalyticsKey,readonly AnalyticsRecord[]>;
 for(const key of ANALYTICS_KEYS){const rows=input[key] as unknown[];const {required,optional=[],checks}=specs[key];const accepted:AnalyticsRecord[]=[];
  if(rows.length>10000){issues.push(`${key}: collection limit exceeded`);parsed[key]=Object.freeze([]);continue;}
  for(let i=0;i<rows.length;i++){const item=rows[i];if(!plain(item)||!required.every(k=>own(item,k))||Object.keys(item).some(k=>!required.includes(k)&&!optional.includes(k))||Object.entries(checks).some(([k,fn])=>own(item,k)&&!fn(item[k]))||!ref(item.id)||!ref(item.tenantId)){issues.push(`${key}[${i}]: invalid record`);continue;}
   const clone=Object.fromEntries(Object.entries(item).map(([k,v])=>[k,Array.isArray(v)?Object.freeze([...v]):v])) as AnalyticsRecord;accepted.push(Object.freeze(clone));
  }
  if(new Set(accepted.map(r=>r.id)).size!==accepted.length)issues.push(`${key}: duplicate identities`);
  parsed[key]=Object.freeze(accepted);
 }
 if(issues.length)return failed(issues);
 const tenants=new Set(ANALYTICS_KEYS.flatMap(k=>parsed[k].map(r=>r.tenantId)));if(tenants.size>1)issues.push("Mixed-tenant analytics projection");
 const quality=new Map(parsed.quality.map(r=>[r.id,r]));const reports=new Map(parsed.reports.map(r=>[r.id,r]));
 for(const item of parsed.metrics){
   if(own(item,"value")!==own(item,"unit"))issues.push(`${item.id}: metric value/unit must be paired`);
   if((item.quality==="MISSING"||item.quality==="UNKNOWN"||item.quality==="STALE")&&own(item,"value"))issues.push(`${item.id}: no trusted metric value with unavailable quality`);
   if(own(item,"qualityId")){const q=quality.get(String(item.qualityId));if(!q||!sameTenant(item,q))issues.push(`${item.id}: invalid quality reference`);}
   if(item.dataState==="APPROVED"&&(item.quality!=="AVAILABLE"||!own(item,"value")))issues.push(`${item.id}: approved metric must be available and populated`);
 }
 for(const key of ["risks","corrosion","remainingLife"] as const)for(const item of parsed[key]){
   const metric=key==="risks"?"riskBand":key==="corrosion"?"rateMmPerYear":"years";
   if((item.quality==="UNKNOWN"||item.quality==="MISSING"||item.quality==="STALE")&&(key==="risks"?item.riskBand!=="UNKNOWN":own(item,metric)))issues.push(`${item.id}: unknown/stale evidence cannot provide an asserted result`);
   if(item.dataState==="APPROVED"&&(item.quality!=="AVAILABLE"||key==="risks"&&item.riskBand==="UNKNOWN"||key!=="risks"&&!own(item,metric)))issues.push(`${item.id}: approved result requires complete evidence`);
 }
 for(const o of parsed.obligations){
  if(own(o,"authorizedExecutionDeadline")!==own(o,"authorizationRef"))issues.push(`${o.id}: extension requires independent authorization reference`);
  if(own(o,"authorizedExecutionDeadline")&&Date.parse(String(o.authorizedExecutionDeadline))<Date.parse(String(o.technicalDueAt)))issues.push(`${o.id}: authorized extension precedes technical due date`);
 }
 for(const b of parsed.badActors){if(Number(b.rank)<1||Date.parse(String(b.windowStart))>Date.parse(String(b.windowEnd)))issues.push(`${b.id}: invalid ranking window`);if(b.dataState==="APPROVED"&&(b.quality!=="AVAILABLE"||(b.contributingSources as string[]).length===0))issues.push(`${b.id}: unsupported ranking`);}
 for(const f of parsed.forecasts){if(Date.parse(String(f.horizonStart))>Date.parse(String(f.horizonEnd)))issues.push(`${f.id}: forecast horizon inverted`);}
 for(const e of parsed.executions){const r=reports.get(String(e.reportId));if(!r||!sameTenant(e,r))issues.push(`${e.id}: invalid report link`);if((e.state==="COMPLETED")!==own(e,"resultRef"))issues.push(`${e.id}: result reference does not match execution state`);if(e.state!=="COMPLETED"&&Number(e.rowCount)!==0)issues.push(`${e.id}: unfinished result has nonzero row count`);}
 const rankKeys=new Set<string>();for(const b of parsed.badActors){const k=`${b.windowStart}|${b.windowEnd}|${b.methodRevision}|${b.rank}`;if(rankKeys.has(k))issues.push(`${b.id}: duplicate rank within methodology/window`);rankKeys.add(k);}
 return issues.length?failed(issues):Object.freeze({ok:true as const,snapshot:Object.freeze(parsed)});
}
export function analyticsRows(snapshot:AnalyticsSnapshot,key:AnalyticsKey,search:string):readonly AnalyticsRecord[]{const parts=search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return snapshot[key].filter(r=>{const s=Object.values(r).map(v=>Array.isArray(v)?v.join(" "):String(v)).join(" ").toLocaleLowerCase();return parts.every(p=>s.includes(p));});}
/** Corrosion and FFS remaining-life projections are intentionally never merged. */
export function remainingLifeByDomain(snapshot:AnalyticsSnapshot,sourceDomain:"COR"|"FFS"):readonly AnalyticsRecord[]{return snapshot.remainingLife.filter(r=>r.sourceDomain===sourceDomain);}
/** Do not average risk categories with incompatible methodologies. */
export function comparableRiskGroups(snapshot:AnalyticsSnapshot):ReadonlyMap<string,readonly AnalyticsRecord[]>{const m=new Map<string,AnalyticsRecord[]>();for(const r of snapshot.risks){const key=`${r.methodRevision} / ${r.period} / ${r.dataState}`;const values=m.get(key)??[];values.push(r);m.set(key,values);}return m;}
