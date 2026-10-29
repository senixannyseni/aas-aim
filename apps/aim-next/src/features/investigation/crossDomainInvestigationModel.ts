/**
 * Phase 46.4: source-bound, read-only cross-domain navigation projection.
 * The UI does not grant cross-domain authorization. A trusted upstream must
 * attest one navigation scope, and separately supply authorized AIR/COR/INS
 * snapshots and their independent scope-rotation keys.
 *
 * Matching assetId is an association inside ALREADY authorized source data;
 * it is not a cross-domain permission check or an engineering conclusion.
 */
import {parseAssetSnapshot, type AssetRecord} from "../assets/assetModel";
import {parseCorrosionSnapshot, type CorrosionSnapshot} from "../corrosion/corrosionModel";
import {parseInspectionSnapshot, type InspectionSnapshot} from "../inspection/inspectionModel";
import {indexCorrosionEvidence,indexInspectionEvidence,type EvidenceIndex} from "./engineeringEvidenceModel";

export type InvestigationSourceState = "disconnected" | "rejected" | "ready";
export type CorrosionContext = Readonly<{
  id:string; code:string; name:string; revision:string; state:string;
  loopBasis:string; locationCount:number; recordedReadings:number;
  calculationReferences:readonly Readonly<{id:string;revision:string;status:string;basisReference:string}>[];
}>;
export type InspectionContext = Readonly<{
  id:string; code:string; revision:string; status:string; basisReference:string;
  governingTechnicalDueAt:string|null; governingBasis:string|null;
  dueCandidates:readonly Readonly<{id:string;source:string;dueAt:string;basisReference:string}>[];
  eventCount:number; reviewedCreditCount:number;
}>;
export type CrossDomainContext = Readonly<{
  asset:AssetRecord;
  corrosion:Readonly<{state:InvestigationSourceState;records:readonly CorrosionContext[]}>;
  inspection:Readonly<{state:InvestigationSourceState;records:readonly InspectionContext[]}>;
  evidence:Readonly<{corrosion:EvidenceIndex;inspection:EvidenceIndex}>;
}>;
export type CrossDomainOutcome =
  Readonly<{kind:"disabled"}> | Readonly<{kind:"rejected"}> | Readonly<{kind:"unselected"}> |
  Readonly<{kind:"ready";context:CrossDomainContext}>;
