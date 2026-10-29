/**
 * Phase 46.15 — informational comparisons of reported fields inside the
 * currently authorized, bounded evidence index. This function does not join
 * sources, determine supersession, verify a document, or judge engineering
 * truth. Only full, exact reported text is compared (no fuzzy matching).
 */
import type {EngineeringEvidence,EvidenceDomain} from './engineeringEvidenceModel';

export type ConsistencyKind='REVISION_VARIATION'|'STATE_VARIATION'|'REFERENCE_REUSE';
export type ConsistencyObservation=Readonly<{
  key:string;
  kind:ConsistencyKind;
  /** Exact, unaltered text reported by the owning source. */
  reference:string;
  /** Null for cross-owner/source observations. */
  ownerDomain:EvidenceDomain|null;
  ownerRecordId:string|null;
  /** A bounded sample; all counts are from the currently indexed input only. */
  examples:readonly EngineeringEvidence[];
  indexedCount:number;
  summary:string;
}>;
export type EvidenceConsistency=Readonly<{
  observations:readonly ConsistencyObservation[];
  counts:Readonly<Record<ConsistencyKind,number>>;
  examinedReferences:number;
  limited:boolean;
}>;
export const CONSISTENCY_VIEW_LIMIT=60;
const kinds:readonly ConsistencyKind[]=['REVISION_VARIATION','STATE_VARIATION','REFERENCE_REUSE'];
const tuple=(...values:string[])=>JSON.stringify(values);
const distinct=(rows:readonly EngineeringEvidence[],field:'revision'|'status'):string[]=>
  [...new Set(rows.map(row=>row[field]).filter((x):x is string=>x!==null))];

/**
 * The caller MUST pass only projected references from the selected asset and
 * separately authorized COR/INS snapshots. No network or storage access.
 */
export function inspectEvidenceConsistency(entries:readonly EngineeringEvidence[]):EvidenceConsistency{
  const sourceRows=[...new Map(entries.map(e=>[e.key,e])).values()];
  const sameOwnerReference=new Map<string,EngineeringEvidence[]>();
  const sameReference=new Map<string,EngineeringEvidence[]>();
  for(const entry of sourceRows){
    const groupKey=tuple(entry.domain,entry.kind,entry.ownerRecordId,entry.reference);
    const local=sameOwnerReference.get(groupKey)??[];
    local.push(entry);sameOwnerReference.set(groupKey,local);
    const all=sameReference.get(entry.reference)??[];
    all.push(entry);sameReference.set(entry.reference,all);
  }
  const results:ConsistencyObservation[]=[];
  const add=(kind:ConsistencyKind,reference:string,rows:EngineeringEvidence[],summary:string,
    ownerDomain:EvidenceDomain|null,ownerRecordId:string|null)=>{
    results.push(Object.freeze({
      key:tuple(kind,ownerDomain??'',ownerRecordId??'',reference),kind,reference,
      ownerDomain,ownerRecordId,indexedCount:rows.length,
      examples:Object.freeze(rows.slice(0,3)),summary,
    }));
  };
  for(const rows of sameOwnerReference.values()){
    if(rows.length<2)continue;
    const first=rows[0];if(!first)continue;
    // A single reported record without a non-null revision cannot establish
    // revision variation. Different timestamps are not a contradiction.
    if(distinct(rows,'revision').length>1){
      add('REVISION_VARIATION',first.reference,rows,
        'Multiple reported revision texts in one domain, record and reference kind. No supersession is inferred.',
        first.domain,first.ownerRecordId);
    }
    if(distinct(rows,'status').length>1){
      add('STATE_VARIATION',first.reference,rows,
        'Multiple reported state texts in one domain, record and reference kind. A difference is not an engineering finding.',
        first.domain,first.ownerRecordId);
    }
  }
  for(const [reference,rows] of sameReference){
    if(rows.length<2)continue;
    const ownerKeys=new Set(rows.map(e=>tuple(e.domain,e.ownerRecordId)));
    if(ownerKeys.size>1){
      add('REFERENCE_REUSE',reference,rows,
        'This exact reference text appears under distinct owning domain/record identities. It does not establish an actual document link or conflicting source.',
        null,null);
    }
  }
  const counts={REVISION_VARIATION:0,STATE_VARIATION:0,REFERENCE_REUSE:0};
  for(const kind of kinds)counts[kind]=results.filter(x=>x.kind===kind).length;
  return Object.freeze({
    observations:Object.freeze(results.slice(0,CONSISTENCY_VIEW_LIMIT)),
    counts:Object.freeze(counts),examinedReferences:sourceRows.length,
    limited:results.length>CONSISTENCY_VIEW_LIMIT,
  });
}
