/** FFS-001–011. Read-only projections of externally authorized engineering records.
 * Coherence checks do not authenticate the supplying principal or authorize any decision.
 * The browser MUST NOT calculate fitness, FFS remaining life or inspection due dates.
 */
export const FFS_STATES = ["DRAFT","IN_REVIEW","APPROVED","REASSESSMENT_REQUIRED"] as const;
export const FFS_LEVELS = ["LEVEL_1","LEVEL_2","LEVEL_3"] as const;
export const INPUT_STATES = ["DRAFT","FROZEN"] as const;
export const INPUT_QUALITY = ["VALID","SUSPECT","MISSING","STALE","UNKNOWN"] as const;
export const FLAW_TYPES = ["GENERAL_METAL_LOSS","LOCAL_METAL_LOSS","PITTING","CRACK_LIKE","DISTORTION","OTHER"] as const;
export const RESULT_KINDS = ["FITNESS","REMAINING_LIFE","OPERATING_ENVELOPE","INSPECTION_CONSTRAINT"] as const;
export const RESULT_STATES = ["PROPOSED","APPROVED","HISTORICAL_APPROVED"] as const;
export const FITNESS_DECISIONS = ["FIT","CONDITIONAL","NOT_FIT","INDETERMINATE"] as const;
export const SCENARIO_STATES = ["SCENARIO"] as const;
export type FfsState = typeof FFS_STATES[number];
export type FfsResultKind = typeof RESULT_KINDS[number];
export type FfsAssessment = Readonly<{
 id:string;code:string;assetId:string;revision:string;title:string;status:FfsState;level:typeof FFS_LEVELS[number];
 methodologyRef:string;procedureRef:string;basisRef:string;createdAt:string;inputSetId?:string;
 approvalRef?:string;approvedAt?:string;approverRef?:string;reassessmentReason?:string;
}>;
export type FfsInput = Readonly<{
 id:string;kind:"GEOMETRY"|"MATERIAL"|"LOAD_CASE"|"FLAW"|"INSPECTION"|"PROCESS";
 sourceRef:string;sourceRevision:string;quality:typeof INPUT_QUALITY[number];
}>;
export type FfsInputSet = Readonly<{
 id:string;assessmentId:string;revision:string;status:typeof INPUT_STATES[number];frozenAt?:string;
 inputs:readonly FfsInput[];
}>;
export type FfsFlaw = Readonly<{
 id:string;assessmentId:string;inputId:string;kind:typeof FLAW_TYPES[number];locationRef:string;characterizationRef:string;
}>;
export type FfsResult = Readonly<{
 id:string;assessmentId:string;revision:string;inputSetId:string;kind:FfsResultKind;
 status:typeof RESULT_STATES[number];displayValue:string;unit?:string;
 basisRef:string;traceRef:string;calculatedAt:string;fitnessDecision?:typeof FITNESS_DECISIONS[number];
}>;
export type FfsCondition = Readonly<{
 id:string;assessmentId:string;resultId:string;kind:"OPERATING"|"MONITORING"|"REMEDIATION";
 requirement:string;acceptanceRef:string;dueCandidateRef?:string;
}>;
export type FfsScenarioResult = Readonly<{
 id:string;kind:FfsResultKind;displayValue:string;unit?:string;basisRef:string;status:"SCENARIO";
}>;
export type FfsScenario = Readonly<{
 id:string;assessmentId:string;basedOnRevision:string;title:string;changeSummary:string;
 inputBasisRef:string;evaluatedAt?:string;status:"SCENARIO";results:readonly FfsScenarioResult[];
}>;
export type FfsSnapshot = Readonly<{
 assessments:readonly FfsAssessment[];inputSets:readonly FfsInputSet[];flaws:readonly FfsFlaw[];
 results:readonly FfsResult[];conditions:readonly FfsCondition[];scenarios:readonly FfsScenario[];
}>;
export type FfsParseResult = Readonly<{ok:true;snapshot:FfsSnapshot}> | Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_FFS:FfsSnapshot=Object.freeze({assessments:Object.freeze([]),inputSets:Object.freeze([]),flaws:Object.freeze([]),results:Object.freeze([]),conditions:Object.freeze([]),scenarios:Object.freeze([])});
const KEYS=["assessments","inputSets","flaws","results","conditions","scenarios"] as const;
const has=(obj:object,key:string)=>Object.prototype.hasOwnProperty.call(obj,key);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const label=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=2000&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const enumOf=<T extends string>(v:unknown,allowed:readonly T[]):v is T=>typeof v==="string"&&allowed.includes(v as T);
const exact=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>has(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const labels=(v:Record<string,unknown>,keys:readonly string[])=>keys.every(k=>label(v[k]));
const optionalLabel=(v:Record<string,unknown>,key:string)=>!has(v,key)||label(v[key]);
const instant=(v:unknown):v is string=>{
 if(typeof v!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
 if(!m)return false;
 const y=+m[1]!,mo=+m[2]!,d=+m[3]!,hr=+m[4]!,mi=+m[5]!,s=+m[6]!,tz=m[7]!;
 const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 return y>0&&mo>=1&&mo<=12&&d>=1&&d<=days[mo-1]!&&hr<=23&&mi<=59&&s<=59&&
 (tz==="Z"||(+tz.slice(1,3)<=14&&+tz.slice(4,6)<=59&&(+tz.slice(1,3)!==14||+tz.slice(4,6)===0)))&&Number.isFinite(Date.parse(v));
};
const optionalInstant=(v:Record<string,unknown>,key:string)=>!has(v,key)||instant(v[key]);
const approvalKeys=["approvalRef","approverRef","approvedAt"];
const assessmentValid=(v:unknown):v is FfsAssessment=>exact(v,["id","code","assetId","revision","title","status","level","methodologyRef","procedureRef","basisRef","createdAt"],["inputSetId",...approvalKeys,"reassessmentReason"])
 &&labels(v,["id","code","assetId","revision","title","methodologyRef","procedureRef","basisRef"])
 &&enumOf(v.status,FFS_STATES)&&enumOf(v.level,FFS_LEVELS)&&instant(v.createdAt)&&optionalLabel(v,"inputSetId")&&optionalLabel(v,"reassessmentReason")
 &&optionalLabel(v,"approvalRef")&&optionalLabel(v,"approverRef")&&optionalInstant(v,"approvedAt")
 &&(v.status!=="APPROVED"||(label(v.inputSetId)&&label(v.approvalRef)&&label(v.approverRef)&&instant(v.approvedAt)))
 &&(v.status==="APPROVED"||approvalKeys.every(k=>!has(v,k)))
 &&(v.status!=="REASSESSMENT_REQUIRED"||label(v.reassessmentReason));
const inputValid=(v:unknown):v is FfsInput=>exact(v,["id","kind","sourceRef","sourceRevision","quality"])
 &&labels(v,["id","sourceRef","sourceRevision"])&&enumOf(v.kind,["GEOMETRY","MATERIAL","LOAD_CASE","FLAW","INSPECTION","PROCESS"] as const)&&enumOf(v.quality,INPUT_QUALITY);
const inputSetValid=(v:unknown):v is FfsInputSet=>exact(v,["id","assessmentId","revision","status","inputs"],["frozenAt"])
 &&labels(v,["id","assessmentId","revision"])&&enumOf(v.status,INPUT_STATES)&&optionalInstant(v,"frozenAt")
 &&(v.status!=="FROZEN"||instant(v.frozenAt))&&(v.status==="FROZEN"||!has(v,"frozenAt"))
 &&Array.isArray(v.inputs)&&v.inputs.length<=2000&&v.inputs.every(inputValid)&&new Set((v.inputs as FfsInput[]).map(x=>x.id)).size===v.inputs.length;
const flawValid=(v:unknown):v is FfsFlaw=>exact(v,["id","assessmentId","inputId","kind","locationRef","characterizationRef"])
 &&labels(v,["id","assessmentId","inputId","locationRef","characterizationRef"])&&enumOf(v.kind,FLAW_TYPES);
const resultValid=(v:unknown):v is FfsResult=>exact(v,["id","assessmentId","revision","inputSetId","kind","status","displayValue","basisRef","traceRef","calculatedAt"],["unit","fitnessDecision"])
 &&labels(v,["id","assessmentId","revision","inputSetId","displayValue","basisRef","traceRef"])
 &&enumOf(v.kind,RESULT_KINDS)&&enumOf(v.status,RESULT_STATES)&&optionalLabel(v,"unit")&&optionalLabel(v,"fitnessDecision")&&instant(v.calculatedAt)
 &&(v.kind!=="FITNESS"||enumOf(v.fitnessDecision,FITNESS_DECISIONS))&&(v.kind==="FITNESS"||!has(v,"fitnessDecision"))
 &&(v.kind!=="REMAINING_LIFE"||label(v.unit))&&(v.kind==="REMAINING_LIFE"||!has(v,"unit")||label(v.unit));
const conditionValid=(v:unknown):v is FfsCondition=>exact(v,["id","assessmentId","resultId","kind","requirement","acceptanceRef"],["dueCandidateRef"])
 &&labels(v,["id","assessmentId","resultId","requirement","acceptanceRef"])&&enumOf(v.kind,["OPERATING","MONITORING","REMEDIATION"] as const)&&optionalLabel(v,"dueCandidateRef");
const scenarioResultValid=(v:unknown):v is FfsScenarioResult=>exact(v,["id","kind","displayValue","basisRef","status"],["unit"])
 &&labels(v,["id","displayValue","basisRef"])&&enumOf(v.kind,RESULT_KINDS)&&v.status==="SCENARIO"&&optionalLabel(v,"unit")&&(v.kind!=="REMAINING_LIFE"||label(v.unit));
const scenarioValid=(v:unknown):v is FfsScenario=>exact(v,["id","assessmentId","basedOnRevision","title","changeSummary","inputBasisRef","status","results"],["evaluatedAt"])
 &&labels(v,["id","assessmentId","basedOnRevision","title","changeSummary","inputBasisRef"])&&v.status==="SCENARIO"&&optionalInstant(v,"evaluatedAt")
 &&Array.isArray(v.results)&&v.results.length<=500&&v.results.every(scenarioResultValid)&&new Set((v.results as FfsScenarioResult[]).map(x=>x.id)).size===v.results.length;
const fail=(issues:string[]):FfsParseResult=>Object.freeze({ok:false as const,issues:Object.freeze(issues)});
function collect<T extends {id:string}>(input:unknown,key:string,check:(v:unknown)=>v is T,issues:string[]):readonly T[]{
 if(!Array.isArray(input)||input.length>20000){issues.push(`${key}: invalid or oversized collection`);return Object.freeze([]);}
 const output:T[]=[];
 input.forEach((item:unknown,i:number)=>{if(!check(item)){issues.push(`${key}[${i}]: invalid record`);return;}
  const copy:Record<string,unknown>={...item};
  if(key==="inputSets")copy.inputs=Object.freeze((item as unknown as FfsInputSet).inputs.map(x=>Object.freeze({...x})));
  if(key==="scenarios")copy.results=Object.freeze((item as unknown as FfsScenario).results.map(x=>Object.freeze({...x})));
  output.push(Object.freeze(copy) as T);
 });
 if(new Set(output.map(x=>x.id)).size!==output.length)issues.push(`${key}: duplicate record ID`);
 return Object.freeze(output);
}
export function parseFfsSnapshot(input:unknown):FfsParseResult{
 if(!plain(input)||Object.keys(input).some(k=>!KEYS.includes(k as typeof KEYS[number]))||KEYS.some(k=>!Array.isArray(input[k])))return fail(["Invalid FFS snapshot structure"]);
 const issues:string[]=[];
 const assessments=collect(input.assessments,"assessments",assessmentValid,issues);
 const inputSets=collect(input.inputSets,"inputSets",inputSetValid,issues);
 const flaws=collect(input.flaws,"flaws",flawValid,issues);
 const results=collect(input.results,"results",resultValid,issues);
 const conditions=collect(input.conditions,"conditions",conditionValid,issues);
 const scenarios=collect(input.scenarios,"scenarios",scenarioValid,issues);
 const ass=new Map(assessments.map(x=>[x.id,x]));const sets=new Map(inputSets.map(x=>[x.id,x]));const res=new Map(results.map(x=>[x.id,x]));
 if(new Set(assessments.map(x=>x.code)).size!==assessments.length)issues.push("assessments: duplicate assessment code");
 inputSets.forEach(x=>{const a=ass.get(x.assessmentId);if(!a||a.revision!==x.revision)issues.push(`${x.id}: input set must belong to assessment revision`);});
 if(new Set(inputSets.map(x=>x.assessmentId)).size!==inputSets.length)issues.push("inputSets: ambiguous input set per assessment revision");
 assessments.forEach(a=>{
  if(a.inputSetId){const s=sets.get(a.inputSetId);if(!s||s.assessmentId!==a.id||s.revision!==a.revision)issues.push(`${a.id}: input set reference mismatch`);}
  if(a.status==="APPROVED"){
   const s=sets.get(a.inputSetId??"");
   if(!s||s.status!=="FROZEN"||!s.inputs.length)issues.push(`${a.id}: approved FFS requires populated frozen inputs`);
   if(s?.inputs.some(i=>i.quality!=="VALID"))issues.push(`${a.id}: approved assessment contains unqualified source inputs`);
   if(!results.some(r=>r.assessmentId===a.id&&r.kind==="FITNESS"&&r.status==="APPROVED"))issues.push(`${a.id}: approved assessment requires approved fitness conclusion`);
   if(s?.frozenAt&&Date.parse(s.frozenAt)>Date.parse(a.approvedAt??""))issues.push(`${a.id}: input freeze later than approval`);
  }
 });
 flaws.forEach(f=>{const a=ass.get(f.assessmentId);const s=sets.get(a?.inputSetId??"");if(!a||!s||!s.inputs.some(i=>i.id===f.inputId&&i.kind==="FLAW"))issues.push(`${f.id}: flaw must reference matching FLAW input`);});
 results.forEach(r=>{
  const a=ass.get(r.assessmentId);const s=sets.get(r.inputSetId);
  if(!a||a.revision!==r.revision||!s||s.assessmentId!==r.assessmentId||s.revision!==r.revision||a.inputSetId!==r.inputSetId)issues.push(`${r.id}: result belongs to invalid assessment/input revision`);
  if(r.status==="APPROVED"&&a?.status!=="APPROVED")issues.push(`${r.id}: only current approved assessment can have current approved result`);
  if(r.status==="HISTORICAL_APPROVED"&&a?.status!=="REASSESSMENT_REQUIRED")issues.push(`${r.id}: historical approved result requires reassessment-required context`);
  if(r.status!=="PROPOSED"&&s?.status!=="FROZEN")issues.push(`${r.id}: approved/historical results require frozen inputs`);
  if(a?.status==="APPROVED"&&r.status!=="APPROVED")issues.push(`${r.id}: approved assessment cannot contain draft/historical results in current revision`);
  if(r.status==="APPROVED"&&a?.approvedAt&&Date.parse(r.calculatedAt)>Date.parse(a.approvedAt))issues.push(`${r.id}: result calculated after approval`);
 });
 if(new Set(results.map(r=>`${r.assessmentId}:${r.kind}`)).size!==results.length)issues.push("results: ambiguous duplicate kind per assessment");
 conditions.forEach(c=>{const r=res.get(c.resultId);if(!r||r.assessmentId!==c.assessmentId||!ass.has(c.assessmentId))issues.push(`${c.id}: condition must reference an FFS result of same assessment`);if(c.dueCandidateRef&&c.kind!=="MONITORING")issues.push(`${c.id}: inspection constraint belongs to monitoring requirement`);});
 scenarios.forEach(s=>{const a=ass.get(s.assessmentId);if(!a||a.revision!==s.basedOnRevision)issues.push(`${s.id}: scenario must trace source assessment revision`);if(s.results.length&&!s.evaluatedAt)issues.push(`${s.id}: evaluated scenario requires a timestamp`);});
 return issues.length?fail(issues):Object.freeze({ok:true as const,snapshot:Object.freeze({assessments,inputSets,flaws,results,conditions,scenarios})});
}
export function filterFfs(records:readonly FfsAssessment[],query:string,status:FfsState|"ALL"="ALL"):readonly FfsAssessment[]{
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return records.filter(x=>(status==="ALL"||x.status===status)&&words.every(w=>[x.code,x.id,x.assetId,x.title,x.methodologyRef].join(" ").toLocaleLowerCase().includes(w)));
}
export function assessmentContext(s:FfsSnapshot,id:string){const a=s.assessments.find(x=>x.id===id);return Object.freeze({assessment:a,inputSet:s.inputSets.find(x=>x.id===a?.inputSetId),flaws:s.flaws.filter(x=>x.assessmentId===id),results:s.results.filter(x=>x.assessmentId===id),conditions:s.conditions.filter(x=>x.assessmentId===id),scenarios:s.scenarios.filter(x=>x.assessmentId===id)});}
export function scenarioContext(s:FfsSnapshot,id:string){const scenario=s.scenarios.find(x=>x.id===id);return Object.freeze({scenario,assessment:s.assessments.find(x=>x.id===scenario?.assessmentId)});}
