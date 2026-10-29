/**
 * Phase 46.17 — local trace navigation for the ALREADY scoped, source-authorized
 * evidence index. All associations are identity-field or exact-text observations;
 * none verifies a document, relationship, authority, review or engineering fact.
 * This pure function does not fetch, store, or dereference source references.
 */
import type {EngineeringEvidence} from './engineeringEvidenceModel';

export const TRACE_PEER_LIMIT=8;
export type TraceGroup=Readonly<{
  entries:readonly EngineeringEvidence[];
  indexedCount:number;
  limited:boolean;
}>;
export type EvidenceTrace=Readonly<{
  anchor:EngineeringEvidence;
  /** Other entries reported with the same domain + owning record + source record ID. */
  sameSourceRecord:TraceGroup;
  /** Other entries under the same domain and owning record, including same-source items. */
  owningRecordContext:TraceGroup;
  /** Same-owner reference text exactly matches the anchor's supporting-reference text. */
  reportedSupportTextMatches:TraceGroup;
  /** Same-owner entries whose supporting-reference text exactly equals this anchor reference. */
  incomingReportedTextMatches:TraceGroup;
}>;
const group=(rows:readonly EngineeringEvidence[]):TraceGroup=>Object.freeze({
  entries:Object.freeze(rows.slice(0,TRACE_PEER_LIMIT)),
  indexedCount:rows.length,
  limited:rows.length>TRACE_PEER_LIMIT,
});

/**
 * Only indexed peers of the SAME owning domain and record may be returned.
 * Exact strings are merely comparison clues, never relational joins.
 */
export function traceIndexedEvidence(entries:readonly EngineeringEvidence[],selectedKey:string|null):EvidenceTrace|null{
  if(!selectedKey)return null;
  const unique=[...new Map(entries.map(entry=>[entry.key,entry])).values()];
  const anchor=unique.find(entry=>entry.key===selectedKey);
  if(!anchor)return null;
  const peers=unique.filter(entry=>entry.key!==anchor.key &&
    entry.domain===anchor.domain && entry.ownerRecordId===anchor.ownerRecordId);
  return Object.freeze({
    anchor,
    sameSourceRecord:group(peers.filter(entry=>entry.sourceRecordId===anchor.sourceRecordId)),
    owningRecordContext:group(peers),
    reportedSupportTextMatches:group(anchor.supportingReference===null?[]:
      peers.filter(entry=>entry.reference===anchor.supportingReference)),
    incomingReportedTextMatches:group(peers.filter(entry=>entry.supportingReference!==null &&
      entry.supportingReference===anchor.reference)),
  });
}
