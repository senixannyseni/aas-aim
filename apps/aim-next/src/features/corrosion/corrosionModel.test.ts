import {describe,expect,it} from "vitest";
import {corrosionCircuitReadings,filterCorrosionCircuits,parseCorrosionSnapshot,stageThicknessCsv,EMPTY_CORROSION} from "./corrosionModel";

const AT="2026-01-15T09:00:00Z";
const LATER="2026-09-15T09:00:00Z";
const fixture=()=>({
  loops:[{id:"loop-1",name:"Test process loop",systemReference:"SYS-TEST",assetId:"asset-1",basisReference:"loop-source"}],
  circuits:[{id:"c-1",loopId:"loop-1",code:"TEST-C01",name:"Test circuit",assetId:"asset-1",revision:"1",state:"ACTIVE"}],
  locations:[{id:"loc-1",circuitId:"c-1",tag:"TML-TEST",componentReference:"comp-1",kind:"TML",sourceReference:"location-source"}],
  points:[{id:"point-1",locationId:"loc-1",tag:"12 o'clock",orientation:"TOP"}],
  sets:[{id:"set-1",circuitId:"c-1",reference:"workpack-test",measuredAt:AT,state:"VALIDATED"}],
  readings:[{id:"reading-1",setId:"set-1",pointId:"point-1",measuredAt:AT,thicknessMm:9.5,quality:"VALID",sourceReference:"reading-source"}],
  anomalies:[{id:"anom-1",readingId:"reading-1",description:"Test anomaly",disposition:"OPEN"}],
  tmins:[{id:"tmin-1",circuitId:"c-1",revision:"2",thicknessMm:6.4,status:"ACTIVE",basisReference:"tmin-basis",effectiveAt:AT}],
  calculations:[{id:"calc-1",circuitId:"c-1",revision:"2",status:"APPROVED",basisReference:"calc-source",inputReadingIds:["reading-1"],traceReference:"calc-trace",calculatedAt:AT,approvedAt:LATER,remainingLifeYears:8.5,dueCandidateAt:LATER}],
  rates:[{id:"rate-1",calculationId:"calc-1",method:"LONG_TERM",rateMmPerYear:0.12,basisReference:"rate-basis"}],
});
const accepted=()=>{const result=parseCorrosionSnapshot(fixture());if(!result.ok)throw new Error(`Fixture rejected: ${result.issues.join("/")}`);return result.snapshot;};
const changed=(key:keyof ReturnType<typeof fixture>,value:unknown)=>({...fixture(),[key]:value});
const bad=(key:keyof ReturnType<typeof fixture>,record:Record<string,unknown>)=>parseCorrosionSnapshot(changed(key,[record]));
const row=(key:keyof ReturnType<typeof fixture>)=>fixture()[key][0]! as Record<string,unknown>;

