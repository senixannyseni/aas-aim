/**
 * ACT-001–013: read-only view of backend-owned Integrity Actions, Repairs and Deferrals.
 * No local status transitions, authority inference, CMMS-based closure or date recalculation.
 * Validation checks projection coherence; it does not authenticate the source.
 */
export const ACTION_STATES = ["DRAFT","PLANNED","RELEASED","IN_PROGRESS","WORK_COMPLETE","VERIFIED","CLOSED","CANCELLED","UNKNOWN"] as const;
export const ACTION_KINDS = ["INSPECTION","TEMPORARY_REPAIR","PERMANENT_REPAIR","TEMPORARY_CONTROL","MONITORING","OTHER"] as const;
export const REPAIR_KINDS = ["TEMPORARY","PERMANENT"] as const;
export const REPAIR_STATES = ["PROPOSED","INSTALLED","REMOVED","REPLACED","UNKNOWN"] as const;
export const CONTROL_STATES = ["PROPOSED","ACTIVE","EXPIRED","RETIRED","UNKNOWN"] as const;
export const PLAN_STATES = ["DRAFT","IN_REVIEW","RELEASED","WITHDRAWN"] as const;
export const VERIFICATION_STATES = ["PENDING","ACCEPTED","REJECTED"] as const;
export const DEFERRAL_STATES = ["REQUESTED","UNDER_REVIEW","AUTHORIZED","REJECTED","EXPIRED","WITHDRAWN"] as const;
export const ASSESSMENT_STATES = ["PENDING","ASSESSED"] as const;
export const DEFERRAL_DECISIONS = ["AUTHORIZE","REJECT"] as const;
export type ActionState = typeof ACTION_STATES[number];
export type ActionKind = typeof ACTION_KINDS[number];
export type DeferralState = typeof DEFERRAL_STATES[number];
export type IntegrityAction = Readonly<{
 id:string;code:string;assetId:string;revision:string;kind:ActionKind;state:ActionState;
 title:string;technicalBasisRef:string;createdAt:string;ownerRef:string;technicalDueAt?:string;
 approvedPlanRef?:string;verifiedAt?:string;verificationRef?:string;mocRef?:string;
}>;
export type IntegrityRepair = Readonly<{
 id:string;actionId:string;kind:typeof REPAIR_KINDS[number];state:typeof REPAIR_STATES[number];
 specificationRef:string;sourceEvidenceRefs:readonly string[];installedAt?:string;expiresAt?:string;
 limitationsRef?:string;removedAt?:string;
}>;
export type TemporaryControl = Readonly<{
 id:string;actionId:string;description:string;state:typeof CONTROL_STATES[number];
 basisRef:string;monitoringRef:string;effectiveness:"EFFECTIVE"|"INEFFECTIVE"|"UNKNOWN";
 expiresAt:string;activatedAt?:string;
}>;
export type ExecutionPlan = Readonly<{
 id:string;actionId:string;revision:string;state:typeof PLAN_STATES[number];
 scopeRef:string;createdAt:string;releasedAt?:string;releaseAuthorityRef?:string;releaseBasisRef?:string;
}>;
export type ExecutionEvidence = Readonly<{
 id:string;actionId:string;planId:string;recordedAt:string;sourceRef:string;
 evidenceRefs:readonly string[];workCompletedAt?:string;
}>;
export type ActionVerification = Readonly<{
 id:string;actionId:string;planId:string;state:typeof VERIFICATION_STATES[number];
 reviewedAt:string;reviewerRef:string;technicalBasisRef:string;evidenceRefs:readonly string[];
}>;
export type ExternalWorkReference = Readonly<{
 id:string;actionId:string;systemRef:string;externalWorkId:string;
 state:"OPEN"|"IN_PROGRESS"|"COMPLETED"|"UNKNOWN";updatedAt:string;
}>;
export type DeferralRequest = Readonly<{
 id:string;code:string;assetId:string;actionId:string;revision:string;state:DeferralState;
 technicalDueAt:string;requestedUntil:string;requestBasisRef:string;requestedAt:string;
 authorizedUntil?:string;authorizationRef?:string;
}>;
export type DeferralAssessment = Readonly<{
 id:string;deferralId:string;state:typeof ASSESSMENT_STATES[number];riskBasisRef:string;
 compensatingMeasureRefs:readonly string[];assessedAt?:string;assessorRef?:string;
}>;
export type DeferralDecision = Readonly<{
 id:string;deferralId:string;revision:string;kind:typeof DEFERRAL_DECISIONS[number];
 decidedAt:string;authorityRef:string;decisionBasisRef:string;assessmentId:string;
 authorizedUntil?:string;
}>;
export type ActionsSnapshot = Readonly<{
 actions:readonly IntegrityAction[];repairs:readonly IntegrityRepair[];controls:readonly TemporaryControl[];
 plans:readonly ExecutionPlan[];evidence:readonly ExecutionEvidence[];verifications:readonly ActionVerification[];
 externalWork:readonly ExternalWorkReference[];deferrals:readonly DeferralRequest[];
 assessments:readonly DeferralAssessment[];decisions:readonly DeferralDecision[];
}>;
export type ActionsParseResult=Readonly<{ok:true;snapshot:ActionsSnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_ACTIONS:ActionsSnapshot=Object.freeze({
 actions:Object.freeze([]),repairs:Object.freeze([]),controls:Object.freeze([]),plans:Object.freeze([]),
 evidence:Object.freeze([]),verifications:Object.freeze([]),externalWork:Object.freeze([]),
 deferrals:Object.freeze([]),assessments:Object.freeze([]),decisions:Object.freeze([])
});
const KEYS=["actions","repairs","controls","plans","evidence","verifications","externalWork","deferrals","assessments","decisions"] as const;
const own=(v:object,k:string):boolean=>Object.prototype.hasOwnProperty.call(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const text=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.trim()===v&&v.length<=2500&&!/[\u0000-\u001f\u007f]/.test(v);
const member=<T extends string>(v:unknown,values:readonly T[]):v is T=>typeof v==="string"&&values.includes(v as T);
const shape=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>own(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const fields=(v:Record<string,unknown>,keys:readonly string[])=>keys.every(k=>text(v[k]));
const optionalText=(v:Record<string,unknown>,k:string)=>!own(v,k)||text(v[k]);
const date=(v:unknown):v is string=>{
 if(typeof v!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
 if(!m)return false;
 const y=Number(m[1]),mo=Number(m[2]),day=Number(m[3]),h=Number(m[4]),min=Number(m[5]),sec=Number(m[6]),tz=m[7]!;
 const leap=y%4===0&&(y%100!==0||y%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 return y>0&&mo>=1&&mo<=12&&day>=1&&day<=days[mo-1]!&&h<24&&min<60&&sec<60&&
 (tz==="Z"||(Number(tz.slice(1,3))<=14&&Number(tz.slice(4,6))<60&&(Number(tz.slice(1,3))!==14||Number(tz.slice(4,6))===0)))&&Number.isFinite(Date.parse(v));
};
const optionalDate=(v:Record<string,unknown>,k:string)=>!own(v,k)||date(v[k]);
const references=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=2000&&v.every(text)&&new Set(v).size===v.length;
const actionValid=(v:unknown):v is IntegrityAction=>shape(v,["id","code","assetId","revision","kind","state","title","technicalBasisRef","createdAt","ownerRef"],["technicalDueAt","approvedPlanRef","verifiedAt","verificationRef","mocRef"])
 &&fields(v,["id","code","assetId","revision","title","technicalBasisRef","ownerRef"])&&member(v.kind,ACTION_KINDS)&&member(v.state,ACTION_STATES)&&date(v.createdAt)&&optionalDate(v,"technicalDueAt")&&optionalDate(v,"verifiedAt")&&optionalText(v,"approvedPlanRef")&&optionalText(v,"verificationRef")&&optionalText(v,"mocRef")
 &&(!["VERIFIED","CLOSED"].includes(v.state as string)||(date(v.verifiedAt)&&text(v.verificationRef)))
 &&(!own(v,"verifiedAt")||["VERIFIED","CLOSED"].includes(v.state as string));
const repairValid=(v:unknown):v is IntegrityRepair=>shape(v,["id","actionId","kind","state","specificationRef","sourceEvidenceRefs"],["installedAt","expiresAt","limitationsRef","removedAt"])
 &&fields(v,["id","actionId","specificationRef"])&&member(v.kind,REPAIR_KINDS)&&member(v.state,REPAIR_STATES)&&references(v.sourceEvidenceRefs)&&optionalDate(v,"installedAt")&&optionalDate(v,"expiresAt")&&optionalDate(v,"removedAt")&&optionalText(v,"limitationsRef")
 &&(v.kind!=="TEMPORARY"||(date(v.expiresAt)&&text(v.limitationsRef)))
 &&(!["INSTALLED","REMOVED","REPLACED"].includes(v.state as string)||date(v.installedAt))
 &&(!own(v,"removedAt")||["REMOVED","REPLACED"].includes(v.state as string));
const controlValid=(v:unknown):v is TemporaryControl=>shape(v,["id","actionId","description","state","basisRef","monitoringRef","effectiveness","expiresAt"],["activatedAt"])
 &&fields(v,["id","actionId","description","basisRef","monitoringRef"])&&member(v.state,CONTROL_STATES)&&member(v.effectiveness,["EFFECTIVE","INEFFECTIVE","UNKNOWN"])&&date(v.expiresAt)&&optionalDate(v,"activatedAt")&&(!["ACTIVE","EXPIRED","RETIRED"].includes(v.state as string)||date(v.activatedAt));
const planValid=(v:unknown):v is ExecutionPlan=>shape(v,["id","actionId","revision","state","scopeRef","createdAt"],["releasedAt","releaseAuthorityRef","releaseBasisRef"])
 &&fields(v,["id","actionId","revision","scopeRef"])&&member(v.state,PLAN_STATES)&&date(v.createdAt)&&optionalDate(v,"releasedAt")&&optionalText(v,"releaseAuthorityRef")&&optionalText(v,"releaseBasisRef")
 &&(v.state!=="RELEASED"||(date(v.releasedAt)&&text(v.releaseAuthorityRef)&&text(v.releaseBasisRef)))
 &&(!["DRAFT","IN_REVIEW"].includes(v.state as string)||(!own(v,"releasedAt")&&!own(v,"releaseAuthorityRef")&&!own(v,"releaseBasisRef")));
const evidenceValid=(v:unknown):v is ExecutionEvidence=>shape(v,["id","actionId","planId","recordedAt","sourceRef","evidenceRefs"],["workCompletedAt"])
 &&fields(v,["id","actionId","planId","sourceRef"])&&date(v.recordedAt)&&references(v.evidenceRefs)&&optionalDate(v,"workCompletedAt")
 &&(v.evidenceRefs as string[]).length>0&&(!own(v,"workCompletedAt")||Date.parse(v.workCompletedAt as string)<=Date.parse(v.recordedAt as string));
const verificationValid=(v:unknown):v is ActionVerification=>shape(v,["id","actionId","planId","state","reviewedAt","reviewerRef","technicalBasisRef","evidenceRefs"])
 &&fields(v,["id","actionId","planId","reviewerRef","technicalBasisRef"])&&member(v.state,VERIFICATION_STATES)&&date(v.reviewedAt)&&references(v.evidenceRefs)
 &&(v.state!=="ACCEPTED"||(v.evidenceRefs as string[]).length>0);
const workValid=(v:unknown):v is ExternalWorkReference=>shape(v,["id","actionId","systemRef","externalWorkId","state","updatedAt"])
 &&fields(v,["id","actionId","systemRef","externalWorkId"])&&member(v.state,["OPEN","IN_PROGRESS","COMPLETED","UNKNOWN"])&&date(v.updatedAt);
const deferralValid=(v:unknown):v is DeferralRequest=>shape(v,["id","code","assetId","actionId","revision","state","technicalDueAt","requestedUntil","requestBasisRef","requestedAt"],["authorizedUntil","authorizationRef"])
 &&fields(v,["id","code","assetId","actionId","revision","requestBasisRef"])&&member(v.state,DEFERRAL_STATES)&&date(v.technicalDueAt)&&date(v.requestedUntil)&&date(v.requestedAt)&&optionalDate(v,"authorizedUntil")&&optionalText(v,"authorizationRef")
 &&Date.parse(v.requestedUntil as string)>Date.parse(v.technicalDueAt as string)
 &&(v.state!=="AUTHORIZED"||(date(v.authorizedUntil)&&text(v.authorizationRef)))
 &&(!["REQUESTED","UNDER_REVIEW","REJECTED","WITHDRAWN"].includes(v.state as string)||(!own(v,"authorizedUntil")&&!own(v,"authorizationRef")));
const assessmentValid=(v:unknown):v is DeferralAssessment=>shape(v,["id","deferralId","state","riskBasisRef","compensatingMeasureRefs"],["assessedAt","assessorRef"])
 &&fields(v,["id","deferralId","riskBasisRef"])&&member(v.state,ASSESSMENT_STATES)&&references(v.compensatingMeasureRefs)&&optionalDate(v,"assessedAt")&&optionalText(v,"assessorRef")
 &&(v.state!=="ASSESSED"||(date(v.assessedAt)&&text(v.assessorRef)&&(v.compensatingMeasureRefs as string[]).length>0))
 &&(v.state!=="PENDING"||(!own(v,"assessedAt")&&!own(v,"assessorRef")));
const decisionValid=(v:unknown):v is DeferralDecision=>shape(v,["id","deferralId","revision","kind","decidedAt","authorityRef","decisionBasisRef","assessmentId"],["authorizedUntil"])
 &&fields(v,["id","deferralId","revision","authorityRef","decisionBasisRef","assessmentId"])&&member(v.kind,DEFERRAL_DECISIONS)&&date(v.decidedAt)&&optionalDate(v,"authorizedUntil")
 &&(v.kind!=="AUTHORIZE"||date(v.authorizedUntil))&&(v.kind!=="REJECT"||!own(v,"authorizedUntil"));
const fail=(issues:string[]):ActionsParseResult=>Object.freeze({ok:false as const,issues:Object.freeze(issues)});
function collect<T extends {id:string}>(source:unknown,key:string,validate:(v:unknown)=>v is T,issues:string[]):readonly T[]{
 if(!Array.isArray(source)||source.length>20000){issues.push(`${key}: invalid collection`);return Object.freeze([]);}
 const records:T[]=[];
 source.forEach((v:unknown,i:number)=>{
  if(!validate(v)){issues.push(`${key}[${i}]: invalid record`);return;}
  const clone:Record<string,unknown>={...v};
  for(const field of ["sourceEvidenceRefs","evidenceRefs","compensatingMeasureRefs"]){
   if(field in v){const refs=(v as Record<string,unknown>)[field] as readonly string[];clone[field]=Object.freeze([...refs]);}
  }
  records.push(Object.freeze(clone) as T);
 });
 if(new Set(records.map(r=>r.id)).size!==records.length)issues.push(`${key}: duplicate record identity`);
 return Object.freeze(records);
}
/** Reject the entire batch if any owned record, link or protected state is inconsistent. */
export function parseActionsSnapshot(input:unknown):ActionsParseResult{
 if(!plain(input)||Object.keys(input).some(k=>!KEYS.includes(k as typeof KEYS[number]))||KEYS.some(k=>!Array.isArray(input[k])))return fail(["Invalid ACT snapshot structure"]);
 const issues:string[]=[];
 const actions=collect(input.actions,"actions",actionValid,issues);
 const repairs=collect(input.repairs,"repairs",repairValid,issues);
 const controls=collect(input.controls,"controls",controlValid,issues);
 const plans=collect(input.plans,"plans",planValid,issues);
 const evidence=collect(input.evidence,"evidence",evidenceValid,issues);
 const verifications=collect(input.verifications,"verifications",verificationValid,issues);
 const externalWork=collect(input.externalWork,"externalWork",workValid,issues);
 const deferrals=collect(input.deferrals,"deferrals",deferralValid,issues);
 const assessments=collect(input.assessments,"assessments",assessmentValid,issues);
 const decisions=collect(input.decisions,"decisions",decisionValid,issues);
 const actionById=new Map(actions.map(x=>[x.id,x]));
 const planById=new Map(plans.map(x=>[x.id,x]));
 const verificationById=new Map(verifications.map(x=>[x.id,x]));
 const deferralById=new Map(deferrals.map(x=>[x.id,x]));
 const assessmentById=new Map(assessments.map(x=>[x.id,x]));
 const actionRefs=[...repairs,...controls,...plans,...evidence,...verifications,...externalWork];
 actionRefs.forEach(x=>{if(!actionById.has(x.actionId))issues.push(`${x.id}: action reference not in snapshot`);});
 repairs.forEach(r=>{const a=actionById.get(r.actionId);if(a&&a.kind!==`${r.kind}_REPAIR`)issues.push(`${r.id}: repair kind differs from owning action`);if(r.installedAt&&r.expiresAt&&Date.parse(r.expiresAt)<=Date.parse(r.installedAt))issues.push(`${r.id}: expiry must follow installation`);});
 controls.forEach(c=>{if(actionById.get(c.actionId)?.kind!=="TEMPORARY_CONTROL")issues.push(`${c.id}: control must belong to temporary-control action`);if(c.activatedAt&&Date.parse(c.expiresAt)<=Date.parse(c.activatedAt))issues.push(`${c.id}: expiry must follow activation`);});
 plans.forEach(p=>{if(p.releasedAt&&Date.parse(p.releasedAt)<Date.parse(p.createdAt))issues.push(`${p.id}: released before creation`);});
 evidence.forEach(e=>{const p=planById.get(e.planId);if(!p||p.actionId!==e.actionId)issues.push(`${e.id}: execution evidence does not match plan and action`);});
 verifications.forEach(v=>{const p=planById.get(v.planId);if(!p||p.actionId!==v.actionId||p.state!=="RELEASED")issues.push(`${v.id}: verification requires matching released plan`);if(p?.releasedAt&&Date.parse(v.reviewedAt)<Date.parse(p.releasedAt))issues.push(`${v.id}: verification must follow plan release`);});
 actions.forEach(a=>{
  if(a.approvedPlanRef){const p=planById.get(a.approvedPlanRef);if(!p||p.actionId!==a.id||p.state!=="RELEASED")issues.push(`${a.id}: released plan reference invalid`);}
  if(["WORK_COMPLETE","VERIFIED","CLOSED"].includes(a.state)){
   const completion=evidence.some(e=>e.actionId===a.id&&!!e.workCompletedAt&&planById.get(e.planId)?.state==="RELEASED");
   if(!completion||!a.approvedPlanRef)issues.push(`${a.id}: work complete requires released plan and source-backed completion evidence`);
  }
  if(["VERIFIED","CLOSED"].includes(a.state)){const v=verificationById.get(a.verificationRef??"");if(!v||v.actionId!==a.id||v.state!=="ACCEPTED"||v.reviewedAt!==a.verifiedAt)issues.push(`${a.id}: independent accepted action verification required`);}
 });
 deferrals.forEach(d=>{
  const a=actionById.get(d.actionId);if(!a||a.assetId!==d.assetId)issues.push(`${d.id}: action / asset identity mismatch`);
  if(a?.technicalDueAt&&a.technicalDueAt!==d.technicalDueAt)issues.push(`${d.id}: original technical due must match owning source action`);
  if(d.authorizedUntil&&Date.parse(d.authorizedUntil)>Date.parse(d.requestedUntil))issues.push(`${d.id}: authorization exceeds requested limit`);
  if(d.authorizedUntil&&Date.parse(d.authorizedUntil)<=Date.parse(d.technicalDueAt))issues.push(`${d.id}: authorization must extend original technical due`);
  const relevant=decisions.filter(x=>x.deferralId===d.id).sort((x,y)=>Date.parse(x.decidedAt)-Date.parse(y.decidedAt));
  if(relevant.length>1)issues.push(`${d.id}: decision revision history ambiguous in one snapshot`);
  const dec=relevant[0];
  if(d.state==="AUTHORIZED"||d.state==="EXPIRED"){
   if(!dec||dec.kind!=="AUTHORIZE"||dec.id!==d.authorizationRef||dec.authorizedUntil!==d.authorizedUntil)issues.push(`${d.id}: matching independent authorization required`);
  }
  if(d.state==="REJECTED"&&(!dec||dec.kind!=="REJECT"))issues.push(`${d.id}: rejection decision missing`);
  if(["REQUESTED","UNDER_REVIEW","WITHDRAWN"].includes(d.state)&&dec)issues.push(`${d.id}: unreviewed or withdrawn request must not carry authority decision`);
 });
 assessments.forEach(a=>{if(!deferralById.has(a.deferralId))issues.push(`${a.id}: orphaned deferral assessment`);});
 decisions.forEach(d=>{
  const request=deferralById.get(d.deferralId),assessment=assessmentById.get(d.assessmentId);
  if(!request||!assessment||assessment.deferralId!==d.deferralId||assessment.state!=="ASSESSED"||request.revision!==d.revision)issues.push(`${d.id}: decision requires assessed request at exact revision`);
  if(request&&Date.parse(d.decidedAt)<Date.parse(request.requestedAt))issues.push(`${d.id}: decision precedes request`);
  if(assessment?.assessedAt&&Date.parse(d.decidedAt)<Date.parse(assessment.assessedAt))issues.push(`${d.id}: decision precedes assessment`);
  if(d.kind==="AUTHORIZE"&&request&&(Date.parse(d.authorizedUntil!)>Date.parse(request.requestedUntil)||Date.parse(d.authorizedUntil!)<=Date.parse(request.technicalDueAt)))issues.push(`${d.id}: authorized extension inconsistent with request`);
 });
 return issues.length?fail(issues):Object.freeze({ok:true as const,snapshot:Object.freeze({actions,repairs,controls,plans,evidence,verifications,externalWork,deferrals,assessments,decisions})});
}
export function filterActions(records:readonly IntegrityAction[],query:string,state:ActionState|"ALL"="ALL",kind:ActionKind|"ALL"="ALL"):readonly IntegrityAction[]{
 const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return records.filter(r=>(state==="ALL"||r.state===state)&&(kind==="ALL"||r.kind===kind)&&words.every(w=>[r.code,r.id,r.assetId,r.title,r.technicalBasisRef].join(" ").toLocaleLowerCase().includes(w)));
}
export function filterDeferrals(records:readonly DeferralRequest[],query:string,state:DeferralState|"ALL"="ALL"):readonly DeferralRequest[]{
 const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return records.filter(r=>(state==="ALL"||r.state===state)&&words.every(w=>[r.id,r.code,r.assetId,r.actionId,r.requestBasisRef].join(" ").toLocaleLowerCase().includes(w)));
}
export function actionContext(snapshot:ActionsSnapshot,id:string){return Object.freeze({action:snapshot.actions.find(x=>x.id===id),repairs:snapshot.repairs.filter(x=>x.actionId===id),controls:snapshot.controls.filter(x=>x.actionId===id),plans:snapshot.plans.filter(x=>x.actionId===id),evidence:snapshot.evidence.filter(x=>x.actionId===id),verifications:snapshot.verifications.filter(x=>x.actionId===id),externalWork:snapshot.externalWork.filter(x=>x.actionId===id)});}
export function deferralContext(snapshot:ActionsSnapshot,id:string){return Object.freeze({deferral:snapshot.deferrals.find(x=>x.id===id),assessments:snapshot.assessments.filter(x=>x.deferralId===id),decisions:snapshot.decisions.filter(x=>x.deferralId===id)});}
