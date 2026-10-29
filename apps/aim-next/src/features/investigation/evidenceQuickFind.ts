/** Phase 46.25: local-only evidence finding in an independently authorized, bounded source index.
 * Tokens must each appear in a reported field; no fuzzy joins, backend search,
 * inferred document identity, engineering validity or authorization decisions.
 */
import type {EngineeringEvidence} from './engineeringEvidenceModel';
export const EVIDENCE_QUERY_LIMIT=100;
const searchableFields=(item:EngineeringEvidence):readonly string[]=>[
 item.reference,item.sourceRecordId,item.ownerRecordId,item.kind,item.status,
 item.revision??'',item.supportingReference??'',item.domain,
];
const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('en-US').trim();
export function filterIndexedEvidence(entries:readonly EngineeringEvidence[],query:string):readonly EngineeringEvidence[]{
 const parts=normalize(query.slice(0,EVIDENCE_QUERY_LIMIT)).split(/\s+/u).filter(Boolean);
 if(!parts.length)return entries;
 return entries.filter(item=>{
   const haystack=searchableFields(item).map(normalize).join(' ');
   return parts.every(part=>haystack.includes(part));
 });
}
export type EvidencePosition=Readonly<{index:number;count:number;previousKey:string|null;nextKey:string|null}>;
/** Adjacent keys exist only in the currently filtered, currently visible authorized index. */
export function evidencePosition(entries:readonly EngineeringEvidence[],selectedKey:string|null):EvidencePosition|null{
 if(!selectedKey)return null;
 const index=entries.findIndex(item=>item.key===selectedKey);
 if(index<0)return null;
 return {index,count:entries.length,previousKey:entries[index-1]?.key??null,nextKey:entries[index+1]?.key??null};
}
