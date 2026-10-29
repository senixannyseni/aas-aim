/** Future AIM / DGM presentation boundary. This never grants approval or derives engineering truth. */
export const MECHANISM_STATES = ["ACTIVE", "DRAFT", "WITHDRAWN"] as const;
export const ASSESSMENT_STATES = ["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED"] as const;
export const APPLICABILITY_STATES = ["APPLICABLE", "NOT_APPLICABLE", "POTENTIAL", "UNKNOWN"] as const;
export const SUSCEPTIBILITY_STATES = ["LOW", "MODERATE", "HIGH", "UNKNOWN"] as const;
export const EVIDENCE_QUALITIES = ["VALID", "STALE", "REJECTED", "UNKNOWN"] as const;
export const CAPABILITY_STATES = ["EFFECTIVE", "LIMITED", "NOT_DEMONSTRATED", "UNKNOWN"] as const;
export const BARRIER_HEALTH_STATES = ["EFFECTIVE", "DEGRADED", "FAILED", "UNKNOWN"] as const;
export const BARRIER_PURPOSES = ["PREVENTIVE", "MITIGATIVE", "DETECTIVE"] as const;
export const MONITORING_DOMAINS = ["IOW", "INS", "COR"] as const;
export type MechanismState = typeof MECHANISM_STATES[number];
export type AssessmentState = typeof ASSESSMENT_STATES[number];
export type ApplicabilityState = typeof APPLICABILITY_STATES[number];
export type Susceptibility = typeof SUSCEPTIBILITY_STATES[number];
export type EvidenceQuality = typeof EVIDENCE_QUALITIES[number];
export type TechniqueCapabilityState = typeof CAPABILITY_STATES[number];
export type BarrierHealth = typeof BARRIER_HEALTH_STATES[number];
export type BarrierPurpose = typeof BARRIER_PURPOSES[number];
export type MonitoringDomain = typeof MONITORING_DOMAINS[number];

export type MechanismDefinition = Readonly<{id:string;code:string;name:string;category:string;revision:string;state:MechanismState;basisReference:string;description?:string}>;
export type DegradationAssessment = Readonly<{id:string;assetId:string;revision:string;state:AssessmentState;basisReference?:string;assessedAt?:string}>;
export type DegradationEvidence = Readonly<{id:string;assessmentId:string;mechanismId:string;description:string;sourceReference:string;quality:EvidenceQuality;observedAt?:string}>;
export type ApplicabilityFactor = Readonly<{id:string;mechanismId:string;label:string;basisReference:string}>;
export type MechanismApplicability = Readonly<{id:string;assessmentId:string;mechanismId:string;applicability:ApplicabilityState;susceptibility:Susceptibility;evidenceIds:readonly string[];factorIds:readonly string[];basisReference?:string}>;
export type TechniqueCapability = Readonly<{id:string;mechanismId:string;technique:string;capability:TechniqueCapabilityState;basisReference:string}>;
export type BarrierDefinition = Readonly<{id:string;name:string;purpose:BarrierPurpose;designBasisReference:string;mechanismIds:readonly string[]}>;
export type BarrierCriterion = Readonly<{id:string;definitionId:string;indicator:string;acceptanceCriterion:string;basisReference:string}>;
export type BarrierInstance = Readonly<{id:string;assessmentId:string;definitionId:string;health:BarrierHealth;assessmentBasisReference?:string}>;
export type MonitoringLink = Readonly<{id:string;assessmentId:string;mechanismId:string;sourceDomain:MonitoringDomain;sourceObjectId:string;sourceReference:string}>;
export type DegradationSnapshot = Readonly<{
  mechanisms:readonly MechanismDefinition[];
  assessments:readonly DegradationAssessment[];
  evidence:readonly DegradationEvidence[];
  factors:readonly ApplicabilityFactor[];
  applicability:readonly MechanismApplicability[];
  techniques:readonly TechniqueCapability[];
  barrierDefinitions:readonly BarrierDefinition[];
  barrierCriteria:readonly BarrierCriterion[];
  barrierInstances:readonly BarrierInstance[];
  monitoringLinks:readonly MonitoringLink[];
}>;
export type DegradationParseResult = Readonly<{ok:true;snapshot:DegradationSnapshot}> | Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_DEGRADATION:DegradationSnapshot = Object.freeze({
  mechanisms:Object.freeze([]),assessments:Object.freeze([]),evidence:Object.freeze([]),factors:Object.freeze([]),
  applicability:Object.freeze([]),techniques:Object.freeze([]),barrierDefinitions:Object.freeze([]),
  barrierCriteria:Object.freeze([]),barrierInstances:Object.freeze([]),monitoringLinks:Object.freeze([]),
});
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const label=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=400&&!/[\u0000-\u001f\u007f]/.test(v);
const date=(v:unknown):v is string=>{
  if(typeof v!=="string")return false;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if(!m)return false;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  if(y<1||mo<1||mo>12||d<1||d>days[mo-1]!||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return false;
  if(m[7]!=="Z"&&(Number(m[7]!.slice(1,3))>14||Number(m[7]!.slice(4,6))>59||(Number(m[7]!.slice(1,3))===14&&Number(m[7]!.slice(4,6))!==0)))return false;
  return Number.isFinite(Date.parse(v));
};
const enumerated=<T extends string>(v:unknown,valid:readonly T[]):v is T=>typeof v==="string"&&valid.includes(v as T);
const optionalLabel=(v:Record<string,unknown>,field:string):boolean=>!(field in v)||label(v[field]);
const optionalDate=(v:Record<string,unknown>,field:string):boolean=>!(field in v)||date(v[field]);
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=500&&v.every(label)&&new Set(v).size===v.length;
const record=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k))&&required.every(k=>label(v[k]))&&optional.every(k=>optionalLabel(v,k));
const refs=(arr:readonly string[],set:Set<string>):boolean=>arr.every(id=>set.has(id));
const ids=<T extends {id:string}>(items:readonly T[]):Set<string>=>new Set(items.map(item=>item.id));
const noDuplicates=<T extends {id:string}>(items:readonly T[]):boolean=>ids(items).size===items.length;
const frozenArray=<T>(items:readonly T[]):readonly T[]=>Object.freeze(items.map(item=>Object.freeze({...item})));
const issueResult=(issues:string[]):DegradationParseResult=>Object.freeze({ok:false as const,issues:Object.freeze(issues)});
const make = <T extends {id:string}>(input:unknown,collection:string,limit:number,parse:(v:unknown)=>T|null,issues:string[]):readonly T[]=>{
  if(!Array.isArray(input)||input.length>limit){issues.push(`${collection}: invalid collection or size`);return Object.freeze([]);}
  const result:T[]=[];
  input.forEach((value:unknown,i:number)=>{const parsed=parse(value);if(!parsed)issues.push(`${collection}[${i}]: invalid record`);else result.push(parsed);});
  if(!noDuplicates(result))issues.push(`${collection}: duplicate identity`);
  return frozenArray(result);
};

