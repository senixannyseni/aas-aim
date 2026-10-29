/**
 * Phase 46.5: provenance-only view of ALREADY validated, independently scoped
 * COR and INS snapshots. These functions must be called only after successful
 * parseCorrosionSnapshot / parseInspectionSnapshot and an authorized AIR match.
 * They do not validate access, resolve documents, join COR to INS by free-text
 * references, infer technical due dates or award inspection credit.
 */
import type {CorrosionSnapshot} from "../corrosion/corrosionModel";
import type {InspectionSnapshot} from "../inspection/inspectionModel";

export type EvidenceDomain="COR"|"INS";
export type EvidenceAuthority="SOURCE_REFERENCE"|"DUE_CANDIDATE"|"GOVERNING_INS_DECISION"|"TECHNICAL_REVIEW";
export type EngineeringEvidence=Readonly<{
  /** Local UI identity; not an externally dereferenceable URL or permission token. */
  key:string;
  domain:EvidenceDomain;
  kind:string;
  sourceRecordId:string;
  /** COR circuit or INS requirement owning this displayed reference. */
  ownerRecordId:string;
  reference:string;
  supportingReference:string|null;
  revision:string|null;
  reportedAt:string|null;
  status:string;
  authority:EvidenceAuthority;
}>;
export type EvidenceIndex=Readonly<{
  entries:readonly EngineeringEvidence[];
  /** Number of source references considered for THIS selected asset, not a global total. */
  total:number;
  truncated:boolean;
}>;
export const EVIDENCE_INDEX_LIMIT=200;