export type CrossDomainInput = Readonly<{
  navigationScopeKey?:string|undefined;
  /** An explicit upstream attestation for THIS navigation epoch, not a local comparison of tenant IDs. */
  crossDomainScopeKey?:string|undefined;
  assetScopeKey?:string|undefined;
  corrosionScopeKey?:string|undefined;
  inspectionScopeKey?:string|undefined;
  assetSnapshot?:unknown;
  corrosionSnapshot?:unknown;
  inspectionSnapshot?:unknown;
  selectedAssetId?:string|undefined;
}>;
function corrosionFor(assetId:string,snapshot:CorrosionSnapshot):readonly CorrosionContext[]{
  const loops=new Map(snapshot.loops.map(l=>[l.id,l]));
  const locationCounts=new Map<string,number>();
  for(const location of snapshot.locations)locationCounts.set(location.circuitId,(locationCounts.get(location.circuitId)??0)+1);
  const circuitForSet=new Map(snapshot.sets.map(s=>[s.id,s.circuitId]));
  const readingsByCircuit=new Map<string,number>();
  for(const reading of snapshot.readings){const id=circuitForSet.get(reading.setId);
    if(id)readingsByCircuit.set(id,(readingsByCircuit.get(id)??0)+1);}
  const calculationsByCircuit=new Map<string,{id:string;revision:string;status:string;basisReference:string}[]>();
  for(const x of snapshot.calculations){const rows=calculationsByCircuit.get(x.circuitId)??[];
    rows.push(Object.freeze({id:x.id,revision:x.revision,status:x.status,basisReference:x.basisReference}));
    calculationsByCircuit.set(x.circuitId,rows);}
  return Object.freeze(snapshot.circuits.filter(c=>c.assetId===assetId).map(c=>Object.freeze({
    id:c.id,code:c.code,name:c.name,revision:c.revision,state:c.state,
    loopBasis:loops.get(c.loopId)!.basisReference,locationCount:locationCounts.get(c.id)??0,
    recordedReadings:readingsByCircuit.get(c.id)??0,
    calculationReferences:Object.freeze(calculationsByCircuit.get(c.id)??[]),
  })));
}
function inspectionFor(assetId:string,snapshot:InspectionSnapshot):readonly InspectionContext[]{
  const candidatesByRequirement=new Map<string,InspectionContext["dueCandidates"][number][]>();
  for(const c of snapshot.candidates){const rows=candidatesByRequirement.get(c.requirementId)??[];
    rows.push(Object.freeze({id:c.id,source:c.source,dueAt:c.dueAt,basisReference:c.basisReference}));
    candidatesByRequirement.set(c.requirementId,rows);}
  const dueByRequirement=new Map(snapshot.dueDecisions.map(d=>[d.requirementId,d]));
  const eventsByRequirement=new Map<string,number>();
  const requirementForEvent=new Map<string,string>();
  for(const e of snapshot.events){eventsByRequirement.set(e.requirementId,(eventsByRequirement.get(e.requirementId)??0)+1);
    requirementForEvent.set(e.id,e.requirementId);}
  const reviewedCreditByRequirement=new Map<string,number>();
  for(const r of snapshot.reviews){
    if(r.status!=="APPROVED"||(r.credit!=="GRANTED"&&r.credit!=="PARTIAL")||!r.creditBasisReference||!r.creditGrantedAt)continue;
    const requirementId=requirementForEvent.get(r.eventId);
    if(requirementId)reviewedCreditByRequirement.set(requirementId,(reviewedCreditByRequirement.get(requirementId)??0)+1);
  }
  return Object.freeze(snapshot.requirements.filter(r=>r.assetId===assetId).map(r=>{
    const governing=dueByRequirement.get(r.id);
    return Object.freeze({id:r.id,code:r.code,revision:r.revision,status:r.status,basisReference:r.basisReference,
      governingTechnicalDueAt:governing?.technicalDueAt??null,governingBasis:governing?.basisReference??null,
      dueCandidates:Object.freeze(candidatesByRequirement.get(r.id)??[]),
      eventCount:eventsByRequirement.get(r.id)??0,reviewedCreditCount:reviewedCreditByRequirement.get(r.id)??0});
  }));
}
export function projectCrossDomainInvestigation(input:CrossDomainInput):CrossDomainOutcome{
  // Opt-in only. A snapshot, matching asset ID or session boundary alone is NOT authorization.
  if(!input.navigationScopeKey || !input.crossDomainScopeKey ||
     input.crossDomainScopeKey!==input.navigationScopeKey || !input.assetScopeKey ||
     input.assetSnapshot==null)return {kind:"disabled"};
  const air=parseAssetSnapshot(input.assetSnapshot);
  if(!air.ok)return {kind:"rejected"};
  const asset=air.snapshot.assets.find(a=>a.id===input.selectedAssetId);
  if(!asset)return {kind:"unselected"};
  const corrosionInput=input.corrosionScopeKey && input.corrosionSnapshot!=null ?
    parseCorrosionSnapshot(input.corrosionSnapshot) : null;
  const inspectionInput=input.inspectionScopeKey && input.inspectionSnapshot!=null ?
    parseInspectionSnapshot(input.inspectionSnapshot) : null;
  const emptyEvidence:EvidenceIndex={entries:[],total:0,truncated:false};
  return {kind:"ready",context:{asset,
    corrosion:corrosionInput===null?{state:"disconnected",records:[]}:
      corrosionInput.ok?{state:"ready",records:corrosionFor(asset.id,corrosionInput.snapshot)}:
      {state:"rejected",records:[]},
    inspection:inspectionInput===null?{state:"disconnected",records:[]}:
      inspectionInput.ok?{state:"ready",records:inspectionFor(asset.id,inspectionInput.snapshot)}:
      {state:"rejected",records:[]},
    evidence:{
      corrosion:corrosionInput?.ok?indexCorrosionEvidence(asset.id,corrosionInput.snapshot):emptyEvidence,
      inspection:inspectionInput?.ok?indexInspectionEvidence(asset.id,inspectionInput.snapshot):emptyEvidence,
    },
  }};
}
