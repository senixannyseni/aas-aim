/** Phase 46.26: read-only navigation context for an authorized, bounded evidence index. */
import type {EngineeringEvidence} from './engineeringEvidenceModel';
export type InvestigationJourneyPointer=Readonly<{
  key:string;domain:'COR'|'INS';reference:string;ownerRecordId:string;kind:string;
}>;
export type InvestigationJourney=Readonly<{
  pointer:InvestigationJourneyPointer|null;
  status:'NO_SELECTION'|'CURRENT_INDEX';
}>;
/** Never construct a pointer from untrusted IDs; resolve only from supplied authorized entries. */
export function investigationJourney(
  entries:readonly EngineeringEvidence[],selectedKey:string|null,
):InvestigationJourney{
  const entry=selectedKey===null?undefined:entries.find(item=>item.key===selectedKey);
  return entry?{status:'CURRENT_INDEX',pointer:{
    key:entry.key,domain:entry.domain,reference:entry.reference,
    ownerRecordId:entry.ownerRecordId,kind:entry.kind,
  }}:{status:'NO_SELECTION',pointer:null};
}