/** Batch-rejecting validator for tenant-authorized, externally supplied DGM data. */
export function parseDegradationSnapshot(input:unknown):DegradationParseResult {
  const keys=["mechanisms","assessments","evidence","factors","applicability","techniques","barrierDefinitions","barrierCriteria","barrierInstances","monitoringLinks"] as const;
  if(!plain(input)||Object.keys(input).some(k=>!keys.includes(k as typeof keys[number]))||keys.some(k=>!Array.isArray(input[k])))
    return issueResult(["Invalid DGM snapshot structure"]);
  const issues:string[]=[];
  // Parser normalizes into fresh frozen objects: upstream mutations cannot alter rendered data.
  const mechanisms=make(input.mechanisms,"mechanisms",10000,v=>record(v,["id","code","name","category","revision","state","basisReference"],["description"])&&enumerated(v.state,MECHANISM_STATES)?v as MechanismDefinition:null,issues);
  const assessments=make(input.assessments,"assessments",10000,v=>record(v,["id","assetId","revision","state"],["basisReference","assessedAt"])&&enumerated(v.state,ASSESSMENT_STATES)&&optionalDate(v,"assessedAt")&&(v.state!=="APPROVED"||(label(v.basisReference)&&date(v.assessedAt)))?v as DegradationAssessment:null,issues);
  const evidence=make(input.evidence,"evidence",30000,v=>record(v,["id","assessmentId","mechanismId","description","sourceReference","quality"],["observedAt"])&&enumerated(v.quality,EVIDENCE_QUALITIES)&&optionalDate(v,"observedAt")?v as DegradationEvidence:null,issues);
  const factors=make(input.factors,"factors",10000,v=>record(v,["id","mechanismId","label","basisReference"])?v as ApplicabilityFactor:null,issues);
  const applicability=make(input.applicability,"applicability",30000,v=>{
    if(!plain(v)||!strings(v.evidenceIds)||!strings(v.factorIds)||!record(Object.fromEntries(Object.entries(v).filter(([k])=>k!=="evidenceIds"&&k!=="factorIds")),["id","assessmentId","mechanismId","applicability","susceptibility"],["basisReference"])||!enumerated(v.applicability,APPLICABILITY_STATES)||!enumerated(v.susceptibility,SUSCEPTIBILITY_STATES)||((v.applicability!=="UNKNOWN"||v.susceptibility!=="UNKNOWN")&&!label(v.basisReference))||Object.keys(v).some(k=>!["id","assessmentId","mechanismId","applicability","susceptibility","evidenceIds","factorIds","basisReference"].includes(k)))return null;
    return {...v,evidenceIds:Object.freeze([...v.evidenceIds]),factorIds:Object.freeze([...v.factorIds])} as MechanismApplicability;
  },issues);
  const techniques=make(input.techniques,"techniques",10000,v=>record(v,["id","mechanismId","technique","capability","basisReference"])&&enumerated(v.capability,CAPABILITY_STATES)?v as TechniqueCapability:null,issues);
  const barrierDefinitions=make(input.barrierDefinitions,"barrierDefinitions",10000,v=>{
    if(!plain(v)||!strings(v.mechanismIds)||!record(Object.fromEntries(Object.entries(v).filter(([k])=>k!=="mechanismIds")),["id","name","purpose","designBasisReference"])||!enumerated(v.purpose,BARRIER_PURPOSES)||Object.keys(v).some(k=>!["id","name","purpose","designBasisReference","mechanismIds"].includes(k)))return null;
    return {...v,mechanismIds:Object.freeze([...v.mechanismIds])} as BarrierDefinition;
  },issues);
  const barrierCriteria=make(input.barrierCriteria,"barrierCriteria",10000,v=>record(v,["id","definitionId","indicator","acceptanceCriterion","basisReference"])?v as BarrierCriterion:null,issues);
  const barrierInstances=make(input.barrierInstances,"barrierInstances",30000,v=>record(v,["id","assessmentId","definitionId","health"],["assessmentBasisReference"])&&enumerated(v.health,BARRIER_HEALTH_STATES)&&(v.health==="UNKNOWN"||label(v.assessmentBasisReference))?v as BarrierInstance:null,issues);
  const monitoringLinks=make(input.monitoringLinks,"monitoringLinks",30000,v=>record(v,["id","assessmentId","mechanismId","sourceDomain","sourceObjectId","sourceReference"])&&enumerated(v.sourceDomain,MONITORING_DOMAINS)?v as MonitoringLink:null,issues);
  const ms=ids(mechanisms),as=ids(assessments),es=ids(evidence),fs=ids(factors),bs=ids(barrierDefinitions);
  const evidenceById=new Map(evidence.map(e=>[e.id,e]));const factorsById=new Map(factors.map(f=>[f.id,f]));
  const fail=(condition:boolean,collection:string)=>{if(condition)issues.push(`${collection}: unresolved or inconsistent reference`);};
  for(const e of evidence)fail(!ms.has(e.mechanismId)||!as.has(e.assessmentId),"evidence");
  for(const f of factors)fail(!ms.has(f.mechanismId),"factors");
  for(const a of applicability){
    fail(!ms.has(a.mechanismId)||!as.has(a.assessmentId)||!refs(a.evidenceIds,es)||!refs(a.factorIds,fs),"applicability");
    fail(a.evidenceIds.some(id=>{const entry=evidenceById.get(id);return entry?.assessmentId!==a.assessmentId||entry?.mechanismId!==a.mechanismId;}) || a.factorIds.some(id=>factorsById.get(id)?.mechanismId!==a.mechanismId),"applicability");
  }
  for(const t of techniques)fail(!ms.has(t.mechanismId),"techniques");
  for(const b of barrierDefinitions)fail(!refs(b.mechanismIds,ms),"barrierDefinitions");
  for(const c of barrierCriteria)fail(!bs.has(c.definitionId),"barrierCriteria");
  for(const b of barrierInstances)fail(!bs.has(b.definitionId)||!as.has(b.assessmentId),"barrierInstances");
  for(const link of monitoringLinks)fail(!ms.has(link.mechanismId)||!as.has(link.assessmentId),"monitoringLinks");
  if(new Set(mechanisms.map(m=>m.code.toLocaleLowerCase())).size!==mechanisms.length)issues.push("mechanisms: duplicate code");
  if(new Set(applicability.map(a=>`${a.assessmentId}\u0000${a.mechanismId}`)).size!==applicability.length)issues.push("applicability: duplicate assessment/mechanism pair");
  if(issues.length)return issueResult(issues.slice(0,50));
  return Object.freeze({ok:true as const,snapshot:Object.freeze({mechanisms,assessments,evidence,factors,applicability,techniques,barrierDefinitions,barrierCriteria,barrierInstances,monitoringLinks})});
}

