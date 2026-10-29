/**
 * AAS–AIM / INS canonical inspection frontend read boundary (INS-001..020).
 * These models show externally sourced, scope-authorized records. They NEVER
 * calculate, authorize, grant inspection credit, finalize events, or change
 * the governing technical due date. INS-016 alone owns the latter.
 */
export const REQUIREMENT_STATES = ["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED", "CANCELLED"] as const;
export const PLAN_STATES = ["DRAFT", "PROPOSED", "RELEASED", "CLOSED"] as const;
export const WORKPACK_STATES = ["DRAFT", "READY_FOR_REVIEW", "RELEASED", "WITHDRAWN"] as const;
export const EVENT_STATES = ["PLANNED", "IN_PROGRESS", "FIELD_COMPLETE", "TECHNICAL_REVIEW", "FINALIZED"] as const;
export const REVIEW_STATES = ["PENDING", "IN_REVIEW", "APPROVED", "RETURNED"] as const;
export const CREDIT_STATES = ["NOT_DETERMINED", "NOT_GRANTED", "PARTIAL", "GRANTED"] as const;
export const DUE_SOURCES = ["COR", "RBI", "FFS"] as const;
export const EFFECTIVENESS = ["UNKNOWN", "LOW", "MEDIUM", "HIGH"] as const;
export type InspectionRequirement = Readonly<{
  id:string; code:string; assetId:string; revision:string; status:typeof REQUIREMENT_STATES[number];
  basisReference:string; scope:string; technique:string; requiredCoveragePercent:number;
  requiredEffectiveness:typeof EFFECTIVENESS[number]; recurrence:string; approvedAt?:string;
}>;
export type DueCandidate = Readonly<{
  id:string; requirementId:string; source:typeof DUE_SOURCES[number]; dueAt:string; basisReference:string;
}>;
export type GoverningInspectionDue = Readonly<{
  id:string; requirementId:string; technicalDueAt:string; determinedAt:string; basisReference:string;
  consideredCandidateIds:readonly string[];
}>;
export type InspectionPlan = Readonly<{
  id:string; code:string; revision:string; status:typeof PLAN_STATES[number];
  requirementIds:readonly string[]; plannedStart:string; plannedEnd:string; basisReference:string;
}>;
export type InspectionWorkpack = Readonly<{
  id:string; planId:string; code:string; revision:string; status:typeof WORKPACK_STATES[number];
  requirementIds:readonly string[]; assignedResource:string; qualificationReference:string;
  scopeReference:string; releasedAt?:string;
}>;
export type InspectionEvent = Readonly<{
  id:string; workpackId:string; requirementId:string; eventAt:string;
  status:typeof EVENT_STATES[number]; technique:string; achievedCoveragePercent?:number;
  evidenceReferences:readonly string[]; resultReference?:string;
}>;
export type InspectionTechnicalReview = Readonly<{
  id:string; eventId:string; requirementId:string; status:typeof REVIEW_STATES[number];
  achievedCoveragePercent?:number; achievedEffectiveness:typeof EFFECTIVENESS[number];
  credit:typeof CREDIT_STATES[number]; residualObligation:string; basisReference?:string;
  reviewedAt?:string; creditBasisReference?:string; creditGrantedAt?:string;
}>;
export type InspectionSnapshot = Readonly<{
  requirements:readonly InspectionRequirement[]; candidates:readonly DueCandidate[];
  dueDecisions:readonly GoverningInspectionDue[]; plans:readonly InspectionPlan[];
  workpacks:readonly InspectionWorkpack[]; events:readonly InspectionEvent[];
  reviews:readonly InspectionTechnicalReview[];
}>;
export type InspectionParseResult = Readonly<{ok:true;snapshot:InspectionSnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_INSPECTION:InspectionSnapshot = Object.freeze({
  requirements:Object.freeze([]),candidates:Object.freeze([]),dueDecisions:Object.freeze([]),
  plans:Object.freeze([]),workpacks:Object.freeze([]),events:Object.freeze([]),reviews:Object.freeze([]),
});
const KEYS = ["requirements","candidates","dueDecisions","plans","workpacks","events","reviews"] as const;
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const text=(v:unknown):v is string=>typeof v==="string"&&v.length<=500&&v.trim().length>0&&!/[\u0000-\u001f\u007f]/.test(v);
const enumeration=<T extends string>(v:unknown,allowed:readonly T[]):v is T=>typeof v==="string"&&allowed.includes(v as T);
const percent=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100;
const iso=(v:unknown):v is string=>{
  if(typeof v!=="string")return false;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if(!m)return false;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  const days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  const zone=m[7]!;
  return year>0&&month>=1&&month<=12&&day>=1&&day<=days[month-1]!&&Number(m[4])<=23&&Number(m[5])<=59&&Number(m[6])<=59&&(zone==="Z"||(Number(zone.slice(1,3))<=14&&Number(zone.slice(4,6))<=59&&(Number(zone.slice(1,3))!==14||Number(zone.slice(4,6))===0)))&&Number.isFinite(Date.parse(v));
};
const fields=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const allText=(v:Record<string,unknown>,keys:readonly string[]):boolean=>keys.every(k=>text(v[k]));
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=5000&&v.every(text)&&new Set(v).size===v.length;
const copy=<T extends {id:string}>(v:T):T=>{
  const o:Record<string,unknown>={...v};
  for(const [key,value] of Object.entries(o))if(Array.isArray(value))o[key]=Object.freeze([...value]);
  return Object.freeze(o) as T;
};
const reject=(issues:string[]):InspectionParseResult=>Object.freeze({ok:false as const,issues:Object.freeze(issues)});
function collection<T extends {id:string}>(raw:unknown,key:string,read:(v:unknown)=>T|null,issues:string[]):readonly T[]{
  if(!Array.isArray(raw)||raw.length>30000){issues.push(`${key}: invalid collection`);return Object.freeze([]);}
  const out:T[]=[];
  raw.forEach((item,index)=>{const validated=read(item);if(validated)out.push(copy(validated));else issues.push(`${key}[${index}]: invalid record`);});
  if(new Set(out.map(x=>x.id)).size!==out.length)issues.push(`${key}: duplicate record ID`);
  return Object.freeze(out);
}
/** All-or-nothing parser. Errors intentionally do not echo untrusted values. */
export function parseInspectionSnapshot(input:unknown):InspectionParseResult{
  if(!plain(input)||Object.keys(input).some(k=>!KEYS.includes(k as typeof KEYS[number]))||KEYS.some(k=>!Array.isArray(input[k])))return reject(["Invalid inspection snapshot structure"]);
  const issues:string[]=[];
  const requirements=collection(input.requirements,"requirements",v=>fields(v,["id","code","assetId","revision","status","basisReference","scope","technique","requiredCoveragePercent","requiredEffectiveness","recurrence"],["approvedAt"])&&allText(v,["id","code","assetId","revision","basisReference","scope","technique","recurrence"])&&enumeration(v.status,REQUIREMENT_STATES)&&percent(v.requiredCoveragePercent)&&enumeration(v.requiredEffectiveness,EFFECTIVENESS)&&(!Object.hasOwn(v,"approvedAt")||iso(v.approvedAt))&&(!["APPROVED","SUPERSEDED"].includes(v.status as string)||iso(v.approvedAt))?v as InspectionRequirement:null,issues);
  const candidates=collection(input.candidates,"candidates",v=>fields(v,["id","requirementId","source","dueAt","basisReference"])&&allText(v,["id","requirementId","basisReference"])&&enumeration(v.source,DUE_SOURCES)&&iso(v.dueAt)?v as DueCandidate:null,issues);
  const dueDecisions=collection(input.dueDecisions,"dueDecisions",v=>fields(v,["id","requirementId","technicalDueAt","determinedAt","basisReference","consideredCandidateIds"])&&allText(v,["id","requirementId","basisReference"])&&iso(v.technicalDueAt)&&iso(v.determinedAt)&&ids(v.consideredCandidateIds)?v as GoverningInspectionDue:null,issues);
  const plans=collection(input.plans,"plans",v=>fields(v,["id","code","revision","status","requirementIds","plannedStart","plannedEnd","basisReference"])&&allText(v,["id","code","revision","basisReference"])&&enumeration(v.status,PLAN_STATES)&&ids(v.requirementIds)&&iso(v.plannedStart)&&iso(v.plannedEnd)&&Date.parse(v.plannedStart)<=Date.parse(v.plannedEnd)?v as InspectionPlan:null,issues);
  const workpacks=collection(input.workpacks,"workpacks",v=>fields(v,["id","planId","code","revision","status","requirementIds","assignedResource","qualificationReference","scopeReference"],["releasedAt"])&&allText(v,["id","planId","code","revision","assignedResource","qualificationReference","scopeReference"])&&enumeration(v.status,WORKPACK_STATES)&&ids(v.requirementIds)&&(!Object.hasOwn(v,"releasedAt")||iso(v.releasedAt))&&(v.status!=="RELEASED"||iso(v.releasedAt))?v as InspectionWorkpack:null,issues);
  const events=collection(input.events,"events",v=>fields(v,["id","workpackId","requirementId","eventAt","status","technique","evidenceReferences"],["achievedCoveragePercent","resultReference"])&&allText(v,["id","workpackId","requirementId","technique"])&&enumeration(v.status,EVENT_STATES)&&iso(v.eventAt)&&ids(v.evidenceReferences)&&(!Object.hasOwn(v,"achievedCoveragePercent")||percent(v.achievedCoveragePercent))&&(!Object.hasOwn(v,"resultReference")||text(v.resultReference))&&(v.status!=="FINALIZED"||text(v.resultReference))?v as InspectionEvent:null,issues);
  const reviews=collection(input.reviews,"reviews",v=>fields(v,["id","eventId","requirementId","status","achievedEffectiveness","credit","residualObligation"],["achievedCoveragePercent","basisReference","reviewedAt","creditBasisReference","creditGrantedAt"])&&allText(v,["id","eventId","requirementId","residualObligation"])&&enumeration(v.status,REVIEW_STATES)&&enumeration(v.achievedEffectiveness,EFFECTIVENESS)&&enumeration(v.credit,CREDIT_STATES)&&(!Object.hasOwn(v,"achievedCoveragePercent")||percent(v.achievedCoveragePercent))&&(!Object.hasOwn(v,"basisReference")||text(v.basisReference))&&(!Object.hasOwn(v,"reviewedAt")||iso(v.reviewedAt))&&(!Object.hasOwn(v,"creditBasisReference")||text(v.creditBasisReference))&&(!Object.hasOwn(v,"creditGrantedAt")||iso(v.creditGrantedAt))&&(v.status!=="APPROVED"||(text(v.basisReference)&&iso(v.reviewedAt)))&&(!["GRANTED","PARTIAL"].includes(v.credit as string)||(v.status==="APPROVED"&&text(v.creditBasisReference)&&iso(v.creditGrantedAt)&&percent(v.achievedCoveragePercent)))&&(["GRANTED","PARTIAL"].includes(v.credit as string)||!Object.hasOwn(v,"creditGrantedAt"))?v as InspectionTechnicalReview:null,issues);
  const requirementMap=new Map(requirements.map(x=>[x.id,x]));const candidateMap=new Map(candidates.map(x=>[x.id,x]));const planMap=new Map(plans.map(x=>[x.id,x]));const workpackMap=new Map(workpacks.map(x=>[x.id,x]));const eventMap=new Map(events.map(x=>[x.id,x]));
  const check=(ok:boolean,domain:string)=>{if(!ok)issues.push(`${domain}: inconsistent referenced objects`);};
  candidates.forEach(c=>check(requirementMap.has(c.requirementId),"candidates"));
  dueDecisions.forEach(d=>check(requirementMap.has(d.requirementId)&&d.consideredCandidateIds.every(id=>candidateMap.get(id)?.requirementId===d.requirementId),"dueDecisions"));
  if(new Set(dueDecisions.map(d=>d.requirementId)).size!==dueDecisions.length)issues.push("dueDecisions: multiple governing decisions per requirement");
  plans.forEach(p=>check(p.requirementIds.length>0&&p.requirementIds.every(id=>requirementMap.has(id)),"plans"));
  workpacks.forEach(w=>check(!!planMap.has(w.planId)&&w.requirementIds.length>0&&w.requirementIds.every(id=>planMap.get(w.planId)?.requirementIds.includes(id)),"workpacks"));
  events.forEach(e=>check(!!workpackMap.has(e.workpackId)&&workpackMap.get(e.workpackId)?.requirementIds.includes(e.requirementId)===true,"events"));
  reviews.forEach(r=>check(eventMap.get(r.eventId)?.requirementId===r.requirementId,"reviews"));
  if(new Set(reviews.map(r=>r.eventId)).size!==reviews.length)issues.push("reviews: multiple current reviews per event");
  if(issues.length)return reject(issues);
  return Object.freeze({ok:true as const,snapshot:Object.freeze({requirements,candidates,dueDecisions,plans,workpacks,events,reviews})});
}
export function filterInspectionRequirements(rows:readonly InspectionRequirement[],filters:{search:string;state:typeof REQUIREMENT_STATES[number]|"ALL"}):readonly InspectionRequirement[]{
  const terms=filters.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(r=>(filters.state==="ALL"||r.status===filters.state)&&terms.every(t=>`${r.id} ${r.code} ${r.assetId} ${r.scope} ${r.technique}`.toLocaleLowerCase().includes(t)));
}
export function inspectionDueContext(snapshot:InspectionSnapshot,requirementId:string):Readonly<{candidates:readonly DueCandidate[];governing:GoverningInspectionDue|null}>{
  return {candidates:snapshot.candidates.filter(c=>c.requirementId===requirementId),governing:snapshot.dueDecisions.find(d=>d.requirementId===requirementId)??null};
}
/** Credit is authoritative ONLY when an approved technical review explicitly grants it. */
export function grantedInspectionCredit(snapshot:InspectionSnapshot,eventId:string):InspectionTechnicalReview|null{
  const r=snapshot.reviews.find(x=>x.eventId===eventId);
  return r?.status==="APPROVED"&&(r.credit==="GRANTED"||r.credit==="PARTIAL")&&r.creditBasisReference&&r.creditGrantedAt?r:null;
}