function createIndex(){
  const entries:EngineeringEvidence[]=[];
  let total=0;
  return {
    add(value:EngineeringEvidence){
      total++;
      if(entries.length<EVIDENCE_INDEX_LIMIT)entries.push(Object.freeze(value));
    },
    finish():EvidenceIndex{return Object.freeze({entries:Object.freeze(entries),total,truncated:total>entries.length});},
  };
}
/** The owning COR source is all-or-nothing parsed before this call. */
export function indexCorrosionEvidence(assetId:string,snapshot:CorrosionSnapshot):EvidenceIndex{
  const index=createIndex();
  const circuits=snapshot.circuits.filter(x=>x.assetId===assetId);
  const circuitIds=new Set(circuits.map(x=>x.id));
  const loops=new Map(snapshot.loops.map(x=>[x.id,x]));
  const readingsBySet=new Map<string,typeof snapshot.readings[number][]>();
  for(const reading of snapshot.readings){const rows=readingsBySet.get(reading.setId)??[];rows.push(reading);readingsBySet.set(reading.setId,rows);}
  const add=(kind:string,sourceRecordId:string,ownerRecordId:string,reference:string,
    status:string,revision:string|null=null,reportedAt:string|null=null,
    authority:EvidenceAuthority="SOURCE_REFERENCE",supportingReference:string|null=null)=>
    index.add({key:`COR:${kind}:${ownerRecordId}:${sourceRecordId}`,domain:"COR",kind,sourceRecordId,
      ownerRecordId,reference,status,revision,reportedAt,authority,supportingReference});
  for(const circuit of circuits){
    const loop=loops.get(circuit.loopId);
    // The validated COR parser guarantees the loop reference is present.
    if(loop)add("Loop basis",loop.id,circuit.id,loop.basisReference,circuit.state,circuit.revision);
  }
  for(const location of snapshot.locations)if(circuitIds.has(location.circuitId))
    add("Monitoring location",location.id,location.circuitId,location.sourceReference,location.kind);
  for(const set of snapshot.sets)if(circuitIds.has(set.circuitId)){
    add("Measurement set",set.id,set.circuitId,set.reference,set.state,null,set.measuredAt);
    for(const reading of readingsBySet.get(set.id)??[])
      add("Thickness reading",reading.id,set.circuitId,reading.sourceReference,reading.quality,null,reading.measuredAt);
  }
  for(const tmin of snapshot.tmins)if(circuitIds.has(tmin.circuitId))
    add("Minimum thickness basis",tmin.id,tmin.circuitId,tmin.basisReference,tmin.status,tmin.revision,tmin.effectiveAt??null);
  for(const calc of snapshot.calculations)if(circuitIds.has(calc.circuitId))
    add("Calculation trace",calc.id,calc.circuitId,calc.traceReference,calc.status,calc.revision,calc.calculatedAt,"SOURCE_REFERENCE",calc.basisReference);
  const calculationToCircuit=new Map(snapshot.calculations.map(x=>[x.id,x.circuitId]));
  for(const rate of snapshot.rates){const circuitId=calculationToCircuit.get(rate.calculationId);
    if(circuitId&&circuitIds.has(circuitId))add("Rate basis",rate.id,circuitId,rate.basisReference,rate.method);
  }
  const readingToCircuit=new Map<string,string>();
  for(const set of snapshot.sets)if(circuitIds.has(set.circuitId))
    for(const reading of readingsBySet.get(set.id)??[])readingToCircuit.set(reading.id,set.circuitId);
  for(const anomaly of snapshot.anomalies){const circuitId=readingToCircuit.get(anomaly.readingId);
    if(circuitId&&anomaly.basisReference)
      add("Anomaly disposition",anomaly.id,circuitId,anomaly.basisReference,anomaly.disposition);
  }
  return index.finish();
}
/** The owning INS source is all-or-nothing parsed before this call. */
export function indexInspectionEvidence(assetId:string,snapshot:InspectionSnapshot):EvidenceIndex{
  const index=createIndex();
  const requirements=snapshot.requirements.filter(x=>x.assetId===assetId);
  const requirementIds=new Set(requirements.map(x=>x.id));
  const add=(kind:string,sourceRecordId:string,ownerRecordId:string,reference:string,
    status:string,revision:string|null=null,reportedAt:string|null=null,
    authority:EvidenceAuthority="SOURCE_REFERENCE",supportingReference:string|null=null,part="")=>
    index.add({key:`INS:${kind}:${ownerRecordId}:${sourceRecordId}:${part}`,domain:"INS",kind,sourceRecordId,
      ownerRecordId,reference,status,revision,reportedAt,authority,supportingReference});
  for(const requirement of requirements)
    add("Requirement basis",requirement.id,requirement.id,requirement.basisReference,requirement.status,requirement.revision,requirement.approvedAt??null);
  for(const candidate of snapshot.candidates)if(requirementIds.has(candidate.requirementId))
    add("Due candidate",candidate.id,candidate.requirementId,candidate.basisReference,candidate.source,null,candidate.dueAt,"DUE_CANDIDATE");
  for(const due of snapshot.dueDecisions)if(requirementIds.has(due.requirementId))
    add("INS governing due basis",due.id,due.requirementId,due.basisReference,"INS decision",null,due.determinedAt,"GOVERNING_INS_DECISION",due.technicalDueAt);
  for(const plan of snapshot.plans)for(const requirementId of plan.requirementIds)if(requirementIds.has(requirementId))
    add("Inspection plan basis",plan.id,requirementId,plan.basisReference,plan.status,plan.revision);
  for(const workpack of snapshot.workpacks)for(const requirementId of workpack.requirementIds)if(requirementIds.has(requirementId))
    add("Workpack scope",workpack.id,requirementId,workpack.scopeReference,workpack.status,workpack.revision,workpack.releasedAt??null,"SOURCE_REFERENCE",workpack.qualificationReference);
  for(const event of snapshot.events)if(requirementIds.has(event.requirementId)){
    if(event.resultReference)add("Inspection result",event.id,event.requirementId,event.resultReference,event.status,null,event.eventAt);
    event.evidenceReferences.forEach((ref,i)=>add("Field evidence reference",event.id,event.requirementId,ref,event.status,null,event.eventAt,"SOURCE_REFERENCE",null,String(i)));
  }
  for(const review of snapshot.reviews)if(requirementIds.has(review.requirementId)){
    if(review.basisReference)add("Review basis",review.id,review.requirementId,review.basisReference,`${review.status} · ${review.credit}`,null,review.reviewedAt??null,"TECHNICAL_REVIEW");
    if(review.creditBasisReference)add("Credit review basis",review.id,review.requirementId,review.creditBasisReference,`${review.status} · ${review.credit}`,null,review.creditGrantedAt??null,"TECHNICAL_REVIEW");
  }
  return index.finish();
}
