/** Phase 19 — independently authorized, scope-bound SHARED read model.
 * No engineering authorization, artifact download, or source-domain mutation exists here.
 */
import { DOMAINS, type DomainCode } from "../../capabilityRegistry";
import { SCREEN_BY_ID } from "../../screenRegistry";
import { type DiscoveryResult, DISCOVERY_STATES, type DiscoveryState } from "../discovery/discoveryModel";

export const EVIDENCE_KINDS = ["SOURCE","FIELD","CALCULATION","REVIEW","SUPPORTING"] as const;
export const REVIEW_STATES = ["CONFIRMED","PENDING","UNKNOWN"] as const;
export const RELATION_KINDS = ["SUPPORTS","DERIVES_FROM","RESULTS_IN","RELATED_TO","SUPERSEDES"] as const;
export type EvidenceKind = typeof EVIDENCE_KINDS[number];
export type ReviewState = typeof REVIEW_STATES[number];
export type RelationKind = typeof RELATION_KINDS[number];
export type ContextRecord = Readonly<{
  id:string;objectRef:string;domain:DomainCode;screenId:string;title:string;revision:string;state:DiscoveryState;sourceRef:string;assetId?:string;
}>;
export type EvidenceReference = Readonly<{
  id:string;recordId:string;revisionId:string;evidenceRef:string;sourceRef:string;kind:EvidenceKind;state:DiscoveryState;
  recordedAt:string;sha256?:string;
}>;
export type RevisionEntry = Readonly<{
  id:string;recordId:string;revision:string;changedAt:string;changeRef:string;sourceRef:string;
  reviewState:ReviewState;priorRevisionId?:string;reviewerRef?:string;reviewedAt?:string;
}>;
export type RelatedRecord = Readonly<{
  id:string;fromRecordId:string;toRecordId:string;kind:RelationKind;basisRef:string;recordedAt:string;
}>;
export type RecordContextSnapshot = Readonly<{
  scopeKey:string;records:readonly ContextRecord[];evidence:readonly EvidenceReference[];
  revisions:readonly RevisionEntry[];relations:readonly RelatedRecord[];
}>;
export type ContextParseResult = Readonly<{ok:true;snapshot:RecordContextSnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export type ContextMatch = Readonly<{state:"MATCHED";record:ContextRecord}>|Readonly<{state:"NOT_SUPPLIED"|"MISMATCH"}>;
const domains = new Set(DOMAINS.map(d=>d.code));
const plain = (v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const str = (v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=300&&!/[\u0000-\u001f\u007f]/.test(v);
const keys = (v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k)&&str(v[k]))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k))&&optional.every(k=>!(k in v)||str(v[k]));
const isEnum = <T extends string>(v:unknown,values:readonly T[]):v is T=>typeof v==="string"&&values.includes(v as T);
function iso(v:unknown):v is string{
  if(typeof v!=="string"||!/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v))return false;
  const yr=Number(v.slice(0,4)),mo=Number(v.slice(5,7)),dy=Number(v.slice(8,10));
  const hour=Number(v.slice(11,13)),min=Number(v.slice(14,16)),sec=Number(v.slice(17,19));
  const days=[31,(yr%4===0&&(yr%100!==0||yr%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
  const offset=/([+-])(\d\d):(\d\d)$/.exec(v);
  return yr>0&&mo>=1&&mo<=12&&dy>=1&&dy<=days[mo-1]!&&hour<24&&min<60&&sec<60&&
    (!offset||(Number(offset[2])<=14&&Number(offset[3])<60&&(Number(offset[2])!==14||Number(offset[3])===0)))&&Number.isFinite(Date.parse(v));
}
const shortIssue=(collection:string,i:number,why:string)=>`${collection}[${i}]: ${why}`;
/** Rejects the *entire* supplied collection on an inconsistent record, link, or chain. */
export function parseRecordContextSnapshot(input:unknown,expectedScopeKey:string):ContextParseResult{
  if(!str(expectedScopeKey))return {ok:false,issues:["Trusted shared-record scope missing"]};
  if(!plain(input)||Object.keys(input).some(k=>!["scopeKey","records","evidence","revisions","relations"].includes(k))||input.scopeKey!==expectedScopeKey||
    !["records","evidence","revisions","relations"].every(k=>Array.isArray(input[k])))return {ok:false,issues:["Invalid or mismatched shared-record snapshot"]};
  const caps:Readonly<Record<string,number>>={records:5000,evidence:12000,revisions:12000,relations:12000};
  for(const [k,max] of Object.entries(caps))if((input[k] as unknown[]).length>max)return {ok:false,issues:[`${k} exceeds presentation limit`]};
  const issues:string[]=[], records:ContextRecord[]=[], evidence:EvidenceReference[]=[],revisions:RevisionEntry[]=[],relations:RelatedRecord[]=[];
  const recordIds=new Set<string>(),objectKeys=new Set<string>(), evidenceIds=new Set<string>(),revisionIds=new Set<string>(),relationIds=new Set<string>();
  (input.records as unknown[]).forEach((v,i)=>{
    if(!plain(v)||!keys(v,["id","objectRef","domain","screenId","title","revision","state","sourceRef"],["assetId"])||!domains.has(v.domain as DomainCode)||
      !isEnum(v.state,DISCOVERY_STATES)||SCREEN_BY_ID.get(v.screenId as string)?.domain!==v.domain){issues.push(shortIssue("records",i,"invalid source identity"));return;}
    const identity=`${v.domain as string}\u0000${v.objectRef as string}`;
    if(recordIds.has(v.id as string)||objectKeys.has(identity)){issues.push(shortIssue("records",i,"duplicate object identity"));return;}
    recordIds.add(v.id as string);objectKeys.add(identity);
    records.push(Object.freeze({id:v.id as string,objectRef:v.objectRef as string,domain:v.domain as DomainCode,screenId:v.screenId as string,
      title:v.title as string,revision:v.revision as string,state:v.state as DiscoveryState,sourceRef:v.sourceRef as string,...("assetId" in v?{assetId:v.assetId as string}:{})}));
  });
  (input.revisions as unknown[]).forEach((v,i)=>{
    if(!plain(v)||!keys(v,["id","recordId","revision","changedAt","changeRef","sourceRef","reviewState"],["priorRevisionId","reviewerRef","reviewedAt"])||
      !isEnum(v.reviewState,REVIEW_STATES)||!iso(v.changedAt)||("reviewedAt" in v&&!iso(v.reviewedAt))||
      (v.reviewState==="CONFIRMED"?!("reviewerRef" in v&&"reviewedAt" in v):("reviewerRef" in v||"reviewedAt" in v))||
      ("reviewedAt" in v&&Date.parse(v.reviewedAt as string)<Date.parse(v.changedAt as string))||!recordIds.has(v.recordId as string)||revisionIds.has(v.id as string)){
      issues.push(shortIssue("revisions",i,"invalid review or record reference"));return;
    }
    revisionIds.add(v.id as string);
    revisions.push(Object.freeze({id:v.id as string,recordId:v.recordId as string,revision:v.revision as string,changedAt:v.changedAt as string,
      changeRef:v.changeRef as string,sourceRef:v.sourceRef as string,reviewState:v.reviewState as ReviewState,
      ...("priorRevisionId" in v?{priorRevisionId:v.priorRevisionId as string}:{}),
      ...("reviewerRef" in v?{reviewerRef:v.reviewerRef as string}:{}),
      ...("reviewedAt" in v?{reviewedAt:v.reviewedAt as string}:{})}));
  });
  const revById=new Map(revisions.map(r=>[r.id,r]));
  for(const record of records){
    const chain=revisions.filter(r=>r.recordId===record.id),revisionNames=new Set<string>();
    if(chain.filter(r=>r.revision===record.revision).length!==1)issues.push(`records: no unique current revision for ${record.id}`);
    for(const item of chain){
      if(revisionNames.has(item.revision))issues.push("revisions: duplicate revision label");
      revisionNames.add(item.revision);
      if(item.priorRevisionId){const prior=revById.get(item.priorRevisionId);
        if(!prior||prior.recordId!==record.id||Date.parse(prior.changedAt)>=Date.parse(item.changedAt))issues.push("revisions: broken predecessor chronology");
      }
    }
    const current=chain.find(r=>r.revision===record.revision);
    if(current&&chain.some(r=>Date.parse(r.changedAt)>Date.parse(current.changedAt)))issues.push("revisions: current revision is not the latest");
    if(current&&current.sourceRef!==record.sourceRef)issues.push("revisions: current source provenance mismatch");
    for(const start of chain){let n:RevisionEntry|undefined=start;const visited=new Set<string>();while(n?.priorRevisionId){if(visited.has(n.id)){issues.push("revisions: cyclic chain");break;}visited.add(n.id);n=revById.get(n.priorRevisionId);}}
  }
  (input.evidence as unknown[]).forEach((v,i)=>{
    if(!plain(v)||!keys(v,["id","recordId","revisionId","evidenceRef","sourceRef","kind","state","recordedAt"],["sha256"])||
      !isEnum(v.kind,EVIDENCE_KINDS)||!isEnum(v.state,DISCOVERY_STATES)||!iso(v.recordedAt)||
      ("sha256" in v&&!/^[0-9a-f]{64}$/.test(v.sha256 as string))||!recordIds.has(v.recordId as string)||
      revById.get(v.revisionId as string)?.recordId!==v.recordId||evidenceIds.has(v.id as string)){
      issues.push(shortIssue("evidence",i,"invalid evidence or revision reference"));return;
    }
    evidenceIds.add(v.id as string);
    evidence.push(Object.freeze({id:v.id as string,recordId:v.recordId as string,revisionId:v.revisionId as string,evidenceRef:v.evidenceRef as string,
      sourceRef:v.sourceRef as string,kind:v.kind as EvidenceKind,state:v.state as DiscoveryState,recordedAt:v.recordedAt as string,
      ...("sha256" in v?{sha256:v.sha256 as string}:{})}));
  });
  (input.relations as unknown[]).forEach((v,i)=>{
    if(!plain(v)||!keys(v,["id","fromRecordId","toRecordId","kind","basisRef","recordedAt"])||!isEnum(v.kind,RELATION_KINDS)||!iso(v.recordedAt)||
      !recordIds.has(v.fromRecordId as string)||!recordIds.has(v.toRecordId as string)||v.fromRecordId===v.toRecordId||relationIds.has(v.id as string)){
      issues.push(shortIssue("relations",i,"invalid linked source record"));return;
    }
    relationIds.add(v.id as string);
    relations.push(Object.freeze({id:v.id as string,fromRecordId:v.fromRecordId as string,toRecordId:v.toRecordId as string,kind:v.kind as RelationKind,
      basisRef:v.basisRef as string,recordedAt:v.recordedAt as string}));
  });
  // No cyclic supersession chains or contradictory two-way authority lineage.
  const successors=new Map<string,string[]>();
  for(const r of relations.filter(x=>x.kind==="SUPERSEDES"))successors.set(r.fromRecordId,[...(successors.get(r.fromRecordId)??[]),r.toRecordId]);
  for(const id of recordIds){const seen=new Set<string>();const walk=(current:string):boolean=>{
    if(current===id&&seen.size>0)return true;
    if(seen.has(current))return false;seen.add(current);return (successors.get(current)??[]).some(walk);
  };if((successors.get(id)??[]).some(walk)){issues.push("relations: cyclic supersession");break;}}
  if(issues.length)return Object.freeze({ok:false as const,issues:Object.freeze(issues)});
  return Object.freeze({ok:true as const,snapshot:Object.freeze({scopeKey:expectedScopeKey,records:Object.freeze(records),revisions:Object.freeze(revisions),
    evidence:Object.freeze(evidence),relations:Object.freeze(relations)})});
}
/** Exact identity + displayed revision match. A cross-source mismatch is not an empty evidence collection. */
export function matchDiscoveryContext(result:DiscoveryResult,snapshot:RecordContextSnapshot):ContextMatch{
  const record=snapshot.records.find(r=>r.id===result.id);
  if(!record)return {state:"NOT_SUPPLIED"};
  if(record.objectRef!==result.objectRef||record.domain!==result.domain||record.screenId!==result.screenId||record.title!==result.title||
    record.revision!==result.revision||record.sourceRef!==result.sourceRef||record.state!==result.state||record.assetId!==result.assetId)return {state:"MISMATCH"};
  return {state:"MATCHED",record};
}
/** Context records may be navigated only when independently present in the authorized search projection. */
export function relatedAuthorizedResults(recordId:string,snapshot:RecordContextSnapshot,searchResults:readonly DiscoveryResult[]):readonly Readonly<{relation:RelatedRecord;target:DiscoveryResult}>[]{
  const refs:Readonly<{relation:RelatedRecord;target:DiscoveryResult}>[]=[];
  for(const relation of snapshot.relations){
    const peer=relation.fromRecordId===recordId?relation.toRecordId:relation.toRecordId===recordId?relation.fromRecordId:null;
    if(!peer)continue;
    const targetRecord=snapshot.records.find(r=>r.id===peer);
    const result=searchResults.find(r=>r.id===peer);
    if(targetRecord&&result&&matchDiscoveryContext(result,snapshot).state==="MATCHED")refs.push(Object.freeze({relation,target:result}));
  }
  return Object.freeze(refs);
}
