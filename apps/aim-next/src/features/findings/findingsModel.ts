/**
 * AAS–AIM: FND-001–011. Read-only, fail-closed presentation records.
 * Findings, assessments, dispositions, cases and external actions have distinct identities.
 * The frontend neither validates findings nor approves, closes or reopens condition cases.
 */
export const FINDING_STATES = ["OBSERVED","TRIAGE_PENDING","VALIDATED","REJECTED","SUPERSEDED"] as const;
export const SEVERITIES = ["LOW","MODERATE","HIGH","CRITICAL","UNKNOWN"] as const;
export const CASE_STATES = ["OPEN","ASSESSMENT_PENDING","IN_REVIEW","MONITORING","CLOSED","REOPENED"] as const;
export const ASSESSMENT_STATES = ["DRAFT","IN_REVIEW","APPROVED","SUPERSEDED"] as const;
export const DISPOSITION_KINDS = ["MONITOR","REPAIR","RESTRICT_OPERATION","FFS_REQUIRED","NO_ACTION","OTHER"] as const;
export const DISPOSITION_STATES = ["PROPOSED","AUTHORIZED"] as const;
export const MONITORING_STATES = ["ACTIVE","REASSESSMENT_REQUIRED","COMPLETE"] as const;
export type Finding = Readonly<{
 id:string;code:string;assetId:string;componentId?:string;sourceRecordRef:string;
 observedAt:string;severity:typeof SEVERITIES[number];status:typeof FINDING_STATES[number];
 description:string;location?:string;evidenceRefs:readonly string[];
 validatedAt?:string;validationBasisRef?:string;
}>;
export type ConditionCase = Readonly<{
 id:string;code:string;assetId:string;status:typeof CASE_STATES[number];
 summary:string;openedAt:string;findingIds:readonly string[];
 assessmentId?:string;dispositionId?:string;
 recommendationRefs:readonly string[];actionRefs:readonly string[];
 closure?:Readonly<{decisionAt:string;basisRef:string;authorizedByRef:string;verificationRef:string}>;
 reopenedAt?:string;reopenBasisRef?:string;
}>;
export type ConditionAssessment = Readonly<{
 id:string;caseId:string;revision:string;status:typeof ASSESSMENT_STATES[number];
 significance:string;risk:typeof SEVERITIES[number];evidenceRefs:readonly string[];
 basisRef:string;assessedAt:string;approvedAt?:string;approvalBasisRef?:string;
}>;
export type ConditionDisposition = Readonly<{
 id:string;caseId:string;assessmentId:string;kind:typeof DISPOSITION_KINDS[number];
 status:typeof DISPOSITION_STATES[number];decisionBasisRef:string;authorizedAt?:string;
}>;
export type ConditionMonitoring = Readonly<{
 id:string;caseId:string;observedAt:string;sourceRef:string;
 status:typeof MONITORING_STATES[number];note:string;
}>;
export type FindingsSnapshot = Readonly<{
 findings:readonly Finding[];cases:readonly ConditionCase[];
 assessments:readonly ConditionAssessment[];dispositions:readonly ConditionDisposition[];
 monitoring:readonly ConditionMonitoring[];
}>;
export type FindingsParseResult = Readonly<{ok:true;snapshot:FindingsSnapshot}> | Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_FINDINGS:FindingsSnapshot=Object.freeze({findings:Object.freeze([]),cases:Object.freeze([]),assessments:Object.freeze([]),dispositions:Object.freeze([]),monitoring:Object.freeze([])});
const ROOT_KEYS = ["findings","cases","assessments","dispositions","monitoring"] as const;
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const text=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=2500&&!/[\u0000-\u001f\u007f]/.test(v);
const en=<T extends string>(v:unknown,values:readonly T[]):v is T=>typeof v==="string"&&values.includes(v as T);
const shape=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>own(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const fields=(v:Record<string,unknown>,keys:readonly string[])=>keys.every(k=>text(v[k]));
const optionalText=(v:Record<string,unknown>,k:string)=>!own(v,k)||text(v[k]);
const iso=(v:unknown):v is string=>{
 if(typeof v!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
 if(!m)return false;
 const [y,mo,d]=[Number(m[1]),Number(m[2]),Number(m[3])];
 const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 const tz=m[7]!;
 return y>0&&mo>=1&&mo<=12&&d>=1&&d<=days[mo-1]!&&Number(m[4])<24&&Number(m[5])<60&&Number(m[6])<60&&
 (tz==="Z"||(Number(tz.slice(1,3))<=14&&Number(tz.slice(4,6))<60&&(Number(tz.slice(1,3))!==14||Number(tz.slice(4,6))===0)))&&Number.isFinite(Date.parse(v));
};
const optionalDate=(v:Record<string,unknown>,k:string)=>!own(v,k)||iso(v[k]);
const uniqueStrings=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=2000&&v.every(text)&&new Set(v).size===v.length;
const findingValid=(v:unknown):v is Finding=>shape(v,["id","code","assetId","sourceRecordRef","observedAt","severity","status","description","evidenceRefs"],["componentId","location","validatedAt","validationBasisRef"])
 &&fields(v,["id","code","assetId","sourceRecordRef","description"])&&optionalText(v,"componentId")&&optionalText(v,"location")&&en(v.severity,SEVERITIES)&&en(v.status,FINDING_STATES)&&iso(v.observedAt)
 &&uniqueStrings(v.evidenceRefs)&&optionalDate(v,"validatedAt")&&optionalText(v,"validationBasisRef")
 &&(v.status!=="VALIDATED"||(iso(v.validatedAt)&&text(v.validationBasisRef)&&(v.evidenceRefs as string[]).length>0));
const closureValid=(v:unknown):boolean=>shape(v,["decisionAt","basisRef","authorizedByRef","verificationRef"])&&iso(v.decisionAt)&&fields(v,["basisRef","authorizedByRef","verificationRef"]);
const caseValid=(v:unknown):v is ConditionCase=>shape(v,["id","code","assetId","status","summary","openedAt","findingIds","recommendationRefs","actionRefs"],["assessmentId","dispositionId","closure","reopenedAt","reopenBasisRef"])
 &&fields(v,["id","code","assetId","summary"])&&en(v.status,CASE_STATES)&&iso(v.openedAt)&&uniqueStrings(v.findingIds)&&(v.findingIds as string[]).length>0
 &&uniqueStrings(v.recommendationRefs)&&uniqueStrings(v.actionRefs)&&optionalText(v,"assessmentId")&&optionalText(v,"dispositionId")
 &&(!own(v,"closure")||closureValid(v.closure))&&optionalDate(v,"reopenedAt")&&optionalText(v,"reopenBasisRef")
 &&(!["CLOSED","REOPENED"].includes(v.status as string)||own(v,"closure"))
 &&(v.status!=="REOPENED"||(iso(v.reopenedAt)&&text(v.reopenBasisRef)));
const assessmentValid=(v:unknown):v is ConditionAssessment=>shape(v,["id","caseId","revision","status","significance","risk","evidenceRefs","basisRef","assessedAt"],["approvedAt","approvalBasisRef"])
 &&fields(v,["id","caseId","revision","significance","basisRef"])&&en(v.status,ASSESSMENT_STATES)&&en(v.risk,SEVERITIES)&&uniqueStrings(v.evidenceRefs)&&iso(v.assessedAt)
 &&optionalDate(v,"approvedAt")&&optionalText(v,"approvalBasisRef")
 &&(!["APPROVED","SUPERSEDED"].includes(v.status as string)||(iso(v.approvedAt)&&text(v.approvalBasisRef)&&(v.evidenceRefs as string[]).length>0));
const dispositionValid=(v:unknown):v is ConditionDisposition=>shape(v,["id","caseId","assessmentId","kind","status","decisionBasisRef"],["authorizedAt"])
 &&fields(v,["id","caseId","assessmentId","decisionBasisRef"])&&en(v.kind,DISPOSITION_KINDS)&&en(v.status,DISPOSITION_STATES)&&optionalDate(v,"authorizedAt")&&(v.status!=="AUTHORIZED"||iso(v.authorizedAt));
const monitoringValid=(v:unknown):v is ConditionMonitoring=>shape(v,["id","caseId","observedAt","sourceRef","status","note"])
 &&fields(v,["id","caseId","sourceRef","note"])&&iso(v.observedAt)&&en(v.status,MONITORING_STATES);
const reject=(issues:string[]):FindingsParseResult=>Object.freeze({ok:false as const,issues:Object.freeze(issues)});
function take<T extends {id:string}>(input:unknown,key:string,valid:(x:unknown)=>x is T,copy:(x:T)=>T,issues:string[]):readonly T[]{
 if(!Array.isArray(input)||input.length>20000){issues.push(`${key}: invalid collection`);return Object.freeze([]);}
 const out:T[]=[];input.forEach((v:unknown,i:number)=>{if(valid(v))out.push(copy(v));else issues.push(`${key}[${i}]: invalid record`);});
 if(new Set(out.map(x=>x.id)).size!==out.length)issues.push(`${key}: duplicate id`);
 return Object.freeze(out);
}
/** Entire-snapshot rejection; externally provided provenance is displayed, never inferred or promoted. */
export function parseFindingsSnapshot(input:unknown):FindingsParseResult{
 if(!plain(input)||Object.keys(input).some(k=>!ROOT_KEYS.includes(k as typeof ROOT_KEYS[number]))||ROOT_KEYS.some(k=>!Array.isArray(input[k])))return reject(["Invalid findings snapshot structure"]);
 const issues:string[]=[];
 const findings=take(input.findings,"findings",findingValid,x=>Object.freeze({...x,evidenceRefs:Object.freeze([...x.evidenceRefs])}),issues);
 const cases=take(input.cases,"cases",caseValid,x=>Object.freeze({...x,findingIds:Object.freeze([...x.findingIds]),recommendationRefs:Object.freeze([...x.recommendationRefs]),actionRefs:Object.freeze([...x.actionRefs]),...(x.closure?{closure:Object.freeze({...x.closure})}:{})}),issues);
 const assessments=take(input.assessments,"assessments",assessmentValid,x=>Object.freeze({...x,evidenceRefs:Object.freeze([...x.evidenceRefs])}),issues);
 const dispositions=take(input.dispositions,"dispositions",dispositionValid,x=>Object.freeze({...x}),issues);
 const monitoring=take(input.monitoring,"monitoring",monitoringValid,x=>Object.freeze({...x}),issues);
 const all=[...findings,...cases,...assessments,...dispositions,...monitoring].map(x=>x.id);
 if(new Set(all).size!==all.length)issues.push("Duplicate ID across findings collections");
 const fMap=new Map(findings.map(x=>[x.id,x]));const cMap=new Map(cases.map(x=>[x.id,x]));const aMap=new Map(assessments.map(x=>[x.id,x]));const dMap=new Map(dispositions.map(x=>[x.id,x]));
 if(new Set(cases.map(x=>x.code)).size!==cases.length)issues.push("cases: duplicate code");
 if(new Set(findings.map(x=>x.code)).size!==findings.length)issues.push("findings: duplicate code");
 for(const c of cases){
  for(const id of c.findingIds){const f=fMap.get(id);if(!f||f.assetId!==c.assetId||f.status!=="VALIDATED")issues.push("cases: linked finding must be validated and belong to same asset");}
  if(c.assessmentId){const a=aMap.get(c.assessmentId);if(!a||a.caseId!==c.id)issues.push("cases: assessment link invalid");}
  if(c.dispositionId){const d=dMap.get(c.dispositionId);if(!d||d.caseId!==c.id)issues.push("cases: disposition link invalid");}
  if(["CLOSED","REOPENED"].includes(c.status)){
   const a=c.assessmentId?aMap.get(c.assessmentId):undefined;const d=c.dispositionId?dMap.get(c.dispositionId):undefined;
   if(!a||!d||a.status!=="APPROVED"||d.status!=="AUTHORIZED"||d.assessmentId!==a.id||!c.closure)issues.push("cases: closure requires approved assessment, authorized disposition and independent closure review");
   else if(Date.parse(c.closure.decisionAt)<Date.parse(d.authorizedAt!))issues.push("cases: closure predates disposition authorization");
   if(c.status==="REOPENED"&&c.reopenedAt&&c.closure&&Date.parse(c.reopenedAt)<=Date.parse(c.closure.decisionAt))issues.push("cases: reopen must follow closure");
  }
 }
 for(const a of assessments){const c=cMap.get(a.caseId);if(!c)issues.push("assessments: missing case");if(["APPROVED","SUPERSEDED"].includes(a.status)&&c&&!a.evidenceRefs.some(ref=>c.findingIds.some(id=>fMap.get(id)?.evidenceRefs.includes(ref))))issues.push("assessments: approved basis requires linked finding evidence");}
 for(const d of dispositions){const c=cMap.get(d.caseId),a=aMap.get(d.assessmentId);if(!c||!a||a.caseId!==d.caseId)issues.push("dispositions: invalid assessment or case link");if(d.status==="AUTHORIZED"&&(!a||a.status!=="APPROVED"))issues.push("dispositions: unauthorized approval basis");}
 for(const m of monitoring)if(!cMap.has(m.caseId))issues.push("monitoring: missing case");
 if(issues.length)return reject(issues);
 return Object.freeze({ok:true as const,snapshot:Object.freeze({findings,cases,assessments,dispositions,monitoring})});
}
export function filterFindings(records:readonly Finding[],query:string,status:"ALL"|Finding["status"]="ALL",severity:"ALL"|Finding["severity"]="ALL"):readonly Finding[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return records.filter(f=>(status==="ALL"||status===f.status)&&(severity==="ALL"||severity===f.severity)&&terms.every(t=>`${f.id} ${f.code} ${f.assetId} ${f.description} ${f.location??""}`.toLocaleLowerCase().includes(t)));
}
export function findingsCaseContext(s:FindingsSnapshot,id:string):Readonly<{record:ConditionCase|undefined;findings:readonly Finding[];assessment:ConditionAssessment|undefined;disposition:ConditionDisposition|undefined;monitoring:readonly ConditionMonitoring[]}>{
 const record=s.cases.find(x=>x.id===id);
 return {record,findings:s.findings.filter(x=>record?.findingIds.includes(x.id)),assessment:s.assessments.find(x=>x.id===record?.assessmentId),disposition:s.dispositions.find(x=>x.id===record?.dispositionId),monitoring:s.monitoring.filter(x=>x.caseId===id)};
}
