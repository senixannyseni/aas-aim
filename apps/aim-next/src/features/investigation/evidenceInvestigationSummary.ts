/**
 * Phase 46.16 — bounded, read-only summary of an ALREADY authorized selected-asset
 * investigation. This projection is not an authorization check. Only call it
 * with the CrossDomainContext returned from projectCrossDomainInvestigation.
 *
 * Counts are over the indexed references, not a completeness certification.
 * It never infers missing evidence, a document's validity, engineering priority,
 * governing due dates, inspection credit, approval, or record supersession.
 */
import type {CrossDomainContext,InvestigationSourceState} from './crossDomainInvestigationModel';
import type {EngineeringEvidence,EvidenceDomain} from './engineeringEvidenceModel';
import {buildEvidenceChronology} from './evidenceChronology';
import {inspectEvidenceConsistency,type ConsistencyKind} from './evidenceConsistency';

export type SummarySource=Readonly<{
  domain:EvidenceDomain;
  state:InvestigationSourceState;
  indexed:number;
  totalReported:number;
  truncated:boolean;
}>;
export type SummaryReviewPath=Readonly<{
  key:string;
  label:string;
  kind:ConsistencyKind;
  /** Indexed source in the current selected-asset projection, not a URL. */
  example:EngineeringEvidence;
}>;
export type InvestigationSummary=Readonly<{
  assetId:string;
  sources:readonly SummarySource[];
  indexed:number;
  totalReported:number;
  limited:boolean;
  independentlyAvailableSources:number;
  reportedSourceTimes:number;
  dueTargets:number;
  timestampNotSupplied:number;
  timestampNotOrderable:number;
  revisionNotSupplied:number;
  supportingReferenceNotSupplied:number;
  observationCounts:Readonly<Record<ConsistencyKind,number>>;
  observationsTotal:number;
  observationsLimited:boolean;
  /** Only a bounded sample of currently indexed references. */
  reviewPaths:readonly SummaryReviewPath[];
}>;

/** Input is already selected-asset scoped and separately source-authorized. */
export function summarizeAuthorizedInvestigation(context:CrossDomainContext):InvestigationSummary{
  const sources:SummarySource[] = ([
    {domain:'COR' as const,domainState:context.corrosion.state,index:context.evidence.corrosion},
    {domain:'INS' as const,domainState:context.inspection.state,index:context.evidence.inspection},
  ]).map(({domain,domainState,index})=>Object.freeze({
    domain,state:domainState,
    indexed:domainState==='ready'?index.entries.length:0,
    totalReported:domainState==='ready'?index.total:0,
    truncated:domainState==='ready'&&index.truncated,
  }));
  // Never aggregate a rejected/disconnected source even if incorrectly supplied
  // with stale indexed entries by a caller. Authority remains upstream.
  const rows=[
    ...(context.corrosion.state==='ready'?context.evidence.corrosion.entries:[]),
    ...(context.inspection.state==='ready'?context.evidence.inspection.entries:[]),
  ];
  const chronology=buildEvidenceChronology(rows);
  const consistency=inspectEvidenceConsistency(rows);
  const paths:SummaryReviewPath[]=[];
  const used=new Set<string>();
  for(const note of consistency.observations){
    const example=note.examples[0];
    if(!example||used.has(example.key))continue;
    used.add(example.key);
    paths.push(Object.freeze({key:note.key,label:note.reference,kind:note.kind,example}));
    if(paths.length===3)break;
  }
  const totalReported=sources.reduce((sum,source)=>sum+source.totalReported,0);
  const indexed=sources.reduce((sum,source)=>sum+source.indexed,0);
  return Object.freeze({
    assetId:context.asset.id,sources:Object.freeze(sources),indexed,totalReported,
    limited:sources.some(x=>x.truncated),
    independentlyAvailableSources:sources.filter(x=>x.state==='ready').length,
    reportedSourceTimes:chronology.sourceTimes.length,
    dueTargets:chronology.dueTargets.length,
    timestampNotSupplied:chronology.coverage.timestampNotSupplied,
    timestampNotOrderable:chronology.coverage.timestampUnorderable,
    revisionNotSupplied:chronology.coverage.revisionNotSupplied,
    supportingReferenceNotSupplied:chronology.coverage.supportingReferenceNotSupplied,
    observationCounts:consistency.counts,
    observationsTotal:Object.values(consistency.counts).reduce((sum,count)=>sum+count,0),
    observationsLimited:consistency.limited,
    reviewPaths:Object.freeze(paths),
  });
}