describe("COR: complete authorized snapshot boundary",()=>{
  it("accepts and freezes a complete valid externally supplied snapshot",()=>{const r=parseCorrosionSnapshot(fixture());expect(r.ok).toBe(true);if(r.ok){expect(Object.isFrozen(r.snapshot)).toBe(true);expect(Object.isFrozen(r.snapshot.calculations[0]?.inputReadingIds)).toBe(true);expect(Object.isFrozen(r.snapshot.readings[0])).toBe(true);}});
  it("accepts a complete empty snapshot, without inventing readings",()=>{const r=parseCorrosionSnapshot(Object.fromEntries(Object.keys(EMPTY_CORROSION).map(k=>[k,[]])));expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.calculations).toHaveLength(0);});
  for(const v of [null,undefined,[],"data",1])it(`rejects non-object payload ${String(v)}`,()=>expect(parseCorrosionSnapshot(v).ok).toBe(false));
  it("rejects missing collections",()=>{const f=fixture();const {rates:ignored,...rest}=f;expect(ignored).toHaveLength(1);expect(parseCorrosionSnapshot(rest).ok).toBe(false);});
  it("rejects unexpected top-level collections",()=>expect(parseCorrosionSnapshot({...fixture(),privateField:"secret"}).ok).toBe(false));
  for(const key of Object.keys(fixture()) as (keyof ReturnType<typeof fixture>)[]) {
    it(`rejects malformed ${key} records`,()=>expect(bad(key,{id:"only-an-id"}).ok).toBe(false));
    it(`rejects duplicate ${key} record IDs`,()=>{const f=fixture();expect(parseCorrosionSnapshot(changed(key,[...f[key],...f[key]])).ok).toBe(false);});
    it(`rejects unrecognized ${key} properties`,()=>expect(bad(key,{...row(key),secret:"credential"}).ok).toBe(false));
  }
  it("rejects circuits linked to missing loops",()=>expect(bad("circuits",{...row("circuits"),loopId:"missing"}).ok).toBe(false));
  it("rejects a circuit attached to a loop for a different asset",()=>expect(bad("circuits",{...row("circuits"),assetId:"other-asset"}).ok).toBe(false));
  it("rejects locations linked to missing circuits",()=>expect(bad("locations",{...row("locations"),circuitId:"other"}).ok).toBe(false));
  it("rejects points linked to missing locations",()=>expect(bad("points",{...row("points"),locationId:"other"}).ok).toBe(false));
  it("rejects reading whose point belongs to a different circuit",()=>{const f=fixture();f.circuits.push({id:"c-2",loopId:"loop-1",code:"TEST-C02",name:"Other",assetId:"asset-1",revision:"1",state:"ACTIVE"});f.locations.push({id:"loc-2",circuitId:"c-2",tag:"TML-02",componentReference:"comp-2",kind:"TML",sourceReference:"location-2"});f.points.push({id:"point-2",locationId:"loc-2",tag:"side",orientation:"SIDE"});f.readings[0]!.pointId="point-2";expect(parseCorrosionSnapshot(f).ok).toBe(false);});
  it("rejects anomaly reference to missing measurement",()=>expect(bad("anomalies",{...row("anomalies"),readingId:"absent"}).ok).toBe(false));
  it("requires a technical basis for disposition",()=>expect(bad("anomalies",{...row("anomalies"),disposition:"ACCEPTED"}).ok).toBe(false));
  it("accepts technically referenced anomaly disposition",()=>expect(bad("anomalies",{...row("anomalies"),disposition:"REMEASURE",basisReference:"review-record"}).ok).toBe(true));
  it("rejects impossible reading dates",()=>expect(bad("readings",{...row("readings"),measuredAt:"2026-02-30T09:00:00Z"}).ok).toBe(false));
  for(const value of [0,-2,NaN,Infinity,undefined,"10"]){it(`rejects thickness value ${String(value)}`,()=>expect(bad("readings",{...row("readings"),thicknessMm:value}).ok).toBe(false));}
  it("keeps UNKNOWN reading quality explicit",()=>{const r=bad("readings",{...row("readings"),quality:"UNKNOWN"});expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.readings[0]?.quality).toBe("UNKNOWN");});
  it("does not treat SUSPECT as VALID",()=>{const r=bad("readings",{...row("readings"),quality:"SUSPECT"});expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.readings[0]?.quality).toBe("SUSPECT");});
  it("rejects a missing Tmin engineering basis",()=>expect(bad("tmins",{...row("tmins"),basisReference:""}).ok).toBe(false));
  it("rejects ACTIVE Tmin without effective timestamp",()=>{const {effectiveAt:ignored,...rest}=row("tmins");expect(ignored).toBe(AT);expect(bad("tmins",rest).ok).toBe(false);});
  it("allows a draft Tmin without effective timestamp",()=>{const {effectiveAt:ignored,...rest}=row("tmins");expect(ignored).toBe(AT);expect(bad("tmins",{...rest,status:"DRAFT"}).ok).toBe(true);});
  it("rejects approved calculation without approval timestamp",()=>{const {approvedAt:ignored,...rest}=row("calculations");expect(ignored).toBe(LATER);expect(bad("calculations",rest).ok).toBe(false);});
  it("accepts in-review calculation without approval timestamp",()=>{const {approvedAt:ignored,...rest}=row("calculations");expect(ignored).toBe(LATER);expect(bad("calculations",{...rest,status:"IN_REVIEW"}).ok).toBe(true);});
  it("rejects duplicate input readings",()=>expect(bad("calculations",{...row("calculations"),inputReadingIds:["reading-1","reading-1"]}).ok).toBe(false));
  it("rejects unknown source input readings",()=>expect(bad("calculations",{...row("calculations"),inputReadingIds:["missing"]}).ok).toBe(false));
  it("rejects invalid corrosion rates",()=>expect(bad("rates",{...row("rates"),rateMmPerYear:-0.1}).ok).toBe(false));
  it("accepts a zero rate only when explicitly supplied with technical basis",()=>{const r=bad("rates",{...row("rates"),rateMmPerYear:0});expect(r.ok).toBe(true);if(r.ok)expect(r.snapshot.rates[0]?.rateMmPerYear).toBe(0);});
  it("rejects noncanonical rate methods",()=>expect(bad("rates",{...row("rates"),method:"PREDICTED_BEST"}).ok).toBe(false));
  it("does not fabricate due-candidate timestamps or rates",()=>{const f=fixture();f.rates=[];const {dueCandidateAt:ignored,...rest}=row("calculations");expect(ignored).toBe(LATER);f.calculations=[rest] as typeof f.calculations;const r=parseCorrosionSnapshot(f);expect(r.ok).toBe(true);if(r.ok){expect(r.snapshot.rates).toHaveLength(0);expect(r.snapshot.calculations[0]?.dueCandidateAt).toBeUndefined();}});
  it("never freezes caller-owned mutable objects",()=>{const f=fixture();const r=parseCorrosionSnapshot(f);expect(r.ok).toBe(true);if(r.ok){f.circuits[0]!.name="Caller change";f.calculations[0]!.inputReadingIds.push("caller-reading");expect(r.snapshot.circuits[0]?.name).toBe("Test circuit");expect(r.snapshot.calculations[0]?.inputReadingIds).toEqual(["reading-1"]);}});
  it("does not echo rejected untrusted values in issues",()=>{const token="SECRET-EXAMPLE-BEARER";const r=bad("readings",{...row("readings"),quality:token});expect(r.ok).toBe(false);if(!r.ok)expect(r.issues.join("|")).not.toContain(token);});
});

