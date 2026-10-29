/**
 * AAS–AIM REC-001–010 — read-only projection of owning-domain recommendation records.
 * Never infer approved engineering basis, technical fulfillment or closeout from CMMS/action status.
 * This validator checks consistency of the supplied projection, NOT authentication or authority.
 */
export const RECOMMENDATION_STATES = ["DRAFT","IN_REVIEW","APPROVED","SUPERSEDED","WITHDRAWN","CLOSED","REOPENED"] as const;
export const RECOMMENDATION_PRIORITIES = ["LOW","MODERATE","HIGH","CRITICAL","UNKNOWN"] as const;
export const RECOMMENDATION_BASIS = ["FND","RBI","FFS","COR","INS","DGM","OTHER"] as const;
export const EXECUTION_KINDS = ["INTEGRITY_ACTION","CMMS_WORK","INSPECTION","ASSESSMENT","OTHER"] as const;
export const EXECUTION_STATES = ["PLANNED","IN_PROGRESS","COMPLETED","UNKNOWN"] as const;
export const VERIFICATION_STATES = ["PENDING","REJECTED","VERIFIED"] as const;
export type RecommendationState=typeof RECOMMENDATION_STATES[number];
export type Priority=typeof RECOMMENDATION_PRIORITIES[number];
export type Recommendation=Readonly<{
 id:string;code:string;assetId:string;revision:string;status:RecommendationState;
 title:string;technicalBasisRef:string;technicalBasisDomain:typeof RECOMMENDATION_BASIS[number];
 createdAt:string;priority:Priority;technicalDueAt?:string;
 approvedAt?:string;approvalBasisRef?:string;approvedRevision?:string;
 lifecycleDecision?:Readonly<{kind:"SUPERSEDE"|"WITHDRAW";decisionAt:string;basisRef:string;authorityRef:string}>;
}>;
export type RecommendationRequirement=Readonly<{
 id:string;recommendationId:string;description:string;acceptanceCriterion:string;sourceBasisRef:string;
}>;
export type RecommendationAccountability=Readonly<{
 id:string;recommendationId:string;ownerRef:string;accountableRef:string;assignedAt:string;
}>;
export type RecommendationExecution=Readonly<{
 id:string;recommendationId:string;kind:typeof EXECUTION_KINDS[number];externalRecordRef:string;
 state:typeof EXECUTION_STATES[number];updatedAt:string;
}>;
export type RecommendationFulfillment=Readonly<{
 id:string;recommendationId:string;requirementId:string;state:typeof VERIFICATION_STATES[number];
 assessmentBasisRef:string;assessedAt:string;verificationEvidenceRefs:readonly string[];
 verifiedAt?:string;reviewerRef?:string;
}>;
export type RecommendationCloseout=Readonly<{
 id:string;recommendationId:string;recommendationRevision:string;kind:"CLOSE"|"REOPEN";
 decidedAt:string;decisionBasisRef:string;authorityRef:string;verificationEvidenceRefs:readonly string[];
}>;
export type RecommendationsSnapshot=Readonly<{
 recommendations:readonly Recommendation[];
 requirements:readonly RecommendationRequirement[];
 accountability:readonly RecommendationAccountability[];
 execution:readonly RecommendationExecution[];
 fulfillment:readonly RecommendationFulfillment[];
 closeout:readonly RecommendationCloseout[];
}>;
export type RecommendationsParseResult=Readonly<{ok:true;snapshot:RecommendationsSnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_RECOMMENDATIONS:RecommendationsSnapshot=Object.freeze({
 recommendations:Object.freeze([]),requirements:Object.freeze([]),accountability:Object.freeze([]),
 execution:Object.freeze([]),fulfillment:Object.freeze([]),closeout:Object.freeze([])
});
const KEYS=["recommendations","requirements","accountability","execution","fulfillment","closeout"] as const;
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const txt=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=2500&&!/[\u0000-\u001f\u007f]/.test(v);
const member=<T extends string>(v:unknown,values:readonly T[]):v is T=>typeof v==="string"&&values.includes(v as T);
const shape=(v:unknown,req:readonly string[],opt:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&req.every(k=>own(v,k))&&Object.keys(v).every(k=>req.includes(k)||opt.includes(k));
const fields=(v:Record<string,unknown>,keys:readonly string[])=>keys.every(k=>txt(v[k]));
const optText=(v:Record<string,unknown>,k:string)=>!own(v,k)||txt(v[k]);
const iso=(v:unknown):v is string=>{
 if(typeof v!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
 if(!m)return false;
 const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),h=Number(m[4]),min=Number(m[5]),sec=Number(m[6]),tz=m[7]!;
 const leap=y%4===0&&(y%100!==0||y%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 return y>0&&mo>=1&&mo<=12&&d>=1&&d<=days[mo-1]!&&h<24&&min<60&&sec<60&&
 (tz==="Z"||(Number(tz.slice(1,3))<=14&&Number(tz.slice(4,6))<60&&(Number(tz.slice(1,3))!==14||Number(tz.slice(4,6))===0)))&&Number.isFinite(Date.parse(v));
};
const optDate=(v:Record<string,unknown>,key:string)=>!own(v,key)||iso(v[key]);
const refList=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=2000&&v.every(txt)&&new Set(v).size===v.length;
const lifecycle=(v:unknown):boolean=>shape(v,["kind","decisionAt","basisRef","authorityRef"])&&member(v.kind,["SUPERSEDE","WITHDRAW"])&&iso(v.decisionAt)&&fields(v,["basisRef","authorityRef"]);
const recommendationValid=(v:unknown):v is Recommendation=>shape(v,["id","code","assetId","revision","status","title","technicalBasisRef","technicalBasisDomain","createdAt","priority"],["technicalDueAt","approvedAt","approvalBasisRef","approvedRevision","lifecycleDecision"])
 &&fields(v,["id","code","assetId","revision","title","technicalBasisRef"])&&member(v.status,RECOMMENDATION_STATES)&&member(v.technicalBasisDomain,RECOMMENDATION_BASIS)&&member(v.priority,RECOMMENDATION_PRIORITIES)
 &&iso(v.createdAt)&&optDate(v,"technicalDueAt")&&optDate(v,"approvedAt")&&optText(v,"approvalBasisRef")&&optText(v,"approvedRevision")&&(!own(v,"lifecycleDecision")||lifecycle(v.lifecycleDecision))
 &&(!["APPROVED","SUPERSEDED","WITHDRAWN","CLOSED","REOPENED"].includes(v.status as string)||(iso(v.approvedAt)&&txt(v.approvalBasisRef)&&txt(v.approvedRevision)))
 &&(!["SUPERSEDED","WITHDRAWN"].includes(v.status as string)|| (plain(v.lifecycleDecision)&&v.lifecycleDecision.kind===(v.status==="SUPERSEDED"?"SUPERSEDE":"WITHDRAW")))
 &&(!own(v,"lifecycleDecision")||["SUPERSEDED","WITHDRAWN"].includes(v.status as string))
 &&(!["DRAFT","IN_REVIEW"].includes(v.status as string)||(!own(v,"approvedAt")&&!own(v,"approvalBasisRef")&&!own(v,"approvedRevision")));
const requirementValid=(v:unknown):v is RecommendationRequirement=>shape(v,["id","recommendationId","description","acceptanceCriterion","sourceBasisRef"])&&fields(v,["id","recommendationId","description","acceptanceCriterion","sourceBasisRef"]);
const accountabilityValid=(v:unknown):v is RecommendationAccountability=>shape(v,["id","recommendationId","ownerRef","accountableRef","assignedAt"])&&fields(v,["id","recommendationId","ownerRef","accountableRef"])&&iso(v.assignedAt);
const executionValid=(v:unknown):v is RecommendationExecution=>shape(v,["id","recommendationId","kind","externalRecordRef","state","updatedAt"])&&fields(v,["id","recommendationId","externalRecordRef"])&&member(v.kind,EXECUTION_KINDS)&&member(v.state,EXECUTION_STATES)&&iso(v.updatedAt);
const fulfillmentValid=(v:unknown):v is RecommendationFulfillment=>shape(v,["id","recommendationId","requirementId","state","assessmentBasisRef","assessedAt","verificationEvidenceRefs"],["verifiedAt","reviewerRef"])
 &&fields(v,["id","recommendationId","requirementId","assessmentBasisRef"])&&member(v.state,VERIFICATION_STATES)&&iso(v.assessedAt)&&refList(v.verificationEvidenceRefs)&&optDate(v,"verifiedAt")&&optText(v,"reviewerRef")
 &&(v.state!=="VERIFIED"||(iso(v.verifiedAt)&&txt(v.reviewerRef)&&(v.verificationEvidenceRefs as string[]).length>0&&Date.parse(v.verifiedAt as string)>=Date.parse(v.assessedAt as string)))
 &&(v.state==="VERIFIED"||(!own(v,"verifiedAt")&&!own(v,"reviewerRef")));
const closeoutValid=(v:unknown):v is RecommendationCloseout=>shape(v,["id","recommendationId","recommendationRevision","kind","decidedAt","decisionBasisRef","authorityRef","verificationEvidenceRefs"])
 &&fields(v,["id","recommendationId","recommendationRevision","decisionBasisRef","authorityRef"])&&member(v.kind,["CLOSE","REOPEN"])&&iso(v.decidedAt)&&refList(v.verificationEvidenceRefs)&&(v.verificationEvidenceRefs as string[]).length>0;
const fail=(issues:string[]):RecommendationsParseResult=>Object.freeze({ok:false as const,issues:Object.freeze(issues)});
function collect<T extends {id:string}>(v:unknown,key:string,validate:(x:unknown)=>x is T,clone:(x:T)=>T,issues:string[]):readonly T[]{
 if(!Array.isArray(v)||v.length>20000){issues.push(`${key}: invalid collection`);return Object.freeze([]);}
 const result:T[]=[];v.forEach((x:unknown,index:number)=>{if(validate(x))result.push(clone(x));else issues.push(`${key}[${index}]: invalid record`);});
 if(new Set(result.map(x=>x.id)).size!==result.length)issues.push(`${key}: duplicated record identity`);
 return Object.freeze(result);
}
/** Entire batch is rejected for malformed, orphaned, or conflicting source records. */
export function parseRecommendationsSnapshot(input:unknown):RecommendationsParseResult{
 if(!plain(input)||Object.keys(input).some(k=>!KEYS.includes(k as typeof KEYS[number]))||KEYS.some(k=>!Array.isArray(input[k])))return fail(["Invalid recommendations snapshot structure"]);
 const issues:string[]=[];
 const recommendations=collect(input.recommendations,"recommendations",recommendationValid,x=>Object.freeze({...x,...(x.lifecycleDecision?{lifecycleDecision:Object.freeze({...x.lifecycleDecision})}:{})}),issues);
 const requirements=collect(input.requirements,"requirements",requirementValid,x=>Object.freeze({...x}),issues);
 const accountability=collect(input.accountability,"accountability",accountabilityValid,x=>Object.freeze({...x}),issues);
 const execution=collect(input.execution,"execution",executionValid,x=>Object.freeze({...x}),issues);
 const fulfillment=collect(input.fulfillment,"fulfillment",fulfillmentValid,x=>Object.freeze({...x,verificationEvidenceRefs:Object.freeze([...x.verificationEvidenceRefs])}),issues);
 const closeout=collect(input.closeout,"closeout",closeoutValid,x=>Object.freeze({...x,verificationEvidenceRefs:Object.freeze([...x.verificationEvidenceRefs])}),issues);
 const all=[...recommendations,...requirements,...accountability,...execution,...fulfillment,...closeout].map(x=>x.id);
 if(new Set(all).size!==all.length)issues.push("Duplicated IDs across recommendation object families");
 if(new Set(recommendations.map(x=>x.code)).size!==recommendations.length)issues.push("Duplicated recommendation code");
 const recs=new Map(recommendations.map(x=>[x.id,x]));const reqs=new Map(requirements.map(x=>[x.id,x]));
 for(const x of [...requirements,...accountability,...execution,...fulfillment,...closeout])if(!recs.has(x.recommendationId))issues.push("Orphan record references an absent recommendation");
 const accountable=new Set<string>();for(const a of accountability){if(accountable.has(a.recommendationId))issues.push("Duplicate accountability records for one recommendation");accountable.add(a.recommendationId);}
 const byReq=new Set<string>();for(const f of fulfillment){
  const r=reqs.get(f.requirementId);if(!r||r.recommendationId!==f.recommendationId)issues.push("Fulfillment references an unrelated requirement");
  if(byReq.has(f.requirementId))issues.push("Multiple conflicting fulfillment decisions for one requirement");byReq.add(f.requirementId);
 }
 for(const rec of recommendations){
  const rReqs=requirements.filter(x=>x.recommendationId===rec.id);
  const rFulfill=fulfillment.filter(x=>x.recommendationId===rec.id);
  const rClose=closeout.filter(x=>x.recommendationId===rec.id).sort((a,b)=>Date.parse(a.decidedAt)-Date.parse(b.decidedAt));
  if(["APPROVED","SUPERSEDED","WITHDRAWN","CLOSED","REOPENED"].includes(rec.status)){
   if(rReqs.length===0)issues.push("Approved recommendation has no acceptance requirements");
   if(!accountable.has(rec.id))issues.push("Approved recommendation has no accountable owner");
  }
  if(rec.approvedAt&&Date.parse(rec.approvedAt)<Date.parse(rec.createdAt))issues.push("Approval predates recommendation creation");
  if(rec.lifecycleDecision&&rec.approvedAt&&Date.parse(rec.lifecycleDecision.decisionAt)<=Date.parse(rec.approvedAt))issues.push("Lifecycle decision does not follow approval");

  if(rClose.length){
   if(!["CLOSED","REOPENED"].includes(rec.status))issues.push("Closeout records conflict with recommendation state");
   if(rClose[0]?.kind!=="CLOSE")issues.push("Closeout history must begin with an independent CLOSE");
   for(let i=1;i<rClose.length;i++){if(rClose[i]!.kind===rClose[i-1]!.kind||Date.parse(rClose[i]!.decidedAt)<=Date.parse(rClose[i-1]!.decidedAt))issues.push("Close/reopen events must alternate in strictly increasing order");}
   if(rClose.some(x=>x.recommendationRevision!==rec.approvedRevision))issues.push("Closeout revision does not match approved recommendation revision");
   if(rec.status==="CLOSED"&&rClose.at(-1)?.kind!=="CLOSE")issues.push("CLOSED state requires an independent current CLOSE decision");
   if(rec.status==="REOPENED"&&rClose.at(-1)?.kind!=="REOPEN")issues.push("REOPENED state requires preserved close and subsequent reopen decisions");
   for(const decision of rClose.filter(x=>x.kind==="CLOSE")){
    if(rec.approvedAt&&Date.parse(decision.decidedAt)<=Date.parse(rec.approvedAt))issues.push("Closure predates technical approval");
    if(rReqs.some(req=>!rFulfill.some(f=>f.requirementId===req.id&&f.state==="VERIFIED"&&f.verifiedAt&&Date.parse(f.verifiedAt)<=Date.parse(decision.decidedAt))))issues.push("Closure without independently verified fulfillment for every acceptance requirement");
   }
  }else if(["CLOSED","REOPENED"].includes(rec.status))issues.push("Recommendation state lacks independent closeout history");
 }
 if(issues.length)return fail(issues);
 return Object.freeze({ok:true as const,snapshot:Object.freeze({recommendations,requirements,accountability,execution,fulfillment,closeout})});
}
export function filterRecommendations(items:readonly Recommendation[],query:string,status:"ALL"|RecommendationState="ALL",priority:"ALL"|Priority="ALL"):readonly Recommendation[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return items.filter(r=>(status==="ALL"||r.status===status)&&(priority==="ALL"||r.priority===priority)&&terms.every(t=>`${r.id} ${r.code} ${r.assetId} ${r.title} ${r.revision} ${r.technicalBasisRef}`.toLocaleLowerCase().includes(t)));
}
export function recommendationContext(data:RecommendationsSnapshot,id:string){
 const recommendation=data.recommendations.find(x=>x.id===id);
 return {
  recommendation,
  requirements:data.requirements.filter(x=>x.recommendationId===id),
  accountability:data.accountability.find(x=>x.recommendationId===id),
  execution:data.execution.filter(x=>x.recommendationId===id),
  fulfillment:data.fulfillment.filter(x=>x.recommendationId===id),
  closeout:data.closeout.filter(x=>x.recommendationId===id).sort((a,b)=>Date.parse(a.decidedAt)-Date.parse(b.decidedAt)),
 };
}
