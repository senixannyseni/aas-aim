/** IOW-001–011 — governed read-only projections. This validator checks coherence,
 * not the identity, authority or authenticity of the upstream source. In particular
 * it NEVER computes threshold compliance from raw samples or authorizes a disposition.
 */
export const IOW_STATES=["DRAFT","IN_REVIEW","APPROVED","WITHDRAWN"] as const;
export const IOW_CLASSES=["CRITICAL","STANDARD","INFORMATIONAL"] as const;
export const SOURCE_KINDS=["HISTORIAN","MANUAL","DERIVED"] as const;
export const SOURCE_STATES=["CONNECTED","DEGRADED","DISCONNECTED","UNKNOWN"] as const;
export const QUALITY_STATES=["CURRENT","STALE","MISSING","UNKNOWN"] as const;
export const SAMPLE_STATES=["VALID","SUSPECT","INVALID","STALE","MISSING"] as const;
export const EXCURSION_STATES=["OPEN","PROCESS_RECOVERED","UNDER_REVIEW","DISPOSITIONED"] as const;
export const DISPOSITION_KINDS=["CONFIRMED","DISMISSED","MONITOR"] as const;
export type IowState=typeof IOW_STATES[number];
export type SourceState=typeof SOURCE_STATES[number];
export type QualityState=typeof QUALITY_STATES[number];
export type ExcursionState=typeof EXCURSION_STATES[number];
export type IowDefinition=Readonly<{
 id:string;code:string;assetId:string;revision:string;title:string;classification:typeof IOW_CLASSES[number];state:IowState;
 basisRef:string;createdAt:string;approvedRef?:string;approvedAt?:string;approverRef?:string;
}>;
export type IowLimit=Readonly<{
 id:string;iowId:string;revision:string;variableRef:string;unit:string;ruleRef:string;lower?:number;upper?:number;
}>;
export type IowSource=Readonly<{
 id:string;iowId:string;variableRef:string;kind:typeof SOURCE_KINDS[number];state:SourceState;
 systemRef:string;mappingRef:string;expressionRef?:string;lastReceivedAt?:string;
}>;
export type IowLink=Readonly<{
 id:string;iowId:string;assetId:string;mechanismRef?:string;barrierRef?:string;
}>;
export type IowQuality=Readonly<{
 id:string;sourceId:string;state:QualityState;assessedAt:string;basisRef:string;lastValidAt?:string;
}>;
export type IowSample=Readonly<{
 id:string;iowId:string;sourceId:string;observedAt:string;state:typeof SAMPLE_STATES[number];value:number|null;
 evidenceRef:string;
}>;
export type IowExcursion=Readonly<{
 id:string;code:string;iowId:string;sourceId:string;revision:string;state:ExcursionState;
 openedAt:string;detectedAt:string;eventSourceRef:string;sampleId?:string;processRecoveredAt?:string;dispositionRef?:string;
}>;
export type IowDisposition=Readonly<{
 id:string;excursionId:string;revision:string;decision:typeof DISPOSITION_KINDS[number];
 reviewerRef:string;reviewedAt:string;technicalBasisRef:string;evidenceRefs:readonly string[];
}>;
export type IowFollowUp=Readonly<{
 id:string;excursionId:string;owningDomain:"FND"|"INS"|"DGM"|"ACT"|"REC"|"RBI"|"FFS";
 objectRef:string;basisRef:string;
}>;
export type IowSnapshot=Readonly<{
 definitions:readonly IowDefinition[];limits:readonly IowLimit[];sources:readonly IowSource[];
 links:readonly IowLink[];quality:readonly IowQuality[];samples:readonly IowSample[];
 excursions:readonly IowExcursion[];dispositions:readonly IowDisposition[];followUps:readonly IowFollowUp[];
}>;
export type IowParseResult=Readonly<{ok:true;snapshot:IowSnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_IOW:IowSnapshot=Object.freeze({definitions:Object.freeze([]),limits:Object.freeze([]),sources:Object.freeze([]),links:Object.freeze([]),quality:Object.freeze([]),samples:Object.freeze([]),excursions:Object.freeze([]),dispositions:Object.freeze([]),followUps:Object.freeze([])});
const KEYS=["definitions","limits","sources","links","quality","samples","excursions","dispositions","followUps"] as const;
const own=(v:object,k:string):boolean=>Object.prototype.hasOwnProperty.call(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const string=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=2500&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const oneOf=<T extends string>(v:unknown,choices:readonly T[]):v is T=>typeof v==="string"&&choices.includes(v as T);
const shape=(v:unknown,mandatory:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&mandatory.every(k=>own(v,k))&&Object.keys(v).every(k=>mandatory.includes(k)||optional.includes(k));
const strings=(v:Record<string,unknown>,keys:string[])=>keys.every(k=>string(v[k]));
const optString=(v:Record<string,unknown>,k:string)=>!own(v,k)||string(v[k]);
const number=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const instant=(v:unknown):v is string=>{
 if(typeof v!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
 if(!m)return false;
 const y=+m[1]!,mo=+m[2]!,day=+m[3]!,h=+m[4]!,mi=+m[5]!,s=+m[6]!,z=m[7]!;
 const leap=y%4===0&&(y%100!==0||y%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 return y>0&&mo>=1&&mo<=12&&day>=1&&day<=days[mo-1]!&&h<=23&&mi<=59&&s<=59&&
 (z==="Z"||(+z.slice(1,3)<=14&&+z.slice(4,6)<=59&&(+z.slice(1,3)!==14||+z.slice(4,6)===0)))&&Number.isFinite(Date.parse(v));
};
const optInstant=(v:Record<string,unknown>,k:string)=>!own(v,k)||instant(v[k]);
const refs=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=2000&&v.every(string)&&new Set(v).size===v.length;
const defValid=(v:unknown):v is IowDefinition=>shape(v,["id","code","assetId","revision","title","classification","state","basisRef","createdAt"],["approvedRef","approvedAt","approverRef"])
 &&strings(v,["id","code","assetId","revision","title","basisRef"])&&oneOf(v.classification,IOW_CLASSES)&&oneOf(v.state,IOW_STATES)&&instant(v.createdAt)
 &&optString(v,"approvedRef")&&optString(v,"approverRef")&&optInstant(v,"approvedAt")
 &&(v.state!=="APPROVED"||(string(v.approvedRef)&&instant(v.approvedAt)&&string(v.approverRef)))
 &&(v.state==="APPROVED"||(!own(v,"approvedRef")&&!own(v,"approvedAt")&&!own(v,"approverRef")));
const limitValid=(v:unknown):v is IowLimit=>shape(v,["id","iowId","revision","variableRef","unit","ruleRef"],["lower","upper"])
 &&strings(v,["id","iowId","revision","variableRef","unit","ruleRef"])
 &&(own(v,"lower")||own(v,"upper"))&&(!own(v,"lower")||number(v.lower))&&(!own(v,"upper")||number(v.upper))
 &&(!own(v,"lower")||!own(v,"upper")||Number(v.lower)<Number(v.upper));
const sourceValid=(v:unknown):v is IowSource=>shape(v,["id","iowId","variableRef","kind","state","systemRef","mappingRef"],["expressionRef","lastReceivedAt"])
 &&strings(v,["id","iowId","variableRef","systemRef","mappingRef"])&&oneOf(v.kind,SOURCE_KINDS)&&oneOf(v.state,SOURCE_STATES)&&optString(v,"expressionRef")&&optInstant(v,"lastReceivedAt")
 &&(v.kind!=="DERIVED"||string(v.expressionRef))&&(v.kind==="DERIVED"||!own(v,"expressionRef"));
const linkValid=(v:unknown):v is IowLink=>shape(v,["id","iowId","assetId"],["mechanismRef","barrierRef"])
 &&strings(v,["id","iowId","assetId"])&&optString(v,"mechanismRef")&&optString(v,"barrierRef");
const qualityValid=(v:unknown):v is IowQuality=>shape(v,["id","sourceId","state","assessedAt","basisRef"],["lastValidAt"])
 &&strings(v,["id","sourceId","basisRef"])&&oneOf(v.state,QUALITY_STATES)&&instant(v.assessedAt)&&optInstant(v,"lastValidAt")
 &&(v.state!=="CURRENT"||instant(v.lastValidAt))&&(!v.lastValidAt||Date.parse(v.lastValidAt as string)<=Date.parse(v.assessedAt as string));
const sampleValid=(v:unknown):v is IowSample=>shape(v,["id","iowId","sourceId","observedAt","state","value","evidenceRef"])
 &&strings(v,["id","iowId","sourceId","evidenceRef"])&&instant(v.observedAt)&&oneOf(v.state,SAMPLE_STATES)
 &&(v.state==="VALID"?number(v.value):v.value===null);
const excursionValid=(v:unknown):v is IowExcursion=>shape(v,["id","code","iowId","sourceId","revision","state","openedAt","detectedAt","eventSourceRef"],["sampleId","processRecoveredAt","dispositionRef"])
 &&strings(v,["id","code","iowId","sourceId","revision","eventSourceRef"])&&oneOf(v.state,EXCURSION_STATES)
 &&instant(v.openedAt)&&instant(v.detectedAt)&&optString(v,"sampleId")&&optInstant(v,"processRecoveredAt")&&optString(v,"dispositionRef")
 &&Date.parse(v.detectedAt as string)>=Date.parse(v.openedAt as string)
 &&(!own(v,"processRecoveredAt")||Date.parse(v.processRecoveredAt as string)>=Date.parse(v.openedAt as string))
 &&(!["PROCESS_RECOVERED"].includes(v.state as string)||instant(v.processRecoveredAt))
 &&(v.state==="DISPOSITIONED"?string(v.dispositionRef):!own(v,"dispositionRef"));
const dispositionValid=(v:unknown):v is IowDisposition=>shape(v,["id","excursionId","revision","decision","reviewerRef","reviewedAt","technicalBasisRef","evidenceRefs"])
 &&strings(v,["id","excursionId","revision","reviewerRef","technicalBasisRef"])&&oneOf(v.decision,DISPOSITION_KINDS)&&instant(v.reviewedAt)&&refs(v.evidenceRefs)&&(v.evidenceRefs as string[]).length>0;
const followUpValid=(v:unknown):v is IowFollowUp=>shape(v,["id","excursionId","owningDomain","objectRef","basisRef"])
 &&strings(v,["id","excursionId","objectRef","basisRef"])&&oneOf(v.owningDomain,["FND","INS","DGM","ACT","REC","RBI","FFS"] as const);
const failed=(issues:string[]):IowParseResult=>Object.freeze({ok:false as const,issues:Object.freeze(issues)});
function collect<T extends {id:string}>(input:unknown,key:string,check:(x:unknown)=>x is T,issues:string[]):readonly T[]{
 if(!Array.isArray(input)||input.length>20000){issues.push(`${key}: invalid collection`);return Object.freeze([]);}
 const results:T[]=[];
 for(let i=0;i<input.length;i++){
  const v:unknown=input[i];if(!check(v)){issues.push(`${key}[${i}]: invalid record`);continue;}
  const rec:Record<string,unknown>={...v};if(own(rec,"evidenceRefs"))rec.evidenceRefs=Object.freeze([...(rec.evidenceRefs as string[])]);
  results.push(Object.freeze(rec) as T);
 }
 if(new Set(results.map(x=>x.id)).size!==results.length)issues.push(`${key}: duplicate record identity`);
 return Object.freeze(results);
}
export function parseIowSnapshot(input:unknown):IowParseResult{
 if(!plain(input)||Object.keys(input).some(k=>!KEYS.includes(k as typeof KEYS[number]))||KEYS.some(k=>!Array.isArray(input[k])))return failed(["Invalid IOW snapshot structure"]);
 const issues:string[]=[];
 const definitions=collect(input.definitions,"definitions",defValid,issues);
 const limits=collect(input.limits,"limits",limitValid,issues);
 const sources=collect(input.sources,"sources",sourceValid,issues);
 const links=collect(input.links,"links",linkValid,issues);
 const quality=collect(input.quality,"quality",qualityValid,issues);
 const samples=collect(input.samples,"samples",sampleValid,issues);
 const excursions=collect(input.excursions,"excursions",excursionValid,issues);
 const dispositions=collect(input.dispositions,"dispositions",dispositionValid,issues);
 const followUps=collect(input.followUps,"followUps",followUpValid,issues);
 const defs=new Map(definitions.map(x=>[x.id,x]));const srcs=new Map(sources.map(x=>[x.id,x]));
 const samps=new Map(samples.map(x=>[x.id,x]));const exs=new Map(excursions.map(x=>[x.id,x]));
 const disps=new Map(dispositions.map(x=>[x.id,x]));
 limits.forEach(l=>{const d=defs.get(l.iowId);if(!d||d.revision!==l.revision)issues.push(`${l.id}: IOW limit must reference owning definition revision`);});
 sources.forEach(s=>{if(!defs.has(s.iowId))issues.push(`${s.id}: source references absent IOW definition`);if(!limits.some(l=>l.iowId===s.iowId&&l.variableRef===s.variableRef))issues.push(`${s.id}: no controlled limit for source variable`);});
 links.forEach(l=>{const d=defs.get(l.iowId);if(!d||d.assetId!==l.assetId)issues.push(`${l.id}: inconsistent asset-to-IOW mapping`);});
 quality.forEach(q=>{const src=srcs.get(q.sourceId);if(!src)issues.push(`${q.id}: unknown monitored source`);if(src?.lastReceivedAt&&q.lastValidAt&&Date.parse(q.lastValidAt)>Date.parse(src.lastReceivedAt))issues.push(`${q.id}: quality last valid reading is newer than recorded source observation`);});
 if(new Set(quality.map(q=>q.sourceId)).size!==quality.length)issues.push("quality: ambiguous source status; one current assessment per source");
 samples.forEach(s=>{const src=srcs.get(s.sourceId);if(!src||src.iowId!==s.iowId||!defs.has(s.iowId))issues.push(`${s.id}: source / definition mismatch`);});
 excursions.forEach(e=>{
  const src=srcs.get(e.sourceId);if(!defs.has(e.iowId)||!src||src.iowId!==e.iowId)issues.push(`${e.id}: excursion source / definition mismatch`);
  if(e.sampleId){const s=samps.get(e.sampleId);if(!s||s.iowId!==e.iowId||s.sourceId!==e.sourceId||s.state!=="VALID")issues.push(`${e.id}: event sample must be a valid matching source sample`);}
  const dispositionsFor=dispositions.filter(d=>d.excursionId===e.id);
  if(e.state==="DISPOSITIONED"){
   const review=disps.get(e.dispositionRef??"");
   if(!review||review.excursionId!==e.id||review.revision!==e.revision)issues.push(`${e.id}: separate exact-revision technical disposition is required`);
  }else if(dispositionsFor.length)issues.push(`${e.id}: unreviewed excursion cannot carry accepted disposition`);
  if(dispositionsFor.length>1)issues.push(`${e.id}: ambiguous technical dispositions for one active revision`);
 });
 dispositions.forEach(d=>{const e=exs.get(d.excursionId);if(!e||Date.parse(d.reviewedAt)<Date.parse(e.detectedAt))issues.push(`${d.id}: disposition must follow detection of a referenced excursion`);});
 followUps.forEach(f=>{const e=exs.get(f.excursionId);if(!e||e.state!=="DISPOSITIONED")issues.push(`${f.id}: follow-up references unreviewed or absent excursion`);});
 if(issues.length)return failed(issues);
 return Object.freeze({ok:true as const,snapshot:Object.freeze({definitions,limits,sources,links,quality,samples,excursions,dispositions,followUps})});
}
export const filterIow=(records:readonly IowDefinition[],query:string,state:IowState|"ALL"="ALL"):readonly IowDefinition[]=>{
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return records.filter(r=>(state==="ALL"||r.state===state)&&words.every(w=>[r.id,r.code,r.assetId,r.title,r.basisRef].join(" ").toLocaleLowerCase().includes(w)));
};
export const filterExcursions=(records:readonly IowExcursion[],query:string,state:ExcursionState|"ALL"="ALL"):readonly IowExcursion[]=>{
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return records.filter(r=>(state==="ALL"||r.state===state)&&words.every(w=>[r.id,r.code,r.iowId,r.eventSourceRef].join(" ").toLocaleLowerCase().includes(w)));
};
export function definitionContext(snapshot:IowSnapshot,id:string){return Object.freeze({definition:snapshot.definitions.find(x=>x.id===id),limits:snapshot.limits.filter(x=>x.iowId===id),sources:snapshot.sources.filter(x=>x.iowId===id),links:snapshot.links.filter(x=>x.iowId===id),quality:snapshot.quality.filter(q=>snapshot.sources.some(s=>s.id===q.sourceId&&s.iowId===id)),samples:snapshot.samples.filter(x=>x.iowId===id),excursions:snapshot.excursions.filter(x=>x.iowId===id)});}
export function excursionContext(snapshot:IowSnapshot,id:string){return Object.freeze({excursion:snapshot.excursions.find(x=>x.id===id),disposition:snapshot.dispositions.find(x=>x.excursionId===id),followUps:snapshot.followUps.filter(x=>x.excursionId===id)});}