export type MechanismFilters=Readonly<{search:string;state:MechanismState|"ALL";category:string}>;
export function filterMechanisms(data:readonly MechanismDefinition[],filters:MechanismFilters):readonly MechanismDefinition[]{
  const terms=filters.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return data.filter(m=>(filters.state==="ALL"||m.state===filters.state)&&(filters.category==="ALL"||m.category===filters.category)&&
    terms.every(t=>[m.code,m.name,m.category,m.description??"",m.basisReference].join(" ").toLocaleLowerCase().includes(t)))
    .sort((a,b)=>a.code.localeCompare(b.code)||a.id.localeCompare(b.id));
}
export type AssessmentContext=Readonly<{
  assessment:DegradationAssessment; applicability:readonly MechanismApplicability[];evidence:readonly DegradationEvidence[];
  barrierInstances:readonly BarrierInstance[];monitoringLinks:readonly MonitoringLink[];
}>;
export function getAssessmentContext(snapshot:DegradationSnapshot,id:string):AssessmentContext|null {
  const assessment=snapshot.assessments.find(a=>a.id===id);if(!assessment)return null;
  return {assessment,applicability:snapshot.applicability.filter(a=>a.assessmentId===id),evidence:snapshot.evidence.filter(e=>e.assessmentId===id),barrierInstances:snapshot.barrierInstances.filter(b=>b.assessmentId===id),monitoringLinks:snapshot.monitoringLinks.filter(m=>m.assessmentId===id)};
}
