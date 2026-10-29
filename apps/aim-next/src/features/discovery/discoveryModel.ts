/**
 * GOV-012 Universal Search presentation contract.
 * Results MUST already be scope-authorized upstream; this module neither authenticates
 * users nor fetches, authorizes, or aggregates data from other domain snapshots.
 */
import { DOMAINS, type DomainCode } from "../../capabilityRegistry";
import { SCREEN_BY_ID } from "../../screenRegistry";

export const DISCOVERY_STATES = ["APPROVED", "PROJECTED", "SCENARIO", "UNKNOWN", "STALE", "DRAFT", "REJECTED"] as const;
export type DiscoveryState = typeof DISCOVERY_STATES[number];
export type DiscoveryResult = Readonly<{
  id:string;
  objectRef:string;
  objectType:string;
  title:string;
  domain:DomainCode;
  screenId:string;
  state:DiscoveryState;
  sourceRef:string;
  revision:string;
  assetId?:string;
  occurredAt?:string;
}>;
export type DiscoverySnapshot = Readonly<{scopeKey:string;records:readonly DiscoveryResult[]}>;
export type DiscoveryParseResult = Readonly<{ok:true;snapshot:DiscoverySnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export type DiscoveryFilter = Readonly<{query:string;domain:DomainCode|"ALL";state:DiscoveryState|"ALL";assetId?:string|undefined}>;
const codes = new Set<string>(DOMAINS.map(d=>d.code));
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const safe=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=300&&!/[\u0000-\u001f\u007f]/.test(v);
function validDateTime(v:unknown):v is string{
  if(typeof v!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v))return false;
  const normalized = new Date(v);
  if(!Number.isFinite(normalized.getTime()))return false;
  const year=Number(v.slice(0,4)),month=Number(v.slice(5,7)),day=Number(v.slice(8,10));
  const days=[31,(year%4===0&&(year%100!==0||year%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
  const hour=Number(v.slice(11,13)),minute=Number(v.slice(14,16)),second=Number(v.slice(17,19));
  const zone=/([+-])(\d\d):(\d\d)$/.exec(v);
  return month>=1&&month<=12&&day>=1&&day<=days[month-1]!&&hour<24&&minute<60&&second<60&&(!zone||(Number(zone[2])<=14&&Number(zone[3])<60&&(Number(zone[2])!==14||Number(zone[3])===0)));
}
/** No partial search results on malformed input. Deep-clones and freezes result records. */
export function parseDiscoverySnapshot(input:unknown, expectedScopeKey:string):DiscoveryParseResult{
  if(!safe(expectedScopeKey))return {ok:false,issues:["Missing trusted search scope"]};
  if(!plain(input)||Object.keys(input).some(k=>!["scopeKey","records"].includes(k))||!safe(input.scopeKey)||!Array.isArray(input.records))return {ok:false,issues:["Invalid search snapshot structure"]};
  if(input.scopeKey!==expectedScopeKey)return {ok:false,issues:["Search snapshot scope mismatch"]};
  if(input.records.length>10000)return {ok:false,issues:["Search results exceed presentation limits"]};
  const records:DiscoveryResult[]=[],issues:string[]=[],ids=new Set<string>();
  input.records.forEach((value:unknown,index:number)=>{
    if(!plain(value)||Object.keys(value).some(k=>!["id","objectRef","objectType","title","domain","screenId","state","sourceRef","revision","assetId","occurredAt"].includes(k)) ||
      !["id","objectRef","objectType","title","domain","screenId","state","sourceRef","revision"].every(k=>safe(value[k])) ||
      ("assetId" in value&&!safe(value.assetId))||("occurredAt" in value&&!validDateTime(value.occurredAt))){issues.push(`records[${index}]: invalid fields`);return;}
    if(!codes.has(value.domain as string)||!DISCOVERY_STATES.includes(value.state as DiscoveryState)) {issues.push(`records[${index}]: invalid domain or state`);return;}
    const screen=SCREEN_BY_ID.get(value.screenId as string);
    if(!screen||screen.domain!==value.domain||!["AIR","DGM","COR","INS","RBI","FND","REC","ACT","IOW","FFS","GOV","INT","ANA","FLD","VIS"].includes(screen.domain)){
      issues.push(`records[${index}]: missing or cross-domain screen`);return;
    }
    if(ids.has(value.id as string)){issues.push(`records[${index}]: duplicate identity`);return;}
    ids.add(value.id as string);
    const record:DiscoveryResult={id:value.id as string,objectRef:value.objectRef as string,objectType:value.objectType as string,title:value.title as string,
      domain:value.domain as DomainCode,screenId:value.screenId as string,state:value.state as DiscoveryState,sourceRef:value.sourceRef as string,revision:value.revision as string,
      ...("assetId" in value?{assetId:value.assetId as string}:{}),...("occurredAt" in value?{occurredAt:value.occurredAt as string}:{})};
    records.push(Object.freeze(record));
  });
  if(issues.length)return Object.freeze({ok:false as const,issues:Object.freeze(issues)});
  return Object.freeze({ok:true as const,snapshot:Object.freeze({scopeKey:expectedScopeKey,records:Object.freeze(records)})});
}
/** Search only the already-authorized supplied rows. Never infer result state or source. */
export function filterDiscoveryResults(records:readonly DiscoveryResult[],filter:DiscoveryFilter):readonly DiscoveryResult[]{
  const terms=filter.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(r=>(filter.domain==="ALL"||r.domain===filter.domain)&&(filter.state==="ALL"||r.state===filter.state)&&
    (!filter.assetId||r.assetId===filter.assetId)&&terms.every(t=>`${r.id} ${r.objectRef} ${r.objectType} ${r.title} ${r.domain} ${r.sourceRef}`.toLocaleLowerCase().includes(t)))
    .sort((a,b)=>a.domain.localeCompare(b.domain)||a.objectRef.localeCompare(b.objectRef)||a.id.localeCompare(b.id));
}