describe("COR: presentation-only helpers",()=>{
  it("filters supplied circuits by ID, tag and state",()=>{const circuits=accepted().circuits;expect(filterCorrosionCircuits(circuits,{search:"test-c01",state:"ACTIVE"})).toHaveLength(1);expect(filterCorrosionCircuits(circuits,{search:"test-c01",state:"RETIRED"})).toHaveLength(0);});
  it("returns only a circuit's recorded readings",()=>{const s=accepted();expect(corrosionCircuitReadings(s,"c-1").map(r=>r.id)).toEqual(["reading-1"]);expect(corrosionCircuitReadings(s,"missing")).toHaveLength(0);});
  it("sorts reading chronologies without changing the source",()=>{const f=fixture();f.readings.unshift({...f.readings[0]!,id:"reading-early",measuredAt:"2025-01-15T09:00:00Z"});const r=parseCorrosionSnapshot(f);expect(r.ok).toBe(true);if(r.ok)expect(corrosionCircuitReadings(r.snapshot,"c-1").map(x=>x.id)).toEqual(["reading-early","reading-1"]);});
});

describe("COR: CSV measurement staging, never persistence",()=>{
  const csv=`pointId,setId,measuredAt,thicknessMm,sourceReference\npoint-1,set-1,${AT},9.5,test-csv-basis`;
  it("accepts a source-matched preview with explicit mm unit",()=>{const r=stageThicknessCsv(csv,accepted());expect(r.ok).toBe(true);if(r.ok)expect(r.rows[0]?.thicknessMm).toBe(9.5);});
  it("empty template stages zero rows without importing",()=>{const r=stageThicknessCsv("pointId,setId,measuredAt,thicknessMm,sourceReference",accepted());expect(r.ok).toBe(true);if(r.ok)expect(r.rows).toHaveLength(0);});
  it("rejects incorrect CSV headings",()=>expect(stageThicknessCsv("asset,thickness",accepted()).ok).toBe(false));
  it("rejects unrecognized measurement point",()=>expect(stageThicknessCsv(csv.replace("point-1","invalid-point"),accepted()).ok).toBe(false));
  it("rejects unrecognized measurement set",()=>expect(stageThicknessCsv(csv.replace("set-1","invalid-set"),accepted()).ok).toBe(false));
  it("rejects staged duplicate rows as an entire batch",()=>expect(stageThicknessCsv(`${csv}\n${csv.split("\n")[1]}`,accepted()).ok).toBe(false));
  it("rejects rows with an invalid thickness",()=>expect(stageThicknessCsv(csv.replace(",9.5,",",-9.5,"),accepted()).ok).toBe(false));
  it("rejects rows with an invalid calendar date",()=>expect(stageThicknessCsv(csv.replace(AT,"2026-02-30T09:00:00Z"),accepted()).ok).toBe(false));
  it("rejects malformed CSV quotes",()=>expect(stageThicknessCsv(csv.replace("test-csv-basis",'"broken'),accepted()).ok).toBe(false));
  it("rejects non-number thickness such as NaN and Infinity",()=>{expect(stageThicknessCsv(csv.replace(",9.5,",",NaN,"),accepted()).ok).toBe(false);expect(stageThicknessCsv(csv.replace(",9.5,",",Infinity,"),accepted()).ok).toBe(false);});
  it("accepts quoted source references without changing the source value",()=>{const r=stageThicknessCsv(csv.replace("test-csv-basis",'"test, source"'),accepted());expect(r.ok).toBe(true);if(r.ok)expect(r.rows[0]?.sourceReference).toBe("test, source");});
  it("rejects payload exceeding maximum size",()=>expect(stageThicknessCsv("x".repeat(250001),accepted()).ok).toBe(false));
  it("keeps the input/source unmodified and output frozen",()=>{const s=accepted(),r=stageThicknessCsv(csv,s);expect(r.ok).toBe(true);if(r.ok){expect(Object.isFrozen(r.rows)).toBe(true);expect(Object.isFrozen(r.rows[0])).toBe(true);}expect(s.readings).toHaveLength(1);});
});
