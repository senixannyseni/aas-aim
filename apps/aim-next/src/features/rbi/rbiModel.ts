/**
 * AAS–AIM / RBI-001–019. Frontend-only, fail-closed read boundary.
 * The browser NEVER calculates probability, consequence, risk, inspection credit,
 * or a governing inspection due date, nor does it approve engineering state.
 */
export const RBI_STATES = ["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED", "REASSESSMENT_REQUIRED"] as const;
export const INPUT_STATES = ["DRAFT", "FROZEN"] as const;
export const INPUT_CATEGORIES = ["DEGRADATION", "INSPECTION", "OPERATING", "CONSEQUENCE", "DESIGN", "OTHER"] as const;
export const DATA_QUALITY = ["VALID", "STALE", "MISSING", "UNKNOWN", "SUSPECT"] as const;
export const RESULT_KINDS = ["DAMAGE_FACTOR", "POF", "COF", "CURRENT_RISK", "FUTURE_RISK", "RISK_TARGET", "DUE_CANDIDATE", "INSPECTION_EFFECTIVENESS"] as const;
export const RESULT_STATES = ["CALCULATED", "APPROVED", "PROJECTED"] as const;
export const STRATEGY_STATES = ["DRAFT", "PROPOSED", "APPROVED"] as const;
export type RbiAssessment = Readonly<{
  id:string; code:string; assetId:string; revision:string; status:typeof RBI_STATES[number];
  methodology:string; basisReference:string; inputSetId:string; quality:typeof DATA_QUALITY[number];
  assessedAt?:string; approvedAt?:string; approvalBasisReference?:string; reassessmentReason?:string;
}>;
export type RbiInput = Readonly<{
  id:string; category:typeof INPUT_CATEGORIES[number]; sourceReference:string;
  quality:typeof DATA_QUALITY[number]; recordRevision:string;
}>;
export type RbiInputSet = Readonly<{
  id:string; assessmentId:string; revision:string; status:typeof INPUT_STATES[number];
  inputs:readonly RbiInput[]; frozenAt?:string;
}>;
export type RbiResult = Readonly<{
  id:string; assessmentId:string; inputSetId:string; kind:typeof RESULT_KINDS[number];
  displayValue:string; unit:string; basisReference:string; calculatedAt:string;
  state:typeof RESULT_STATES[number];
}>;
export type RbiStrategy = Readonly<{
  id:string; assessmentId:string; status:typeof STRATEGY_STATES[number];
  inspectionTechnique:string; targetEffectiveness:string; targetCoveragePercent:number;
  basisReference:string; dueCandidateResultId?:string; approvedAt?:string;
}>;
export type RbiScenarioResult = Readonly<{
  id:string; kind:typeof RESULT_KINDS[number]; displayValue:string; unit:string;
  basisReference:string;
}>;
export type RbiScenario = Readonly<{
  id:string; assessmentId:string; title:string; basedOnRevision:string;
  changeSummary:string; status:"SCENARIO"; evaluatedAt:string;
  results:readonly RbiScenarioResult[];
}>;
export type RbiSnapshot = Readonly<{
  assessments:readonly RbiAssessment[]; inputSets:readonly RbiInputSet[];
  results:readonly RbiResult[]; strategies:readonly RbiStrategy[];
  scenarios:readonly RbiScenario[];
}>;
export type RbiParseResult = Readonly<{ok:true;snapshot:RbiSnapshot}> | Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_RBI:RbiSnapshot = Object.freeze({
  assessments:Object.freeze([]),inputSets:Object.freeze([]),results:Object.freeze([]),
  strategies:Object.freeze([]),scenarios:Object.freeze([]),
});
const ROOT_KEYS = ["assessments", "inputSets", "results", "strategies", "scenarios"] as const;
const own=(o:object,k:string):boolean=>Object.prototype.hasOwnProperty.call(o,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const txt=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=600&&!/[\u0000-\u001f\u007f]/.test(v);
const en=<T extends string>(v:unknown,a:readonly T[]):v is T=>typeof v==="string"&&a.includes(v as T);
const percent=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100;
const quantity=(v:unknown):boolean=>typeof v==="string"&&/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)&&Number.isFinite(Number(v));
const iso=(v:unknown):v is string=>{
 if(typeof v!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
 if(!m)return false;
 const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),tz=m[7]!;
 const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 return y>0&&mo>=1&&mo<=12&&d>=1&&d<=days[mo-1]!&&Number(m[4])<=23&&Number(m[5])<=59&&Number(m[6])<=59&&(tz==="Z"||(Number(tz.slice(1,3))<=14&&Number(tz.slice(4,6))<=59&&(Number(tz.slice(1,3))!==14||Number(tz.slice(4,6))===0)))&&Number.isFinite(Date.parse(v));
};
const shape=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>own(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const allText=(v:Record<string,unknown>,ks:readonly string[]):boolean=>ks.every(k=>txt(v[k]));
const optionalText=(v:Record<string,unknown>,k:string):boolean=>!own(v,k)||txt(v[k]);
const optionalDate=(v:Record<string,unknown>,k:string):boolean=>!own(v,k)||iso(v[k]);
function fail(issues:string[]):RbiParseResult{return Object.freeze({ok:false as const,issues:Object.freeze(issues)});}
function take<T extends {id:string}>(v:unknown,key:string,validate:(v:unknown)=>v is T,copy:(v:T)=>T,issues:string[]):readonly T[]{
 if(!Array.isArray(v)||v.length>20000){issues.push(`${key}: invalid collection`);return Object.freeze([]);}
 const out:T[]=[];
 v.forEach((item,i)=>{if(validate(item))out.push(copy(item));else issues.push(`${key}[${i}]: invalid record`);});
 if(new Set(out.map(x=>x.id)).size!==out.length)issues.push(`${key}: duplicate id`);
 return Object.freeze(out);
}
const assessmentValid=(v:unknown):v is RbiAssessment=>shape(v,["id","code","assetId","revision","status","methodology","basisReference","inputSetId","quality"],["assessedAt","approvedAt","approvalBasisReference","reassessmentReason"])
 &&allText(v,["id","code","assetId","revision","methodology","basisReference","inputSetId"])&&en(v.status,RBI_STATES)&&en(v.quality,DATA_QUALITY)
 &&optionalDate(v,"assessedAt")&&optionalDate(v,"approvedAt")&&optionalText(v,"approvalBasisReference")&&optionalText(v,"reassessmentReason")
 &&(!["APPROVED","SUPERSEDED"].includes(v.status as string)||(iso(v.approvedAt)&&txt(v.approvalBasisReference)&&iso(v.assessedAt)))
 &&(v.status!=="REASSESSMENT_REQUIRED"||txt(v.reassessmentReason));
const inputValid=(v:unknown):v is RbiInput=>shape(v,["id","category","sourceReference","quality","recordRevision"])&&allText(v,["id","sourceReference","recordRevision"])&&en(v.category,INPUT_CATEGORIES)&&en(v.quality,DATA_QUALITY);
const setValid=(v:unknown):v is RbiInputSet=>shape(v,["id","assessmentId","revision","status","inputs"],["frozenAt"])
 &&allText(v,["id","assessmentId","revision"])&&en(v.status,INPUT_STATES)&&optionalDate(v,"frozenAt")
 &&(v.status!=="FROZEN"||iso(v.frozenAt))&&Array.isArray(v.inputs)&&v.inputs.length<=2000&&v.inputs.every(inputValid)
 &&new Set((v.inputs as RbiInput[]).map(x=>x.id)).size===v.inputs.length;
const resultValid=(v:unknown):v is RbiResult=>shape(v,["id","assessmentId","inputSetId","kind","displayValue","unit","basisReference","calculatedAt","state"])
 &&allText(v,["id","assessmentId","inputSetId","displayValue","unit","basisReference"])&&en(v.kind,RESULT_KINDS)&&en(v.state,RESULT_STATES)&&iso(v.calculatedAt)
 &&(v.kind!=="DUE_CANDIDATE"||iso(v.displayValue))&&(!["POF","COF","DAMAGE_FACTOR"].includes(v.kind as string)||quantity(v.displayValue));
const strategyValid=(v:unknown):v is RbiStrategy=>shape(v,["id","assessmentId","status","inspectionTechnique","targetEffectiveness","targetCoveragePercent","basisReference"],["dueCandidateResultId","approvedAt"])
 &&allText(v,["id","assessmentId","inspectionTechnique","targetEffectiveness","basisReference"])&&en(v.status,STRATEGY_STATES)&&percent(v.targetCoveragePercent)
 &&optionalText(v,"dueCandidateResultId")&&optionalDate(v,"approvedAt")&&(v.status!=="APPROVED"||iso(v.approvedAt));
const scenarioResultValid=(v:unknown):v is RbiScenarioResult=>shape(v,["id","kind","displayValue","unit","basisReference"])&&allText(v,["id","displayValue","unit","basisReference"])&&en(v.kind,RESULT_KINDS)
 &&(v.kind!=="DUE_CANDIDATE"||iso(v.displayValue))&&(!["POF","COF","DAMAGE_FACTOR"].includes(v.kind as string)||quantity(v.displayValue));
const scenarioValid=(v:unknown):v is RbiScenario=>shape(v,["id","assessmentId","title","basedOnRevision","changeSummary","status","evaluatedAt","results"])
 &&allText(v,["id","assessmentId","title","basedOnRevision","changeSummary"])&&v.status==="SCENARIO"&&iso(v.evaluatedAt)
 &&Array.isArray(v.results)&&v.results.length<=1500&&v.results.every(scenarioResultValid)
 &&new Set((v.results as RbiScenarioResult[]).map(x=>x.id)).size===v.results.length;
/** Reject entire snapshot on any invalid record or missing/crossed link; no partial data exposed. */
export function parseRbiSnapshot(input:unknown):RbiParseResult{
 if(!plain(input)||Object.keys(input).some(k=>!ROOT_KEYS.includes(k as typeof ROOT_KEYS[number]))||ROOT_KEYS.some(k=>!Array.isArray(input[k])))return fail(["Invalid RBI snapshot structure"]);
 const issues:string[]=[];
 const assessments=take(input.assessments,"assessments",assessmentValid,x=>Object.freeze({...x}),issues);
 const inputSets=take(input.inputSets,"inputSets",setValid,x=>Object.freeze({...x,inputs:Object.freeze(x.inputs.map(y=>Object.freeze({...y})))}),issues);
 const results=take(input.results,"results",resultValid,x=>Object.freeze({...x}),issues);
 const strategies=take(input.strategies,"strategies",strategyValid,x=>Object.freeze({...x}),issues);
 const scenarios=take(input.scenarios,"scenarios",scenarioValid,x=>Object.freeze({...x,results:Object.freeze(x.results.map(y=>Object.freeze({...y})))}),issues);
 const aMap=new Map(assessments.map(x=>[x.id,x]));const sMap=new Map(inputSets.map(x=>[x.id,x]));const rMap=new Map(results.map(x=>[x.id,x]));
 const allIds=[...assessments,...inputSets,...results,...strategies,...scenarios].map(x=>x.id);
 const uniqueBy=(ids:readonly string[],message:string)=>{if(new Set(ids).size!==ids.length)issues.push(message);};
 uniqueBy(strategies.map(x=>x.assessmentId),"strategies: ambiguous multiple strategies for assessment");
 uniqueBy(results.map(x=>`${x.assessmentId}\u0000${x.kind}`),"results: ambiguous duplicate result kind for assessment");
 if(new Set(allIds).size!==allIds.length)issues.push("Cross-collection duplicate ID");
 for(const x of assessments){const set=sMap.get(x.inputSetId);if(!set||set.assessmentId!==x.id)issues.push(`assessments: input set link invalid`);if(["APPROVED","SUPERSEDED"].includes(x.status)&&(set?.status!=="FROZEN"||!set.inputs.length))issues.push("assessments: approved revision requires frozen nonempty input set");}
 for(const x of inputSets)if(!aMap.has(x.assessmentId))issues.push("inputSets: missing assessment");
 for(const x of results){const a=aMap.get(x.assessmentId),s=sMap.get(x.inputSetId);if(!a||!s||s.assessmentId!==x.assessmentId||a.inputSetId!==x.inputSetId)issues.push("results: mismatched assessment/input set");if(x.state==="APPROVED"&&(!a||!["APPROVED","SUPERSEDED","REASSESSMENT_REQUIRED"].includes(a.status)||!a.approvedAt||!a.approvalBasisReference||s?.status!=="FROZEN"))issues.push("results: unsupported approved label");}
 for(const x of strategies){const a=aMap.get(x.assessmentId);if(!a)issues.push("strategies: missing assessment");if(x.status==="APPROVED"&&(!a||!["APPROVED","SUPERSEDED","REASSESSMENT_REQUIRED"].includes(a.status)||!a.approvedAt||!a.approvalBasisReference))issues.push("strategies: unsupported approved label");if(x.dueCandidateResultId){const r=rMap.get(x.dueCandidateResultId);if(!r||r.kind!=="DUE_CANDIDATE"||r.assessmentId!==x.assessmentId)issues.push("strategies: invalid RBI due candidate link");}}
 for(const x of scenarios){const a=aMap.get(x.assessmentId);if(!a||a.revision!==x.basedOnRevision)issues.push("scenarios: missing assessment/base revision");}
 if(issues.length)return fail(issues);
 return Object.freeze({ok:true as const,snapshot:Object.freeze({assessments,inputSets,results,strategies,scenarios})});
}
export function filterRbiAssessments(items:readonly RbiAssessment[],query:string,status:"ALL"|RbiAssessment["status"]="ALL"):readonly RbiAssessment[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return items.filter(a=>(status==="ALL"||a.status===status)&&terms.every(t=>`${a.id} ${a.code} ${a.assetId} ${a.methodology} ${a.revision}`.toLocaleLowerCase().includes(t)));
}
export function rbiAssessmentContext(snapshot:RbiSnapshot,assessmentId:string):Readonly<{assessment:RbiAssessment|undefined;inputSet:RbiInputSet|undefined;results:readonly RbiResult[];strategy:RbiStrategy|undefined;scenarios:readonly RbiScenario[]}>{
 const assessment=snapshot.assessments.find(x=>x.id===assessmentId);
 const inputSet=snapshot.inputSets.find(x=>x.id===assessment?.inputSetId);
 return {assessment,inputSet,results:snapshot.results.filter(x=>x.assessmentId===assessmentId),strategy:snapshot.strategies.find(x=>x.assessmentId===assessmentId),scenarios:snapshot.scenarios.filter(x=>x.assessmentId===assessmentId)};
}
/** Display only an externally supplied RBI due candidate. NEVER an INS-016 technical due date. */
export function rbiDueCandidate(snapshot:RbiSnapshot,assessmentId:string):RbiResult|undefined{
 return snapshot.results.find(x=>x.assessmentId===assessmentId&&x.kind==="DUE_CANDIDATE");
}
