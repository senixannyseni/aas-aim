/**
 * Future AIM / COR presentation boundary, mapped to COR-001..022.
 * All engineering results are supplied by an external owning-domain service.
 * No corrosion rate, remaining life, Tmin or due date is computed in the browser.
 */
export const CIRCUIT_STATES = ["ACTIVE", "INACTIVE", "RETIRED"] as const;
export const LOCATION_KINDS = ["CML", "TML"] as const;
export const MEASUREMENT_STATES = ["DRAFT", "VALIDATED", "REJECTED"] as const;
export const READING_QUALITIES = ["VALID", "SUSPECT", "REJECTED", "UNKNOWN"] as const;
export const ANOMALY_STATES = ["OPEN", "ACCEPTED", "REJECTED", "REMEASURE"] as const;
export const CALCULATION_STATES = ["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED"] as const;
export const TMIN_STATES = ["DRAFT", "ACTIVE", "SUPERSEDED"] as const;
export const RATE_METHODS = ["LONG_TERM", "SHORT_TERM", "REGRESSION", "GOVERNING", "ASSUMED", "CIRCUIT_AGGREGATE"] as const;
export type CircuitState = typeof CIRCUIT_STATES[number];
export type ReadingQuality = typeof READING_QUALITIES[number];
export type CalculationState = typeof CALCULATION_STATES[number];
export type RateMethod = typeof RATE_METHODS[number];
export type CorrosionLoop = Readonly<{id:string;name:string;systemReference:string;assetId:string;basisReference:string}>;
export type CorrosionCircuit = Readonly<{id:string;loopId:string;code:string;name:string;assetId:string;revision:string;state:CircuitState}>;
export type MonitoringLocation = Readonly<{id:string;circuitId:string;tag:string;componentReference:string;kind:typeof LOCATION_KINDS[number];sourceReference:string}>;
export type MeasurementPoint = Readonly<{id:string;locationId:string;tag:string;orientation:string}>;
export type ThicknessMeasurementSet = Readonly<{id:string;circuitId:string;reference:string;measuredAt:string;state:typeof MEASUREMENT_STATES[number]}>;
export type ThicknessReading = Readonly<{id:string;setId:string;pointId:string;measuredAt:string;thicknessMm:number;quality:ReadingQuality;sourceReference:string}>;
export type MeasurementAnomaly = Readonly<{id:string;readingId:string;description:string;disposition:typeof ANOMALY_STATES[number];basisReference?:string}>;
export type MinimumRequiredThickness = Readonly<{id:string;circuitId:string;revision:string;thicknessMm:number;status:typeof TMIN_STATES[number];basisReference:string;effectiveAt?:string}>;
export type CorrosionRateResult = Readonly<{id:string;calculationId:string;method:RateMethod;rateMmPerYear:number;basisReference:string}>;
export type CorrosionCalculationSet = Readonly<{id:string;circuitId:string;revision:string;status:CalculationState;basisReference:string;inputReadingIds:readonly string[];traceReference:string;calculatedAt:string;approvedAt?:string;remainingLifeYears?:number;dueCandidateAt?:string}>;
export type CorrosionSnapshot = Readonly<{
  loops:readonly CorrosionLoop[]; circuits:readonly CorrosionCircuit[]; locations:readonly MonitoringLocation[];
  points:readonly MeasurementPoint[]; sets:readonly ThicknessMeasurementSet[]; readings:readonly ThicknessReading[];
  anomalies:readonly MeasurementAnomaly[]; tmins:readonly MinimumRequiredThickness[];
  calculations:readonly CorrosionCalculationSet[]; rates:readonly CorrosionRateResult[];
}>;
export type CorrosionParseResult = Readonly<{ok:true;snapshot:CorrosionSnapshot}> | Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_CORROSION:CorrosionSnapshot = Object.freeze({
  loops:Object.freeze([]),circuits:Object.freeze([]),locations:Object.freeze([]),points:Object.freeze([]),
  sets:Object.freeze([]),readings:Object.freeze([]),anomalies:Object.freeze([]),tmins:Object.freeze([]),
  calculations:Object.freeze([]),rates:Object.freeze([]),
});
const KEYS = ["loops","circuits","locations","points","sets","readings","anomalies","tmins","calculations","rates"] as const;
const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const text=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=400&&!/[\u0000-\u001f\u007f]/.test(v);
const precise=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>0&&v<=1e9;
const nonnegative=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1e9;
const enumeration=<T extends string>(v:unknown,values:readonly T[]):v is T=>typeof v==="string"&&values.includes(v as T);
const iso=(v:unknown):v is string=>{
  if(typeof v!=="string")return false;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if(!m)return false;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  const monthDays=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  const zone=m[7]!;
  return year>0&&month>=1&&month<=12&&day>=1&&day<=monthDays[month-1]!&&Number(m[4])<=23&&Number(m[5])<=59&&Number(m[6])<=59&&(zone==="Z"||(Number(zone.slice(1,3))<=14&&Number(zone.slice(4,6))<=59&&(Number(zone.slice(1,3))!==14||Number(zone.slice(4,6))===0)))&&Number.isFinite(Date.parse(v));
};
const fields=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const allText=(v:Record<string,unknown>,names:readonly string[])=>names.every(k=>text(v[k]));
const idsArray=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=5000&&v.every(text)&&new Set(v).size===v.length;
const frozen=<T extends {id:string}>(items:T[]):readonly T[]=>Object.freeze(items.map(v=>Object.freeze({...v})));
const fail=(issues:string[]):CorrosionParseResult=>Object.freeze({ok:false as const,issues:Object.freeze(issues)});
const collection=<T extends {id:string}>(value:unknown,key:string,parse:(item:unknown)=>T|null,issues:string[]):readonly T[]=>{
  if(!Array.isArray(value)||value.length>30000){issues.push(`${key}: invalid collection`);return Object.freeze([]);}
  const result:T[]=[];
  value.forEach((v,i)=>{const row=parse(v);if(row)result.push(row);else issues.push(`${key}[${i}]: invalid record`);});
  if(new Set(result.map(r=>r.id)).size!==result.length)issues.push(`${key}: duplicate identity`);
  return frozen(result);
};
const setOf=<T extends {id:string}>(items:readonly T[])=>new Set(items.map(x=>x.id));
const cross=(condition:boolean,area:string,issues:string[])=>{if(!condition)issues.push(`${area}: inconsistent references`);};
/** Rejects the *whole* externally supplied snapshot on structural or cross-object errors. */
export function parseCorrosionSnapshot(input:unknown):CorrosionParseResult {
  if(!plain(input)||Object.keys(input).some(k=>!KEYS.includes(k as typeof KEYS[number]))||KEYS.some(k=>!Array.isArray(input[k])))return fail(["Invalid COR snapshot structure"]);
  const issues:string[]=[];
  const loops=collection(input.loops,"loops",v=>fields(v,["id","name","systemReference","assetId","basisReference"])&&allText(v,["id","name","systemReference","assetId","basisReference"])?v as CorrosionLoop:null,issues);
  const circuits=collection(input.circuits,"circuits",v=>fields(v,["id","loopId","code","name","assetId","revision","state"])&&allText(v,["id","loopId","code","name","assetId","revision"])&&enumeration(v.state,CIRCUIT_STATES)?v as CorrosionCircuit:null,issues);
  const locations=collection(input.locations,"locations",v=>fields(v,["id","circuitId","tag","componentReference","kind","sourceReference"])&&allText(v,["id","circuitId","tag","componentReference","sourceReference"])&&enumeration(v.kind,LOCATION_KINDS)?v as MonitoringLocation:null,issues);
  const points=collection(input.points,"points",v=>fields(v,["id","locationId","tag","orientation"])&&allText(v,["id","locationId","tag","orientation"])?v as MeasurementPoint:null,issues);
  const sets=collection(input.sets,"sets",v=>fields(v,["id","circuitId","reference","measuredAt","state"])&&allText(v,["id","circuitId","reference"])&&iso(v.measuredAt)&&enumeration(v.state,MEASUREMENT_STATES)?v as ThicknessMeasurementSet:null,issues);
  const readings=collection(input.readings,"readings",v=>fields(v,["id","setId","pointId","measuredAt","thicknessMm","quality","sourceReference"])&&allText(v,["id","setId","pointId","sourceReference"])&&iso(v.measuredAt)&&precise(v.thicknessMm)&&enumeration(v.quality,READING_QUALITIES)?v as ThicknessReading:null,issues);
  const anomalies=collection(input.anomalies,"anomalies",v=>fields(v,["id","readingId","description","disposition"],["basisReference"])&&allText(v,["id","readingId","description"])&&enumeration(v.disposition,ANOMALY_STATES)&&(!("basisReference" in v)||text(v.basisReference))&&(v.disposition==="OPEN"||text(v.basisReference))?v as MeasurementAnomaly:null,issues);
  const tmins=collection(input.tmins,"tmins",v=>fields(v,["id","circuitId","revision","thicknessMm","status","basisReference"],["effectiveAt"])&&allText(v,["id","circuitId","revision","basisReference"])&&precise(v.thicknessMm)&&enumeration(v.status,TMIN_STATES)&&(!("effectiveAt" in v)||iso(v.effectiveAt))&&(v.status!=="ACTIVE"||iso(v.effectiveAt))?v as MinimumRequiredThickness:null,issues);
  const calculations=collection(input.calculations,"calculations",v=>{
    if(!fields(v,["id","circuitId","revision","status","basisReference","inputReadingIds","traceReference","calculatedAt"],["approvedAt","remainingLifeYears","dueCandidateAt"])||!allText(v,["id","circuitId","revision","basisReference","traceReference"])||!enumeration(v.status,CALCULATION_STATES)||!idsArray(v.inputReadingIds)||!iso(v.calculatedAt)||("approvedAt" in v&&!iso(v.approvedAt))||("dueCandidateAt" in v&&!iso(v.dueCandidateAt))||("remainingLifeYears" in v&&!nonnegative(v.remainingLifeYears))||(v.status==="APPROVED"&&!iso(v.approvedAt)))return null;
    return {...v,inputReadingIds:Object.freeze([...v.inputReadingIds])} as CorrosionCalculationSet;
  },issues);
  const rates=collection(input.rates,"rates",v=>fields(v,["id","calculationId","method","rateMmPerYear","basisReference"])&&allText(v,["id","calculationId","basisReference"])&&enumeration(v.method,RATE_METHODS)&&nonnegative(v.rateMmPerYear)?v as CorrosionRateResult:null,issues);
  const loopIds=setOf(loops),circuitIds=setOf(circuits),locationIds=setOf(locations),pointIds=setOf(points),setIds=setOf(sets),readingIds=setOf(readings),calcIds=setOf(calculations);
  const byLocation=new Map(locations.map(l=>[l.id,l]));const byPoint=new Map(points.map(p=>[p.id,p]));const bySet=new Map(sets.map(s=>[s.id,s]));const byReading=new Map(readings.map(r=>[r.id,r]));
  circuits.forEach(c=>cross(loopIds.has(c.loopId)&&loops.find(l=>l.id===c.loopId)?.assetId===c.assetId,"circuits",issues));
  locations.forEach(l=>cross(circuitIds.has(l.circuitId),"locations",issues));
  points.forEach(p=>cross(locationIds.has(p.locationId),"points",issues));
  sets.forEach(s=>cross(circuitIds.has(s.circuitId),"sets",issues));
  readings.forEach(r=>{const set=bySet.get(r.setId),location=byLocation.get(byPoint.get(r.pointId)?.locationId??"");cross(setIds.has(r.setId)&&pointIds.has(r.pointId)&&set?.circuitId===location?.circuitId&&!!location,"readings",issues);});
  anomalies.forEach(a=>cross(readingIds.has(a.readingId),"anomalies",issues));
  tmins.forEach(t=>cross(circuitIds.has(t.circuitId),"tmins",issues));
  calculations.forEach(c=>cross(circuitIds.has(c.circuitId)&&c.inputReadingIds.every(id=>{const r=byReading.get(id),s=bySet.get(r?.setId??"");return !!r&&s?.circuitId===c.circuitId;}),"calculations",issues));
  rates.forEach(r=>cross(calcIds.has(r.calculationId),"rates",issues));
  // No implicit "best" or "governing" rate and no inferred due date.
  if(issues.length)return fail(issues);
  return Object.freeze({ok:true as const,snapshot:Object.freeze({loops,circuits,locations,points,sets,readings,anomalies,tmins,calculations,rates})});
}
export function filterCorrosionCircuits(circuits:readonly CorrosionCircuit[],options:{search:string;state:CircuitState|"ALL"}):readonly CorrosionCircuit[] {
  const terms=options.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return circuits.filter(c=>(options.state==="ALL"||options.state===c.state)&&terms.every(t=>`${c.code} ${c.name} ${c.assetId} ${c.id}`.toLocaleLowerCase().includes(t)));
}
export function corrosionCircuitReadings(snapshot:CorrosionSnapshot,circuitId:string):readonly ThicknessReading[] {
  const setIds=new Set(snapshot.sets.filter(s=>s.circuitId===circuitId).map(s=>s.id));
  return snapshot.readings.filter(r=>setIds.has(r.setId)).sort((a,b)=>a.measuredAt.localeCompare(b.measuredAt)||a.id.localeCompare(b.id));
}
export type StagedThicknessRow=Readonly<{line:number;pointId:string;setId:string;measuredAt:string;thicknessMm:number;sourceReference:string}>;
export type ThicknessStageResult=Readonly<{ok:true;rows:readonly StagedThicknessRow[]}>|Readonly<{ok:false;issues:readonly string[]}>;
function csvCells(line:string):string[]|null {
  const out:string[]=[];let field="",quoted=false,started=false,closed=false;
  for(let i=0;i<line.length;i++){const c=line[i]!;
    if(quoted){if(c==='"'&&line[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else field+=c;}
    else if(c===',' ){out.push(field.trim());field="";started=false;closed=false;}
    else if(c==='"'&&!started&&!closed){quoted=true;started=true;}
    else if(c==='"'||closed)return null;
    else {field+=c;started=true;}
  }
  if(quoted)return null;out.push(field.trim());return out;
}
/** Local read-only CSV staging: NEVER imports, approves or validates measurements authoritatively. */
export function stageThicknessCsv(csv:string,snapshot:CorrosionSnapshot):ThicknessStageResult {
  if(typeof csv!=="string"||csv.length>250000)return Object.freeze({ok:false as const,issues:Object.freeze(["CSV payload is too large or invalid"])});
  const lines=csv.replace(/^\uFEFF/,"").split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length===0)return Object.freeze({ok:false as const,issues:Object.freeze(["CSV input is empty"])});
  const expected=["pointId","setId","measuredAt","thicknessMm","sourceReference"];
  if(JSON.stringify(csvCells(lines[0]!))!==JSON.stringify(expected))return Object.freeze({ok:false as const,issues:Object.freeze(["CSV headers must be pointId,setId,measuredAt,thicknessMm,sourceReference"])});
  if(lines.length>1001)return Object.freeze({ok:false as const,issues:Object.freeze(["CSV exceeds 1,000 staged rows"])});
  const byPoint=new Map(snapshot.points.map(p=>[p.id,p]));const byLocation=new Map(snapshot.locations.map(l=>[l.id,l]));const bySet=new Map(snapshot.sets.map(s=>[s.id,s]));
  const rows:StagedThicknessRow[]=[],issues:string[]=[],unique=new Set<string>();
  lines.slice(1).forEach((line,i)=>{
    const cells=csvCells(line),n=cells&&Number(cells[3]);
    if(!cells||cells.length!==5||!cells.slice(0,3).every(text)||!text(cells[4])||!iso(cells[2])||!precise(n)||!/^\d+(?:\.\d+)?$/.test(cells[3]!)){issues.push(`Row ${i+2}: invalid measurement fields`);return;}
    const [pointId,setId,measuredAt,,sourceReference]=cells as [string,string,string,string,string];
    const point=byPoint.get(pointId),set=bySet.get(setId),location=byLocation.get(point?.locationId??"");
    if(!point||!set||!location||location.circuitId!==set.circuitId){issues.push(`Row ${i+2}: unresolved or mismatched measurement context`);return;}
    const key=`${setId}\0${pointId}\0${measuredAt}`;
    if(unique.has(key)){issues.push(`Row ${i+2}: duplicate staged measurement`);return;}unique.add(key);
    rows.push(Object.freeze({line:i+2,pointId,setId,measuredAt,thicknessMm:n!,sourceReference}));
  });
  if(issues.length)return Object.freeze({ok:false as const,issues:Object.freeze(issues)});
  return Object.freeze({ok:true as const,rows:Object.freeze(rows)});
}
